import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {putArt,getArt,artKey,pendingArt} from '../dist/storage.mjs';
import {initFamily,family,flush,retrySync,pairFamily} from '../dist/sync.mjs';
globalThis.crypto??=webcrypto;
const settings=new Map();globalThis.localStorage={getItem:k=>settings.get(k),setItem:(k,v)=>settings.set(k,v)};
globalThis.document={cookie:''};globalThis.location={protocol:'https:'};globalThis.window={addEventListener(){}};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});
let attempts=[],bad=true,blockedFetch=false,conflicts=0;
globalThis.fetch=async(path,options)=>{
 if(path==='/api/family')return Response.json({passphrase:'purple-dog-kite'});
 if(options.method==='PUT'){
   const {art}=JSON.parse(options.body);attempts.push(art.id);
   if(art.id==='bad-art-id'&&bad)return Response.json({error:'Invalid thumbnail.'},{status:400});
   if(art.id==='conflict-id')return Response.json({error:'Conflict'},{status:409});
   return Response.json({etag:'saved-etag'});
 }
 if(path.includes('conflict-id')){if(blockedFetch)throw new Error('offline');return Response.json({art:{...record('conflict-id'),revision:'remote-version'},etag:'remote-etag'});}
 return Response.json({arts:[],nextCursor:null});
};
function record(id){return {id,key:artKey(family,'Olivia',id),family,profile:'Olivia',title:'Picture',pageId:'v3-cat',paint:'data:image/png;base64,AA==',thumbnail:'data:image/png;base64,AA==',updatedAt:1,revision:'local-version',pending:true,etag:null};}
test('one rejected item does not block uploads; manual retry clears backoff; pending work blocks family switching',async()=>{
 await initFamily(()=>{},()=>conflicts++);await putArt(record('bad-art-id'));await putArt(record('good-art-id'));await flush();
 assert.ok(attempts.includes('good-art-id'));assert.equal((await getArt(artKey(family,'Olivia','good-art-id'))).pending,false);
 assert.equal((await getArt(artKey(family,'Olivia','bad-art-id'))).syncError,'Invalid thumbnail.');
 const count=attempts.length;await flush();assert.equal(attempts.length,count);
 await assert.rejects(()=>pairFamily('blue-cat-tree'),/waiting to sync/);
 bad=false;await retrySync();assert.equal((await pendingArt(family)).length,0);
});
test('failed conflict fetch creates no forks; retry preserves one copy and resolves a lost acknowledgement',async()=>{
 const local=record('conflict-id');await putArt(local);blockedFetch=true;await flush();assert.equal(conflicts,0);assert.equal((await pendingArt(family)).length,1);
 blockedFetch=false;await retrySync();assert.equal(conflicts,1);assert.equal((await pendingArt(family)).length,0);
});
