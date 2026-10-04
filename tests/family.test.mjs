import test from 'node:test';import assert from 'node:assert/strict';
import {handleFamily,generatePassphrase} from '../netlify/functions/_shared/family-handler.mjs';
class Store{data=new Map();async getWithMetadata(k){const v=this.data.get(k);return v?{data:v}:null}async setJSON(k,v,{onlyIfNew}){if(onlyIfNew&&this.data.has(k))return {modified:false};this.data.set(k,v);return {modified:true}}}
const req=(body,token)=>new Request('https://club.example/api/family',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://club.example',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
test('a short phrase connects to the existing family key; unknown phrases never create families',async()=>{
 const store=new Store(),token='a'.repeat(64);let calls=0;const generator=()=>{calls++;return 'purple-dog-kite'};
 const first=await handleFamily(req({action:'register'},token),store,generator);assert.equal(first.status,200);assert.equal((await first.json()).passphrase,'purple-dog-kite');
 const repeat=await (await handleFamily(req({action:'register'},token),store,generator)).json();assert.equal(repeat.passphrase,'purple-dog-kite');assert.equal(calls,1);
 const joined=await (await handleFamily(req({action:'join',passphrase:'Purple DOG kite'}),store)).json();assert.equal(joined.family,token);assert.equal(joined.passphrase,'purple-dog-kite');
 const count=store.data.size;assert.equal((await handleFamily(req({action:'join',passphrase:'purple-cat-kite'}),store)).status,404);assert.equal(store.data.size,count);
});
test('phrase collision retries without joining an unrelated family; concurrent registrations agree',async()=>{
 const store=new Store(),one='b'.repeat(64),two='c'.repeat(64);await handleFamily(req({action:'register'},one),store,()=> 'blue-dog-kite');let n=0;
 const second=await (await handleFamily(req({action:'register'},two),store,()=>n++===0?'blue-dog-kite':'red-cat-boat')).json();assert.equal(second.passphrase,'red-cat-boat');assert.equal((await (await handleFamily(req({action:'join',passphrase:'blue-dog-kite'}),store)).json()).family,one);
 const other=new Store();const candidates=['green-fox-moon','orange-bear-tree'];let i=0;const answers=await Promise.all([handleFamily(req({action:'register'},one),other,()=>candidates[i++]),handleFamily(req({action:'register'},one),other,()=>candidates[i++])]);const phrases=await Promise.all(answers.map(async r=>(await r.json()).passphrase));assert.equal(phrases[0],phrases[1]);
});
test('pairing rejects invalid input, missing device keys and foreign-origin requests',async()=>{
 const store=new Store();assert.equal((await handleFamily(req({action:'register'}),store)).status,401);assert.equal((await handleFamily(req({action:'join',passphrase:'purple-dog'}),store)).status,400);assert.equal((await handleFamily(req({action:'join',passphrase:'a'.repeat(64)}),store)).status,400);const foreign=req({action:'register'},'d'.repeat(64));foreign.headers.set('Origin','https://elsewhere.example');assert.equal((await handleFamily(foreign,store)).status,403);
 for(let i=0;i<30;i++)assert.match(generatePassphrase(),/^[a-z]{2,16}-[a-z]{2,16}-[a-z]{2,16}$/);
});
