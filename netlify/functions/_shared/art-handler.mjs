import {createHash} from 'node:crypto';
import {PROFILES, validateArtwork} from '../../../dist/core.mjs';
import {respond, TOKEN, readJSON} from './http.mjs';
const MAX_ARTS = 500, FAMILY_BYTES = 120 * 1024 * 1024, SITE_BYTES = 512 * 1024 * 1024;
const summary = (a, etag) => ({id: a.id, profile: a.profile, title: a.title, pageId: a.pageId,
  updatedAt: a.updatedAt, thumbnail: a.thumbnail, deleted: !!a.deleted, hasBase:!!a.customBase, etag});

// Failed writes keep conservative high-water reservations; committed tombstones reclaim payload capacity.
// This bounds concurrent allocations without a cross-blob transaction or unsafe rollback.
async function reserve(store, family, key, bytes, deleted) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const entry = await store.getWithMetadata('_budget/v1', {type: 'json'});
    const ledger = entry?.data || {families: {}, total: 0, count:0};
    const own = ledger.families[family] || {records: {}, bytes: 0};
    const allocation=own.records[key]||0;
    if(allocation<0&&!deleted)return respond({error:'This picture was deleted on another device.'},409);
    const previous = Math.abs(allocation), increase = Math.max(0, bytes - previous);
    if ((!previous && Object.keys(own.records).length >= MAX_ARTS) || own.bytes + increase > FAMILY_BYTES)
      return respond({error: 'Family storage is full. Keep an editable backup of this picture.'}, 413);
    if (ledger.total + increase > SITE_BYTES || (!previous && (ledger.count||0)>=3000))
      return respond({error: 'Cloud storage is full. Pictures remain saved on this device.'}, 413);
    if(!previous)ledger.count=(ledger.count||0)+1;
    own.records[key] = Math.max(bytes, previous)*(allocation<0?-1:1); own.bytes += increase;
    ledger.families[family] = own; ledger.total += increase;
    const result = await store.setJSON('_budget/v1', ledger, entry ? {onlyIfMatch: entry.etag} : {onlyIfNew: true});
    if (result.modified) return null;
  }
  return respond({error: 'Sync is busy. Try again shortly.'}, 503);
}

async function reclaimDeleted(store,family,slot,key,bytes){
  const head=await store.getWithMetadata(key,{type:'json'});
  const brief=await store.getWithMetadata('_summary/'+key,{type:'json'});
  if(!head?.data.deleted||brief?.data.etag!==head.etag||!brief.data.deleted)return;
  for(let n=0;n<8;n++){
    const entry=await store.getWithMetadata('_budget/v1',{type:'json'});
    const ledger=entry?.data,own=ledger?.families[family];
    if(!own?.records[slot])return;
    const previous=Math.abs(own.records[slot]), freed=Math.max(0,previous-bytes);
    // Negative reservations mark immutable tombstones. Stale in-flight writers cannot allocate paint again.
    own.records[slot]=-bytes;own.bytes-=freed;ledger.total-=freed;
    if((await store.setJSON('_budget/v1',ledger,{onlyIfMatch:entry.etag})).modified)return;
  }
}

export async function handleArt(req, store, families) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
  if (!TOKEN.test(token)) return respond({error: 'A family phrase is required.'}, 401);
  const url = new URL(req.url), profile = url.searchParams.get('profile'), id = url.searchParams.get('id');
  if (!PROFILES.includes(profile)) return respond({error: 'Choose a valid profile.'}, 400);
  if (id && !/^[a-z0-9-]{8,80}$/.test(id)) return respond({error: 'Invalid artwork ID.'}, 400);
  const family = createHash('sha256').update(token).digest('hex'), prefix = `${family}/${profile}/`;
  if (req.method === 'GET') {
    if (id) {
      const record = await store.getWithMetadata(prefix + id, {type: 'json'});
      return record ? respond({art: record.data, etag: record.etag}) : respond({error: 'Artwork not found.'}, 404);
    }
    const cursor = url.searchParams.get('cursor') || '';
    if (cursor && !/^[a-z0-9-]{8,80}$/.test(cursor)) return respond({error: 'Invalid gallery page.'}, 400);
    // Listing keys is cheap; never download every painting to build the gallery.
    const {blobs} = await store.list({prefix});
    const keys = blobs.map(b => b.key).sort().filter(k => k.slice(prefix.length) > cursor);
    const page = keys.slice(0, 12), arts = [];
    const etags=new Map(blobs.map(b=>[b.key,b.etag]));
    for (const key of page) {
      const cached = await store.getWithMetadata('_summary/' + key, {type: 'json'});
      if (cached&&cached.data.etag===etags.get(key)) {arts.push(cached.data); continue;}
      // One-time, bounded migration for pre-review records, including retired pages.
      const old = await store.getWithMetadata(key, {type: 'json'});
      if (old) {
        const brief = summary(old.data, old.etag);
        await store.setJSON('_summary/' + key, brief, cached?{onlyIfMatch:cached.etag}:{onlyIfNew:true});
        arts.push(brief);
      }
    }
    return respond({arts, nextCursor: keys.length > page.length ? page.at(-1).slice(prefix.length) : null});
  }
  if (req.method !== 'PUT') return respond({error: 'Method not allowed.'}, 405);
  const origin = req.headers.get('origin');
  if (origin && origin !== url.origin) return respond({error: 'Origin mismatch.'}, 403);
  if (!families || !await families.getWithMetadata('family/' + family, {type: 'json'}))
    return respond({error: 'Register this family before syncing.'}, 403);
  let body;
  try {body = await readJSON(req, 4500000);} catch (e) {return respond({error: e.message}, e.status);}
  if (!validateArtwork(body?.art) || body.art.profile !== profile || body.art.id !== id)
    return respond({error: 'Invalid artwork.'}, 400);
  const etag = body.etag;
  if (etag !== null && (typeof etag !== 'string' || !etag || etag.length > 200))
    return respond({error: 'Invalid revision.'}, 400);
  const key = prefix + id, current = await store.getWithMetadata(key, {type: 'json'});
  if (current?.data.deleted && !body.art.deleted)
    return respond({error: 'This picture was deleted on another device.'}, 409);
  if ((etag && current?.etag !== etag) || (!etag && current))
    return respond({error: 'Another device saved a newer version.'}, 409);
  const art = body.art, bytes = Buffer.byteLength(JSON.stringify(art));
  const budget = await reserve(store, family, profile + '/' + id, bytes*2+4096,!!art.deleted);
  if (budget) return budget;
  const result = await store.setJSON(key, art, etag ? {onlyIfMatch: etag} : {onlyIfNew: true});
  if (!result.modified) return respond({error: 'Another device saved a newer version.'}, 409);
  // A version-specific summary prevents delayed requests from overwriting newer summaries.
  const brief = summary(art, result.etag);
  for (let n = 0; n < 4; n++) {
    const previous = await store.getWithMetadata('_summary/' + key, {type: 'json'});
    const latest = await store.getWithMetadata(key, {type: 'json'});
    if (latest?.etag !== result.etag) break;
    const saved = await store.setJSON('_summary/' + key, brief, previous ? {onlyIfMatch: previous.etag} : {onlyIfNew: true});
    if (saved.modified) break;
  }
  if(art.deleted)await reclaimDeleted(store,family,profile+'/'+id,key,bytes*2+4096);
  return respond({etag: result.etag});
}
