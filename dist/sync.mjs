import {getSetting, setSetting, getArt, listArt, pendingArt, artKey,
  acknowledgeUpload, markSyncError, storeRemote, preserveConflict, retryPending} from './storage.mjs';
import {normalizePairCode, validateArtwork} from './core.mjs';
export let family = '', familyPassphrase = '';
let flight, rerun = false, notify = () => {}, onConflict = () => {}, phraseRequest;
const COOKIE = 'little_color_family';
function persistCode(code) {
  localStorage.setItem(COOKIE, code);
  // Read the legacy cookie once, then stop transmitting the bearer key with every asset.
  document.cookie = `${COOKIE}=; Max-Age=0; Path=/; SameSite=Strict`;
}
export async function initFamily(status, conflict) {
  notify = status; onConflict = conflict;
  let code = localStorage.getItem(COOKIE) || document.cookie.split('; ').find(s => s.startsWith(COOKIE + '='))?.split('=')[1] || await getSetting('family');
  try {code = normalizePairCode(code || ''); if (!/^[a-f0-9]{64}$/.test(code)) throw new Error();}
  catch {code = Array.from(crypto.getRandomValues(new Uint8Array(32)), v => v.toString(16).padStart(2, '0')).join('');}
  family = code; persistCode(code); await setSetting('family', code);
  familyPassphrase = await getSetting('phrase:' + family) || '';
  window.addEventListener('online', () => {retrySync().catch(() => {});});
  if (navigator.onLine) ensureFamilyPassphrase().catch(() => {});
  return code;
}
export async function ensureFamilyPassphrase() {
  if (familyPassphrase) return familyPassphrase;
  const target = family;
  if (phraseRequest?.family === target) return phraseRequest.promise;
  const promise = (async () => {
    const {passphrase} = await request('/api/family', {method: 'POST', body: JSON.stringify({action: 'register'})}, target);
    const phrase = normalizePairCode(passphrase);
    if (/^[a-f0-9]{64}$/.test(phrase)) throw new Error('Invalid family phrase');
    await setSetting('phrase:' + target, phrase);
    if (family === target) familyPassphrase = phrase;
    return phrase;
  })();
  phraseRequest = {family: target, promise};
  try {return await promise;} finally {if (phraseRequest?.promise === promise) phraseRequest = null;}
}
export async function pairFamily(code) {
  const input = normalizePairCode(code);
  if (input === family || input === familyPassphrase) return family;
  await flush();
  if ((await pendingArt(family)).length) throw new Error('Some pictures are still waiting to sync. Retry before changing families.');
  // Keep a recoverable previous connection before changing any active settings.
  const previous = {key: family, phrase: await ensureFamilyPassphrase()};
  let value = input, phrase = '';
  if (!/^[a-f0-9]{64}$/.test(input)) {
    const result = await request('/api/family', {method: 'POST', body: JSON.stringify({action: 'join', passphrase: input})});
    value = result.family; phrase = result.passphrase;
    if (!/^[a-f0-9]{64}$/.test(value)) throw new Error('Invalid family connection');
  }
  await request('/api/art?profile=Olivia', {}, value);
  await setSetting('previousFamily', previous);
  await setSetting('family', value);
  if (phrase) await setSetting('phrase:' + value, phrase);
  persistCode(value); family = value;
  familyPassphrase = phrase || await getSetting('phrase:' + value) || '';
  return value;
}
export async function previousFamilyPhrase() {return (await getSetting('previousFamily'))?.phrase || '';}
async function request(path, options = {}, code = family) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(path, {...options, signal: controller.signal,
      headers: {Authorization: `Bearer ${code}`, 'Content-Type': 'application/json', ...options.headers}, cache: 'no-store'});
    if (!res.ok) {
      let message = 'Family sync is unavailable.';
      try {message = (await res.json()).error || message;} catch {}
      const error = new Error(message); error.status = res.status; throw error;
    }
    return await res.json();
  } finally {clearTimeout(timer);}
}
export function cloudPayload(a) {
  const {id, profile, title, pageId, paint, thumbnail, customBase, updatedAt, revision, deleted} = a;
  return {id, profile, title, pageId, paint, thumbnail, customBase, updatedAt, revision, deleted: !!deleted};
}
export async function pullList(profile, target = family) {
  let cursor = '', arts = [];
  do {
    const page = await request(`/api/art?profile=${profile}${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`, {}, target);
    arts.push(...page.arts); cursor = page.nextCursor || '';
  } while (cursor && arts.length <= 500 && target === family);
  return target === family ? arts : [];
}
async function fetchRemote(profile, id, target) {
  const {art, etag} = await request(`/api/art?profile=${profile}&id=${id}`, {}, target);
  return {...art, family: target, key: artKey(target, profile, id), etag, pending: false};
}
export async function loadRemote(profile, id, target = family) {
  const remote = await fetchRemote(profile, id, target);
  return storeRemote(remote);
}
async function syncOnce(target) {
  if (!navigator.onLine) {notify('offline'); return;}
  const pending = await pendingArt(target);
  if (!pending.length) {notify('synced'); return;}
  notify('syncing');
  try {await ensureFamilyPassphrase();} catch {notify('waiting'); return;}
  for (const meta of pending) {
    if (target !== family) break;
    if (meta.retryAt > Date.now()) continue;
    const a = await getArt(meta.key);
    if (!a?.pending) continue;
    try {
      const payload = cloudPayload(a);
      if (!validateArtwork(payload)) {
        const err = new Error('This picture needs an editable-file backup before syncing.'); err.status = 413; throw err;
      }
      const {etag} = await request(`/api/art?profile=${a.profile}&id=${a.id}`, {
        method: 'PUT', body: JSON.stringify({art: payload, etag: a.etag || null})}, target);
      if (await acknowledgeUpload(a.key, a.revision, etag, a.etag || null)) rerun = true;
    } catch (e) {
      if (e.status === 409) {
        try {
          const remote = await fetchRemote(a.profile, a.id, target);
          // If the acknowledgement was lost, this is the same saved revision, not a conflict.
          if (remote.revision === a.revision) {
            if (await acknowledgeUpload(a.key, a.revision, remote.etag, a.etag || null)) rerun = true;
          } else {
            const result = await preserveConflict(a.key, remote, crypto.randomUUID());
            if (result) {onConflict(a.id, result.record, result.deleted); rerun = true;}
          }
        } catch (err) {await markSyncError(a.key, a.revision, err.message);}
      } else {
        await markSyncError(a.key, a.revision, e.message, [400, 401, 403, 413, 422].includes(e.status));
      }
      // A bad item never stops unrelated pictures from uploading.
    }
  }
  const remaining = await pendingArt(target);
  if (target === family) notify(remaining.some(a => a.syncError) ? 'attention' : remaining.length ? 'waiting' : 'synced');
}
export async function flush() {
  if (flight) {rerun = true; return flight;}
  const target = family;
  flight = (async () => {
    // Bound rapid follow-up work; the interval handles later retries.
    for (let n = 0; n < 3; n++) {
      rerun = false;
      try {await syncOnce(target);} catch {if (target === family) notify('waiting');}
      if (!rerun || target !== family) break;
    }
  })();
  try {await flight;} finally {flight = null;}
}
export async function retrySync() {await retryPending(family); await flush();}
export async function syncProblems() {return (await pendingArt(family)).filter(a => a.syncError);}
export async function mergeGallery(profile) {
  const target = family, local = await listArt(target, profile, true);
  let remote = [];
  try {remote = await pullList(profile, target);} catch {notify(navigator.onLine ? 'waiting' : 'offline');}
  if (target !== family) return [];
  const map = new Map(local.map(a => [a.id, a]));
  for (const a of remote) {
    const existing = map.get(a.id);
    if (a.deleted) {
      map.set(a.id, {...a, deleted:true});
      if(existing?.pending){
        const result=await preserveConflict(existing.key,{...a,family:target,key:existing.key,pending:false,paint:'',customBase:null},crypto.randomUUID());
        if(result)onConflict(a.id,result.record,true);
      }else if(existing){await storeRemote({...existing,...a,paint:'',customBase:null,pending:false});}
    } else if (!existing || (!existing.pending && a.etag !== existing.etag)) {
      map.set(a.id, {...a, family: target, key: artKey(target, profile, a.id), remote: true});
    }
  }
  return [...map.values()].filter(a => !a.deleted).sort((a, b) => b.updatedAt - a.updatedAt);
}
