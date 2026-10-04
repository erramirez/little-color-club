import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {openDB, putArt, getArt, listArt, pendingArt, acknowledgeUpload, preserveConflict, storeRemote, deleteArt, artKey} from '../dist/storage.mjs';
globalThis.crypto ??= webcrypto;
const family='a'.repeat(64), key=artKey(family,'Olivia','transition-art');
const picture={id:'transition-art',key,family,profile:'Olivia',title:'Cat',pageId:'v3-cat',paint:'data:image/png;base64,AA==',thumbnail:'data:image/png;base64,AA==',customBase:'data:image/png;base64,AA==',revision:'first',pending:true,etag:null,updatedAt:1,editorId:'editor-one'};

test('v1 migration splits payloads; acknowledgement preserves new paint and queued saves keep cloud ETags',async()=>{
  const legacy=await new Promise((resolve,reject)=>{const req=indexedDB.open('little-color-club-v2',1);req.onupgradeneeded=()=>{req.result.createObjectStore('art',{keyPath:'key'});req.result.createObjectStore('settings');};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  await new Promise(resolve=>{const tx=legacy.transaction('art','readwrite');tx.objectStore('art').put(picture);tx.oncomplete=resolve;});legacy.close();
  assert.equal((await getArt(key)).paint,picture.paint);
  const db=await openDB();const meta=await new Promise(resolve=>{const req=db.transaction('art').objectStore('art').get(key);req.onsuccess=()=>resolve(req.result);});
  assert.equal(meta.paint,undefined);assert.equal(meta.hasBase,true);
  await putArt({...picture,paint:'data:image/png;base64,NEW=',revision:'second'});
  assert.equal(await acknowledgeUpload(key,'first','cloud-one'),true);
  let saved=await getArt(key);assert.equal(saved.revision,'second');assert.equal(saved.paint,'data:image/png;base64,NEW=');assert.equal(saved.pending,true);
  await putArt({...saved,revision:'third',etag:null});assert.equal((await getArt(key)).etag,'cloud-one');
  await acknowledgeUpload(key,'third','cloud-two');assert.equal((await pendingArt(family)).length,0);
  assert.equal((await listArt(family,'Henry')).length,0);
});
test('conflict forks latest paint once, redirects the old editor, and leaves remote original editable',async()=>{
  await putArt({...picture,revision:'local-new',pending:true});
  const remote={...picture,revision:'remote-new',editorId:undefined,etag:'remote-etag',pending:false};
  const result=await preserveConflict(key,remote,'conflict-fork');assert.equal(result.record.revision,'local-new');
  assert.equal(await preserveConflict(key,remote,'duplicate-fork'),null);
  const redirected=await putArt({...picture,revision:'live-stroke'});assert.equal(redirected.id,'conflict-fork');
  const reopened=await putArt({...remote,editorId:'new-editor',revision:'edit-remote',pending:true});assert.equal(reopened.id,'transition-art');
  assert.equal((await getArt(result.record.key)).revision,'live-stroke');
});
test('remote reads do not replace pending local paint; tombstones prevent resurrection',async()=>{
  const local=await getArt(key);assert.equal((await storeRemote({...local,revision:'incoming',pending:false})).revision,local.revision);
  await deleteArt(local);await putArt({...local,revision:'stale-tab',pending:true});assert.equal((await getArt(key)).deleted,true);
  assert.ok(!(await listArt(family,'Olivia')).some(a=>a.id===local.id));
  const remote={...local,paint:'',thumbnail:'',customBase:null,deleted:true,revision:'remote-delete',pending:false,etag:'deleted-etag'};
  const resolved=await preserveConflict(key,remote,'no-resurrection');assert.equal(resolved.deleted,true);assert.equal((await getArt(key)).pending,false);
});

test('an older acknowledgement cannot revert an ETag already advanced by another tab',async()=>{
 const a={...picture,id:'multi-tab-art',key:artKey(family,'Olivia','multi-tab-art'),revision:'newest',etag:'newer-cloud',pending:true};await putArt(a);
 await acknowledgeUpload(a.key,'older','stale-cloud','original-cloud');
 const after=await getArt(a.key);assert.equal(after.etag,'newer-cloud');assert.equal(after.revision,'newest');assert.equal(after.pending,true);
});
