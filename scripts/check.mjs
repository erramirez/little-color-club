import {readFileSync,existsSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {PAGES} from '../dist/library.mjs';
for(const file of ['app.mjs','core.mjs','library.mjs','storage.mjs','sync.mjs','sw.js'])execFileSync(process.execPath,['--check','dist/'+file]);
const manifest=JSON.parse(readFileSync('dist/manifest.webmanifest'));for(const icon of manifest.icons)if(!existsSync('dist'+icon.src))throw new Error('Missing app icon '+icon.src);
const html=readFileSync('dist/index.html','utf8'),app=readFileSync('dist/app.mjs','utf8');for(const match of app.matchAll(/\$\('([^']+)'\)/g))if(!html.includes(`id="${match[1]}"`))throw new Error('Missing UI element '+match[1]);
if(PAGES.length!==56)throw new Error('Library is incomplete');execFileSync(process.execPath,['--test','tests/core.test.mjs','tests/api.test.mjs','tests/storage-sync.test.mjs'],{stdio:'inherit'});console.log('App modules, UI references, 56 pages, install manifest, and tests checked.');
