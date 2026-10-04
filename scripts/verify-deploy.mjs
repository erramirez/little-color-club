import {readFile} from 'node:fs/promises';
const origin=process.argv[2];
if(!/^https:\/\/[a-z0-9-]+\.netlify\.app$/.test(origin))throw new Error('Pass a Netlify URL.');
const manifest=JSON.parse(await readFile(new URL('../dist/manifest.webmanifest',import.meta.url),'utf8'));
const paths=new Set(['/','/style.css','/app.mjs','/library.mjs','/core.mjs','/storage.mjs','/sync.mjs','/puzzle-drag.mjs','/textured-paint.mjs','/sw.js','/manifest.webmanifest','/icons/crayons.svg','/icons/crayons-apple.png',...manifest.icons.map(i=>i.src)]);
for(const path of paths){
 const response=await fetch(origin+path);
 if(!response.ok)throw new Error(path+' returned '+response.status);
 if(path==='/'){
  const html=await response.text();for(const name of ['Olivia','Henry','Issa'])if(!html.includes(name))throw new Error('Missing profile '+name);
  if(!response.headers.get('content-security-policy'))throw new Error('Missing security headers');
 }
 if(path.endsWith('.mjs')&&!/javascript/.test(response.headers.get('content-type')||''))throw new Error('Incorrect module MIME type');
}
const unauthorized=await fetch(origin+'/api/art?profile=Olivia');
if(unauthorized.status!==401)throw new Error('Missing family key accepted');
console.log('Verified app shell, current install icons, security headers and unauthenticated API rejection. No cloud records created.');
