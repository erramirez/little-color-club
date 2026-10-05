import test from 'node:test';
import assert from 'node:assert/strict';
import {manageUpdates} from '../dist/updates.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
function setup({safe=true,failSave=false,answer='UPDATING',waiting=true}={}) {
 const events={},calls=[];
 const reg={waiting:waiting?{postMessage(message){calls.push(message.type);queueMicrotask(()=>port.onmessage({data:answer}));}}:null,async update(){calls.push('check');},addEventListener(){}};
 const sw={controller:{},addEventListener(n,fn){events[n]=fn;},async register(url,options){calls.push(options.updateViaCache);return reg;}};
 let port;const flags={safe,failSave};
 const manager=manageUpdates({serviceWorker:sw,isSafe:()=>flags.safe,save:async()=>{calls.push('save');if(flags.failSave)throw new Error('full');},lock:()=>calls.push('lock'),unlock:()=>calls.push('unlock'),status:m=>calls.push(m),reload:()=>calls.push('reload'),channel:()=>{port={close(){}};return {port1:port,port2:{}}},later:()=>1,cancel(){}});
 return {manager,flags,calls,events,reg};
}
test('idle update saves before activation and reloads only when controller changes',async()=>{
 const u=setup();await u.manager.ready;await tick();
 assert.ok(u.calls.indexOf('lock')<u.calls.indexOf('save'));assert.ok(u.calls.indexOf('save')<u.calls.indexOf('APPLY_UPDATE'));assert.ok(!u.calls.includes('reload'));
 u.events.controllerchange();assert.ok(u.calls.includes('reload'));assert.ok(u.calls.includes('none'));
});
test('coloring and puzzles defer activation until a safe screen',async()=>{
 const u=setup({safe:false});await u.manager.ready;await tick();assert.ok(!u.calls.includes('save'));assert.ok(!u.calls.includes('APPLY_UPDATE'));
 u.flags.safe=true;u.manager.available();await tick();assert.ok(u.calls.includes('APPLY_UPDATE'));
});
test('failed local save never activates or reloads',async()=>{
 const u=setup({failSave:true});await u.manager.ready;await tick();assert.ok(u.calls.includes('unlock'));assert.ok(!u.calls.includes('APPLY_UPDATE'));assert.ok(!u.calls.includes('reload'));
});
test('another open window defers update and unlocks the current app',async()=>{
 const u=setup({answer:'OTHER_WINDOWS'});await u.manager.ready;await tick();assert.ok(u.calls.includes('unlock'));assert.ok(u.calls.some(x=>x.startsWith('Close other')));assert.ok(!u.calls.includes('reload'));
});
test('first service-worker claim does not reload a new installation',async()=>{
 const events={};let reloads=0;
 const manager=manageUpdates({serviceWorker:{controller:null,addEventListener(n,f){events[n]=f;},async register(){return {addEventListener(){},async update(){}};}},isSafe:()=>true,save:async()=>{},lock(){},unlock(){},status(){},reload(){reloads++;}});
 await manager.ready;events.controllerchange();assert.equal(reloads,0);
});
