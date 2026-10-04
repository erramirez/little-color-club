import test from 'node:test';import assert from 'node:assert/strict';
import {puzzleGrid,shuffled,PuzzleClock,formatTime,floodFill,validateArtwork,normalizePairCode} from '../dist/core.mjs';
import {compositePixels,erasePixels} from './pixel-oracle.mjs';
import {puzzleSlotAtPoint} from '../dist/puzzle-drag.mjs';
import {PAGES,THEMES,pageById,pageThumbnail} from '../dist/library.mjs';
test('unique coloring pages cover every theme',()=>{assert.ok(PAGES.length);assert.equal(new Set(PAGES.map(p=>p.id)).size,PAGES.length);for(const theme of THEMES.filter(t=>t!=='All'))assert.ok(PAGES.some(p=>p.theme===theme));});
test('every requested puzzle count has exact row/column mapping',()=>{for(const count of [9,16,24,36]){const {rows,cols}=puzzleGrid(count);assert.equal(rows*cols,count);const order=shuffled(Array.from({length:count},(_,i)=>i));assert.equal(new Set(order).size,count);for(let i=0;i<count;i++)assert.equal(Math.floor(i/cols)*cols+i%cols,i)}assert.throws(()=>puzzleGrid(4));assert.throws(()=>puzzleGrid(50))});
test('timer starts on demand, excludes pauses, freezes at completion',()=>{let now=0;const clock=new PuzzleClock(()=>now);now=10000;assert.equal(clock.elapsed,0);clock.start();now=12500;assert.equal(clock.elapsed,2500);clock.pause();now=90000;assert.equal(clock.elapsed,2500);clock.start();now=93500;clock.finish();assert.equal(clock.elapsed,6000);now=120000;clock.start();assert.equal(clock.elapsed,6000);assert.equal(clock.running,false);clock.reset();assert.equal(clock.elapsed,0);assert.equal(formatTime(61000),'1:01')});
test('fill respects outlines and erasing reveals unchanged base pixels',()=>{const width=7,height=5,base=new Uint8ClampedArray(width*height*4).fill(255),paint=new Uint8ClampedArray(base.length);for(let y=0;y<height;y++){const k=(y*width+3)*4;base[k]=base[k+1]=base[k+2]=30}const original=base.slice();assert.equal(floodFill(base,paint,width,height,1,2,[237,113,128]),true);assert.deepEqual(Array.from(paint.slice((2*width+5)*4,(2*width+5)*4+4)),[0,0,0,0]);const result=compositePixels(base,paint);assert.equal(result[(2*width+1)*4],237);assert.equal(result[(2*width+3)*4],30);erasePixels(paint,width,height,1,2,1.5);assert.equal(compositePixels(base,paint)[(2*width+1)*4],255);assert.deepEqual(base,original);assert.equal(floodFill(base,paint,width,height,3,2,[255,0,0]),false)});
test('brush colors cannot hide dark original lines',()=>{const base=new Uint8ClampedArray([0,0,0,255,255,255,255,255]),paint=new Uint8ClampedArray([255,0,0,255,255,0,0,255]);assert.deepEqual(Array.from(compositePixels(base,paint)),[0,0,0,255,255,0,0,255]);erasePixels(paint,2,1,0,0,10);assert.deepEqual(compositePixels(base,paint),base)});
test('family code normalizes copy-friendly hyphens and rejects short codes',()=>{assert.equal(normalizePairCode('ABCD1234-'.repeat(8)),'abcd1234'.repeat(8));assert.throws(()=>normalizePairCode('1234'))});
test('editable files reject markup, external image URLs, and invalid profiles',()=>{const a={id:'test-art-id',profile:'Olivia',title:'Test',pageId:'garden',updatedAt:1,paint:'data:image/png;base64,AA==',thumbnail:'data:image/webp;base64,AA=='};assert.equal(validateArtwork(a),true);assert.equal(validateArtwork({...a,profile:'Unknown'}),false);assert.equal(validateArtwork({...a,customBase:'data:image/svg+xml;base64,AA=='}),false);assert.equal(validateArtwork({...a,paint:'https://example.org/picture.png'}),false)});

test('new library uses only full-resolution illustrations and efficient previews',()=>{assert.ok(PAGES.every(p=>p.id.startsWith('v3-')&&p.image.startsWith('/pages/')));assert.equal(pageById('cat'),undefined);assert.equal(pageById('v3-cat').image,'/pages/cat.png');assert.equal(pageById('elsa'),undefined);assert.ok(pageThumbnail(pageById('v3-cat')).startsWith('/.netlify/images?'));assert.equal(pageById('missing-page'),undefined)});

test('family phrases normalize spaces and mixed case but require exactly three words',()=>{assert.equal(normalizePairCode(' Purple DOG kite '),'purple-dog-kite');assert.equal(normalizePairCode('purple — dog–kite'),'purple-dog-kite');for(const input of ['purple-dog','purple-dog-kite-boat','purple-12-kite',null])assert.throws(()=>normalizePairCode(input))});

test('drag coordinates map to every slot and reject drops outside the board',()=>{
 const rect={left:70,top:40,width:420,height:420};for(const count of [9,16,24,36]){const g=puzzleGrid(count);for(let i=0;i<count;i++){const x=76+(i%g.cols+.5)*408/g.cols,y=46+(Math.floor(i/g.cols)+.5)*408/g.rows;assert.equal(puzzleSlotAtPoint(rect,g,x,y),i)}assert.equal(puzzleSlotAtPoint(rect,g,69,100),null);assert.equal(puzzleSlotAtPoint(rect,g,500,100),null);assert.equal(puzzleSlotAtPoint(rect,g,100,40),null)}
});

test('black and dark-brown paint can be refilled while original dark outlines remain barriers',()=>{
 const base=new Uint8ClampedArray([255,255,255,255,0,0,0,255,255,255,255,255]);
 const paint=new Uint8ClampedArray([38,55,70,255,0,0,0,0,98,64,50,255]);
 const original=base.slice();assert.equal(floodFill(base,paint,3,1,0,0,[255,213,74]),true);
 assert.deepEqual(Array.from(paint.slice(0,4)),[255,213,74,255]);assert.equal(floodFill(base,paint,3,1,2,0,[77,159,232]),true);
 assert.equal(floodFill(base,paint,3,1,1,0,[255,0,0]),false);assert.deepEqual(base,original);
});

test('large local editable backups can re-import even when their cloud payload needs attention',()=>{
 const a={id:'large-art-id',profile:'Olivia',title:'Dense drawing',pageId:'v3-cat',updatedAt:1,paint:'data:image/png;base64,'+'A'.repeat(2300000),thumbnail:'data:image/png;base64,AA=='};
 assert.equal(validateArtwork(a),false);assert.equal(validateArtwork(a,{local:true}),true);
});
