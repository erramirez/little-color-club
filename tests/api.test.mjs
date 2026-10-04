import test from 'node:test';import assert from 'node:assert/strict';
import {handleArt as realHandleArt} from '../netlify/functions/_shared/art-handler.mjs';
const registered={getWithMetadata:async()=>({data:{passphrase:'purple-dog-kite'}})};
const handleArt=(req,store)=>realHandleArt(req,store,registered);
class MemoryStore{constructor(){this.data=new Map();this.counter=0}async getWithMetadata(key){const v=this.data.get(key);return v?{data:v.data,etag:v.etag}:null}async list({prefix}){return {blobs:[...this.data.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key}))}}async setJSON(key,data,options){const current=this.data.get(key);if((options.onlyIfNew&&current)||(options.onlyIfMatch&&current?.etag!==options.onlyIfMatch))return {modified:false};const etag='revision-'+(++this.counter);this.data.set(key,{data,etag});return {modified:true,etag}}}
const art={id:'test-artwork-id',profile:'Olivia',title:'Ocean',pageId:'fish',paint:'data:image/png;base64,AA==',thumbnail:'data:image/webp;base64,AA==',customBase:null,updatedAt:1,revision:'first'};
function request(token,method='GET',profile='Olivia',body,id){return new Request(`https://color.example/api/art?profile=${profile}${id?'&id='+id:''}`,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Origin:'https://color.example'},...(body?{body:JSON.stringify(body)}:{})})}
test('same family shares art across devices; child and family galleries stay isolated',async()=>{const store=new MemoryStore(),token='a'.repeat(64);assert.equal((await handleArt(request(token,'PUT','Olivia',{art,etag:null},art.id),store)).status,200);const listing=await (await handleArt(request(token),store)).json();assert.equal(listing.arts[0].title,'Ocean');const remote=await (await handleArt(request(token,'GET','Olivia',null,art.id),store)).json();assert.equal(remote.art.paint,art.paint);assert.equal((await (await handleArt(request(token,'GET','Henry'),store)).json()).arts.length,0);assert.equal((await (await handleArt(request('b'.repeat(64)),store)).json()).arts.length,0);assert.equal((await handleArt(request('a'),store)).status,401)});
test('stale writes cannot overwrite newer artwork; current revision can update',async()=>{const store=new MemoryStore(),token='c'.repeat(64);const first=await (await handleArt(request(token,'PUT','Olivia',{art,etag:null},art.id),store)).json();assert.equal((await handleArt(request(token,'PUT','Olivia',{art,etag:null},art.id),store)).status,409);assert.equal((await handleArt(request(token,'PUT','Olivia',{art:{...art,title:'New color'},etag:first.etag},art.id),store)).status,200);assert.equal((await handleArt(request(token,'PUT','Olivia',{art:{...art,title:'Stale color'},etag:first.etag},art.id),store)).status,409);const current=await (await handleArt(request(token,'GET','Olivia',null,art.id),store)).json();assert.equal(current.art.title,'New color')});
test('invalid profile, mismatched artwork identity, foreign-origin writes rejected',async()=>{const store=new MemoryStore(),token='d'.repeat(64);assert.equal((await handleArt(request(token,'GET','Intruder'),store)).status,400);assert.equal((await handleArt(request(token,'PUT','Henry',{art,etag:null},art.id),store)).status,400);const req=request(token,'PUT','Olivia',{art,etag:null},art.id);req.headers.set('origin','https://foreign.example');assert.equal((await handleArt(req,store)).status,403)});

test('unregistered keys cannot write and PNG thumbnails are accepted after registration',async()=>{const store=new MemoryStore(),token='e'.repeat(64);assert.equal((await realHandleArt(request(token,'PUT','Olivia',{art,etag:null},art.id),store,{getWithMetadata:async()=>null})).status,403);assert.equal((await handleArt(request(token,'PUT','Olivia',{art:{...art,thumbnail:'data:image/png;base64,AA=='},etag:null},art.id),store)).status,200);});

test('gallery pages are bounded, use summaries and include tombstones that block stale resurrection',async()=>{
 const store=new MemoryStore(),token='f'.repeat(64);
 for(let i=0;i<14;i++){const a={...art,id:'gallery-art-'+String(i).padStart(2,'0')};assert.equal((await handleArt(request(token,'PUT','Olivia',{art:a,etag:null},a.id),store)).status,200);}
 // Real list entries include the payload ETag. Assert no full records are read after summaries exist.
 const originalList=store.list.bind(store);store.list=async opts=>{const result=await originalList(opts);return {blobs:result.blobs.map(b=>({...b,etag:store.data.get(b.key).etag}))};};
 const originalGet=store.getWithMetadata.bind(store);let payloadReads=0;store.getWithMetadata=async key=>{if(!key.startsWith('_'))payloadReads++;return originalGet(key);};
 const first=await (await handleArt(request(token),store)).json();assert.equal(first.arts.length,12);assert.ok(first.nextCursor);assert.equal(payloadReads,0);
 const next=request(token);const url=new URL(next.url);url.searchParams.set('cursor',first.nextCursor);
 const last=await (await handleArt(new Request(url,{headers:next.headers}),store)).json();assert.equal(last.arts.length,2);assert.equal(last.nextCursor,null);
 const current=await (await handleArt(request(token,'GET','Olivia',null,'gallery-art-00'),store)).json();
 const beforeBudget=(await store.getWithMetadata('_budget/v1')).data.total;
 const removed={...current.art,deleted:true,paint:'',thumbnail:'',customBase:null,revision:'delete-version'};
 assert.equal((await handleArt(request(token,'PUT','Olivia',{art:removed,etag:current.etag},removed.id),store)).status,200);
 assert.ok((await store.getWithMetadata('_budget/v1')).data.total<beforeBudget);
 const deleted=await (await handleArt(request(token,'GET','Olivia',null,removed.id),store)).json();
 assert.equal((await handleArt(request(token,'PUT','Olivia',{art:current.art,etag:deleted.etag},removed.id),store)).status,409);
});
test('concurrent storage reservations enforce the site ceiling and large bodies stop before JSON parsing',async()=>{
 const store=new MemoryStore(),token='1'.repeat(64);store.data.set('_budget/v1',{data:{families:{},total:512*1024*1024-5000,count:0},etag:'initial-budget'});
 const answers=await Promise.all([0,1].map(i=>handleArt(request(token,'PUT','Olivia',{art:{...art,id:'quota-art-'+i},etag:null},'quota-art-'+i),store)));
 assert.deepEqual(answers.map(a=>a.status).sort(),[200,413]);
 const huge=new Request('https://color.example/api/art?profile=Olivia&id=oversize-art',{method:'PUT',headers:{Authorization:'Bearer '+token,Origin:'https://color.example'},body:'x'.repeat(4500001)});
 assert.equal((await handleArt(huge,store)).status,413);
});
