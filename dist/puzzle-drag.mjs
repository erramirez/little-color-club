// Upward movement (or a brief hold) picks up a touch piece. Sideways movement
// remains native tray scrolling. Pointer cancellation never places a piece.
export function puzzleSlotAtPoint(rect,grid,x,y){
  const left=rect.left+6,top=rect.top+6,width=rect.width-12,height=rect.height-12;
  if(width<=0||height<=0||x<left||y<top||x>=left+width||y>=top+height)return null;
  return Math.floor((y-top)*grid.rows/height)*grid.cols+Math.floor((x-left)*grid.cols/width);
}
export function bindPuzzleDrag(piece,{canStart,select,makeGhost,onDrop,highlight,clearHighlight,document:doc=globalThis.document}){
  let gesture=null,suppressClick=false;
  const moveGhost=(g,x,y)=>{g.style.left=x+'px';g.style.top=y+'px'};
  function start(){
    if(!gesture||gesture.mode!=='pending'||!canStart())return;
    gesture.mode='drag';clearTimeout(gesture.hold);select();gesture.ghost=makeGhost();doc.body.append(gesture.ghost);moveGhost(gesture.ghost,gesture.x,gesture.y);
    piece.classList.add('drag-source');
  }
  function finish(cancel,e){
    if(!gesture)return;const old=gesture;gesture=null;clearTimeout(old.hold);
    old.ghost?.remove();piece.classList.remove('drag-source');clearHighlight();
    if(old.mode==='drag'){suppressClick=true;if(!cancel)onDrop(e.clientX,e.clientY)}
    else if(old.mode==='scroll')suppressClick=true;
    try{piece.releasePointerCapture(old.id)}catch{}
  }
  const originalClick=piece.onclick;
  piece.onclick=e=>{if(suppressClick){suppressClick=false;return}originalClick?.(e)};
  piece.onpointerdown=e=>{
    if(!canStart()||e.isPrimary===false||(e.pointerType==='mouse'&&e.button!==0))return;
    // A second interaction has its own click; a suppressed drag click must not swallow it.
    suppressClick=false;gesture={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,mode:'pending'};
    try{piece.setPointerCapture(e.pointerId)}catch{}
    gesture.hold=setTimeout(start,220);
  };
  piece.onpointermove=e=>{
    if(!gesture||e.pointerId!==gesture.id)return;
    gesture.x=e.clientX;gesture.y=e.clientY;
    const dx=e.clientX-gesture.startX,dy=e.clientY-gesture.startY;
    if(gesture.mode==='pending'){
      if(e.pointerType==='mouse'&&Math.hypot(dx,dy)>6)start();
      else if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)*1.15)start();
      else if(Math.abs(dx)>10){gesture.mode='scroll';clearTimeout(gesture.hold)}
    }
    if(gesture.mode==='drag'){e.preventDefault();moveGhost(gesture.ghost,e.clientX,e.clientY);highlight(e.clientX,e.clientY)}
  };
  piece.onpointerup=e=>{if(gesture&&e.pointerId===gesture.id)finish(false,e)};
  piece.onpointercancel=e=>{if(gesture&&e.pointerId===gesture.id)finish(true,e)};
  piece.onlostpointercapture=e=>{if(gesture&&e.pointerId===gesture.id)finish(true,e)};
  return ()=>{if(gesture)finish(true,{clientX:gesture.x,clientY:gesture.y})};
}
