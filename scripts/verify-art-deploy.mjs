import {PAGES,pageThumbnail} from '../dist/library.mjs';
const origin=process.argv[2];
if(!/^https:\/\/[a-z0-9-]+\.netlify\.app$/.test(origin))throw new Error('Pass a Netlify URL.');
const hosted=await fetch(origin+'/library.mjs').then(r=>r.text());
if(!hosted.includes('v3-princess-garden')||!hosted.includes('pageThumbnail'))throw new Error('Old library deployed');
let cursor=0;
await Promise.all(Array.from({length:4},async()=>{
 while(cursor<PAGES.length){
  const p=PAGES[cursor++],r=await fetch(origin+p.image);
  if(!r.ok||!r.headers.get('content-type')?.startsWith('image/png'))throw new Error('Missing illustration: '+p.title);
  const bytes=new Uint8Array(await r.arrayBuffer());
  if(bytes.length<20000||bytes[0]!==137||bytes[1]!==80||bytes[2]!==78||bytes[3]!==71)throw new Error('Invalid illustration: '+p.title);
 }
}));
for(const theme of [...new Set(PAGES.map(p=>p.theme))]){
 const p=PAGES.find(p=>p.theme===theme),r=await fetch(origin+pageThumbnail(p));
 if(!r.ok||!r.headers.get('content-type')?.startsWith('image/'))throw new Error('Thumbnail failed: '+theme);
}
console.log('Verified '+PAGES.length+' hosted illustrations and thumbnails for '+new Set(PAGES.map(p=>p.theme)).size+' themes.');
