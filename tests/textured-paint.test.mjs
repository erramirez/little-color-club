import test from 'node:test';
import assert from 'node:assert/strict';
import {beginTexture, textureSegment} from '../dist/textured-paint.mjs';
const blank = () => ({width:64,height:64,data:new Uint8ClampedArray(64*64*4)});
const from={x:12,y:32}, to={x:52,y:32};
for (const style of ['watercolor','crayon']) {
 test(`${style}: translucent textured coverage; repeated gestures deepen color`,()=>{
  const image=blank();textureSegment(beginTexture(image,style,'#ff0000',18,1),from,to);
  const i=(32*64+32)*4, first=image.data[i+3];
  assert.ok(first>0&&first<255);assert.equal(image.data[i],255);assert.equal(image.data[0],0);
  const alphas=new Set();for(let x=16;x<48;x++)alphas.add(image.data[(32*64+x)*4+3]);assert.ok(alphas.size>5);
  textureSegment(beginTexture(image,style,'#ff0000',18,2),from,to);assert.ok(image.data[i+3]>first);
  textureSegment(beginTexture(image,style,'#0000ff',18,3),from,to);assert.ok(image.data[i]>0&&image.data[i+2]>0);
 });
 test(`${style}: coverage is independent of event frequency and does not accumulate within one gesture`,()=>{
  const single=blank(),many=blank();const a=beginTexture(single,style,'#336699',18,4),b=beginTexture(many,style,'#336699',18,4);
  textureSegment(a,from,to);
  for(let x=12;x<52;x++)textureSegment(b,{x,y:32},{x:x+1,y:32});
  assert.deepEqual(many.data,single.data);const snapshot=new Uint8ClampedArray(single.data);textureSegment(a,to,from);assert.deepEqual(single.data,snapshot);
 });
}
