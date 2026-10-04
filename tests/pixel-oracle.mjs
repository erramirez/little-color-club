// Mathematical test oracle for canvas multiply/destination-out; not a browser-rendering test.
// Color pixels live separately from the original page. Multiply keeps outlines visible.
export function compositePixels(base,paint){const result=new Uint8ClampedArray(base.length);for(let k=0;k<base.length;k+=4){const a=paint[k+3]/255;for(let c=0;c<3;c++)result[k+c]=base[k+c]*(1-a)+base[k+c]*paint[k+c]/255*a;result[k+3]=255}return result}
export function erasePixels(paint,width,height,x,y,radius){for(let py=Math.max(0,Math.floor(y-radius));py<Math.min(height,y+radius+1);py++)for(let px=Math.max(0,Math.floor(x-radius));px<Math.min(width,x+radius+1);px++)if((px-x)**2+(py-y)**2<=radius**2)paint[(py*width+px)*4+3]=0;return paint}
