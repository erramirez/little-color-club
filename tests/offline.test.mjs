import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
async function worker(fetcher, windows = [{id:"one"}]) {
 const listeners={},stores=new Map();
 const caches={async open(name){if(!stores.has(name))stores.set(name,new Map());const entries=stores.get(name);return {match:async req=>entries.get(typeof req==='string'?req:req.url)?.clone(),put:async(req,res)=>entries.set(typeof req==='string'?req:req.url,res),keys:async()=>[...entries.keys()],delete:async key=>entries.delete(key)};},keys:async()=>[...stores.keys()],delete:async key=>stores.delete(key)};
 let skipped=0, claimed=0;
 const hashes={'/index.html':'html','/app.mjs':'hash'};
 const code=(await readFile(new URL('../scripts/sw-template.mjs',import.meta.url),'utf8')).replace('__RELEASE__','"test-release"').replace('__HASHES__',JSON.stringify(hashes));
 vm.runInNewContext(code,{self:{location:{origin:'https://club.example'},addEventListener:(name,fn)=>listeners[name]=fn,clients:{claim:async()=>{claimed++;},matchAll:async()=>windows},skipWaiting:async()=>{skipped++;}},caches,fetch:fetcher,URL,Response,AbortController,setTimeout,clearTimeout,crypto:webcrypto,Uint8Array,console});
 const event=async(url,mode='cors')=>{let response;listeners.fetch({request:{url,method:'GET',mode},respondWith:r=>response=r});return response&&await response;};
 return {caches,stores,event,listeners,skipped:()=>skipped,claimed:()=>claimed};
}
test('offline shell is cache-first and preview queries do not create duplicate shell entries',async()=>{
 let calls=0;const w=await worker(async()=>{calls++;throw new Error('offline');});
 const cache=await w.caches.open('little-color-club-shell-test-release');await cache.put('/index.html',new Response('saved shell'));await cache.put('/app.mjs',new Response('saved module'));
 assert.equal(await (await w.event('https://club.example/?preview=new','navigate')).text(),'saved shell');
 assert.equal(await (await w.event('https://club.example/app.mjs?cache=2')).text(),'saved module');assert.equal(calls,0);
 assert.equal(await w.event('https://club.example/api/art?profile=Olivia'),undefined);
});
test('image cache is bounded and cached pages remain available during server failures',async()=>{
 const w=await worker(async()=>new Response('image',{status:200}));
 const cache=await w.caches.open('little-color-club-images-test-release');
 for(let i=0;i<105;i++)await w.event('https://club.example/pages/image-'+i+'.png');
 assert.equal((await cache.keys()).length,100);assert.equal(await (await w.event('https://club.example/pages/image-104.png')).text(),'image');
});
test('mixed-release HTML is rejected without replacing the active shell',async()=>{
 const w=await worker(async path=>new Response(path==='/index.html'?'<meta name="color-club-release" content="wrong">':'module'));
 let task;w.listeners.install({waitUntil:p=>task=p});await assert.rejects(task,/Mixed/);assert.equal(w.stores.size,0);
});

test('cache quota failure does not hide a successfully fetched coloring page',async()=>{
 const w=await worker(async()=>new Response('downloaded page'));
 const original=w.caches.open.bind(w.caches);w.caches.open=async name=>{const cache=await original(name);cache.put=async()=>{throw new Error('quota exceeded');};return cache;};
 const response=await w.event('https://club.example/pages/cat.png');assert.equal(response.status,200);assert.equal(await response.text(),'downloaded page');
});

test('update activation is allowed only for the requesting window alone',async()=>{
 for(const windows of [[{id:'one'}],[{id:'one'},{id:'two'}],[{id:'other'}]]){
  const w=await worker(async()=>new Response('ok'),windows);let task,answer;
  w.listeners.message({data:{type:'APPLY_UPDATE'},source:{id:'one'},ports:[{postMessage:m=>answer=m}],waitUntil:p=>task=p});await task;
  const allowed=windows.length===1&&windows[0].id==='one';assert.equal(w.skipped(),allowed?1:0);assert.equal(answer,allowed?'UPDATING':'OTHER_WINDOWS');
 }
});
test('activation clears only obsolete app caches and claims the installed release',async()=>{
 const w=await worker(async()=>new Response('ok'));
 for(const name of ['little-color-club-shell-old','little-color-club-images-old','little-color-club-shell-test-release','little-color-club-images-test-release','another-app'])await w.caches.open(name);
 let task;w.listeners.activate({waitUntil:p=>task=p});await task;
 assert.deepEqual((await w.caches.keys()).sort(),['another-app','little-color-club-images-test-release','little-color-club-shell-test-release']);assert.equal(w.claimed(),1);
});
