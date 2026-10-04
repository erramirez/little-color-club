import {createHash} from 'node:crypto';
import {readdir, readFile, writeFile} from 'node:fs/promises';
let html=await readFile('dist/index.html','utf8');
html=html.replace(/  <meta name="color-club-release" content="[^"]+">\n/g,'');
await writeFile('dist/index.html',html);
const hashes = {};
for (const name of [...await readdir('dist'), ...((await readdir('dist/icons')).map(n => 'icons/' + n))]) {
  if (!/\.(mjs|html|css|webmanifest|png|svg)$/.test(name) || name === 'sw.js') continue;
  hashes['/' + name] = createHash('sha256').update(await readFile('dist/' + name)).digest('hex');
}
const pageHashes = await Promise.all((await readdir('dist/pages')).sort().map(async n =>
  createHash('sha256').update(await readFile('dist/pages/' + n)).digest('hex')));
const release = createHash('sha256').update(JSON.stringify(hashes) + pageHashes.join('')).digest('hex').slice(0, 16);
html=html.replace('<head>','<head>\n  <meta name="color-club-release" content="'+release+'">');
await writeFile('dist/index.html',html);
hashes['/index.html']=createHash('sha256').update(html).digest('hex');
const template = await readFile('scripts/sw-template.mjs', 'utf8');
await writeFile('dist/sw.js', template.replace('__RELEASE__', JSON.stringify(release)).replace('__HASHES__', JSON.stringify(hashes)));
console.log('Offline release prepared: ' + release);
