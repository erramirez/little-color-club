const DB_NAME='little-color-club-v2';let dbPromise;
export function openDB(){return dbPromise??=new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{req.result.createObjectStore('art',{keyPath:'key'});req.result.createObjectStore('settings')};req.onsuccess=()=>resolve(req.result);req.onerror=()=>{dbPromise=null;reject(req.error)}})}
async function run(store,mode,operation){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(store,mode),req=operation(tx.objectStore(store));let value;req.onsuccess=()=>value=req.result;tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
export const getSetting=k=>run('settings','readonly',s=>s.get(k));
export const setSetting=(k,v)=>run('settings','readwrite',s=>s.put(v,k));
export function artKey(family,profile,id){return `${family}:${profile}:${id}`}
export const putArt=a=>run('art','readwrite',s=>s.put(a));
export const getArt=key=>run('art','readonly',s=>s.get(key));
export async function listArt(family,profile){const all=await run('art','readonly',s=>s.getAll());return all.filter(a=>a.family===family&&a.profile===profile).sort((a,b)=>b.updatedAt-a.updatedAt)}
export async function pendingArt(family){const all=await run('art','readonly',s=>s.getAll());return all.filter(a=>a.family===family&&a.pending)}
