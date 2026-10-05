import test from 'node:test';
import assert from 'node:assert/strict';
import {watchStudioPaper} from '../dist/studio-layout.mjs';
test('paper follows available cell height after controls wrap, custom colors appear, or a save banner opens',()=>{
 let bounds={width:744,height:650}, resized, observed;
 const styles={}, stage={getBoundingClientRect:()=>bounds}, paper={style:{setProperty:(k,v)=>styles[k]=v}};
 const fit=watchStudioPaper(stage,paper,{Observer:class {constructor(callback){resized=callback;}observe(target){observed=target;}},window:{addEventListener(){}}});
 assert.equal(observed,stage);assert.equal(styles['--paper-side'],'650px');
 for(const height of [574,502,438,650]){bounds.height=height;resized();assert.equal(styles['--paper-side'],height+'px');}
 bounds={width:360,height:520};assert.equal(fit(),360);
 bounds={width:1200,height:1100};assert.equal(fit(),900);
 bounds={width:0,height:0};assert.equal(fit(),0);
});
test('viewport and orientation changes refit the paper when ResizeObserver is unavailable',()=>{
 const callbacks={}, viewport={},styles={};let bounds={width:900,height:600};
 watchStudioPaper({getBoundingClientRect:()=>bounds},{style:{setProperty:(k,v)=>styles[k]=v}},{Observer:null,window:{addEventListener:(n,f)=>callbacks[n]=f,visualViewport:{addEventListener:(n,f)=>viewport[n]=f}}});
 bounds={width:600,height:900};callbacks.orientationchange();assert.equal(styles['--paper-side'],'600px');
 bounds.height=370;viewport.resize();assert.equal(styles['--paper-side'],'370px');
 bounds.width=310;callbacks.resize();assert.equal(styles['--paper-side'],'310px');
});
