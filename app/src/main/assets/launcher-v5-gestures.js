/* MEK-AI v0.5 gestures: long-press, swipe, actual drag/drop, page-edge transfer. */
(function(){
'use strict';
const M=window.Mek,C=M.Core,$=M.$;
const HOLD_MS=490,MOVE_TOLERANCE=12,SWIPE_DISTANCE=65;
let press=null,holdTimer=null,edgeTimer=null,edgeDirection=0,mouseDown=false;
const touchPoint=e=>e.changedTouches&&e.changedTouches.length?e.changedTouches[0]:
  e.touches&&e.touches.length?e.touches[0]:e;
function isIn(node,selector){return !!(node&&node.closest&&node.closest(selector));}
function clearTimer(){if(holdTimer){clearTimeout(holdTimer);holdTimer=null;}}
function clearEdge(){if(edgeTimer){clearTimeout(edgeTimer);edgeTimer=null;}edgeDirection=0;}
function validScene(){
  return $('sheetOverlay').classList.contains('hidden')&&
    $('homeSetup').classList.contains('hidden');
}
function sourceFrom(node){
  const container=node&&node.closest&&node.closest('[data-loc]');
  if(!container)return null;
  const loc=container.dataset.loc;
  let item=null;
  if(loc==='home'||loc==='dock'){
    const found=C.locate(M.model,container.dataset.uid);
    if(!found)return null;
    item=found.item;
  }
  if(loc==='drawer'){
    const pkg=container.dataset.pkg,uid=container.dataset.uid;
    if(pkg)item=M.apps.find(a=>a.pkg===pkg);
    if(!item&&uid)item=M.systemCatalog.find(a=>a.id===uid)||
      M.model.drawerFolders.find(a=>a.id===uid);
  }
  if(loc==='folder'){
    const folder=M.findFolder(M.activeFolder);
    const app=folder?.apps.find(a=>a.pkg===container.dataset.pkg);
    if(app)item={id:C.uid('external-app'),type:'app',pkg:app.pkg,label:app.label};
  }
  if(!item)return null;
  return {item,loc,container,uid:item.id,pkg:item.pkg||null};
}
function sourceTouchesDisabled(target){
  return isIn(target,'.sheet-overlay,.home-setup,.terminal-status,input,textarea,[contenteditable="true"]');
}
function atStart(x,y,target){
  clearTimer();clearEdge();
  if(!validScene()||sourceTouchesDisabled(target))return;
  if(M.model.settings.layoutLocked && M.view==='home' && !M.activeFolder){
    // Locked Home still permits swipe/tap navigation, not editing or drag.
    press={x,y,lastX:x,lastY:y,when:Date.now(),route:'home',source:null,resize:null,
      moved:false,longPressed:false,armed:false,scrollStart:0};
    return;
  }
  const mode=M.activeFolder?'folder':M.view;
  const source=sourceFrom(target);
  const resizeButton=target.closest?.('.cell-resize,.cell-resize-width,.cell-resize-height');
  let resize=null;
  if(resizeButton&&M.edit){
    const cell=resizeButton.closest('.grid-cell');
    const loc=cell&&C.locate(M.model,cell.dataset.uid);
    if(loc&&loc.kind==='home'&&['widget','android-widget','stack'].includes(loc.item.type)){
      const direction=resizeButton.classList.contains('cell-resize-width')?'width':
        resizeButton.classList.contains('cell-resize-height')?'height':'both';
      resize={id:loc.item.id,w:loc.item.w,h:loc.item.h,
        x:loc.item.x,y:loc.item.y,cell,moved:false,direction,
        previewW:loc.item.w,previewH:loc.item.h};
    }
  }
  press={x,y,lastX:x,lastY:y,when:Date.now(),route:mode,source,resize,
    moved:false,longPressed:false,armed:false,scrollStart:$('drawerPages')?.scrollLeft||0};
  if(resize)return;
  if(source&&['home','dock','drawer','folder'].includes(source.loc)){
    holdTimer=setTimeout(()=>{
      holdTimer=null;
      if(!press||press.moved)return;
      press.longPressed=true;press.armed=true;
      source.container?.classList.add('held-item');
      M.gestureSuppressUntil=Date.now()+500;
      if(navigator.vibrate)try{navigator.vibrate(9);}catch(e){}
    },HOLD_MS);
  }else if(mode==='home'&&!M.edit){
    holdTimer=setTimeout(()=>{
      holdTimer=null;
      if(!press||press.moved)return;
      press.longPressed=true;
      M.enterEdit();
      M.gestureSuppressUntil=Date.now()+550;
      if(navigator.vibrate)try{navigator.vibrate(10);}catch(e){}
    },HOLD_MS);
  }
}
function beginDrag(p,x,y){
  const source=p.source;if(!source||M.drag)return;
  source.container?.classList.remove('held-item');
  // A lifted drawer icon stays in the drawer until it is dragged upward
  // toward Home. Dropping on another library app creates a folder; dropping
  // between icons changes just this icon's ordering.
  if(source.loc==='folder'){
    // Keep the folder open: dragging within it changes only that app's order.
    // Moving out of the folder can still place it on Home.
  }else if(source.loc!=='drawer'&&!M.edit)M.enterEdit();
  const ghost=$('dragGhost');
  ghost.textContent='';
  ghost.append(M.iconDom(source.item,{noLabel:false}));
  ghost.classList.remove('hidden');
  M.drag={source,item:{...source.item},startX:p.x,startY:p.y,x,y,moved:true,target:null};
  ghost.style.left=x+'px';ghost.style.top=y+'px';
  M.gestureSuppressUntil=Date.now()+1100;
  document.querySelectorAll('[data-uid]').forEach(node=>{
    if(node.dataset.uid===source.uid)node.classList.add('drag-origin');
  });
  if(navigator.vibrate)try{navigator.vibrate(12);}catch(e){}
}
function previewWidgetResize(p,x,y,event){
  const r=p.resize;if(!r)return;
  if(event?.cancelable)event.preventDefault();
  const page=r.cell.closest('.home-page');
  const bounds=page?.getBoundingClientRect();
  const cols=M.model.settings.homeCols,rows=M.model.settings.homeRows;
  const cellWidth=bounds?.width>0?bounds.width/cols:76;
  const cellHeight=bounds?.height>0?bounds.height/rows:92;
  const item=C.locate(M.model,r.id)?.item;
  const lim=item?.type==='android-widget'?item.limits:null;
  // Resize one axis at a time with ↔ or ↕, or both with ⤡.
  // Only native widget provider limits restrict the available range.
  const widthChange=r.direction!=='height'&&(!lim||lim.resizeH!==false);
  const heightChange=r.direction!=='width'&&(!lim||lim.resizeV!==false);
  const minW=lim?.minW||1,maxW=lim?.maxW||cols;
  const minH=lim?.minH||1,maxH=lim?.maxH||rows;
  const w=widthChange?Math.max(minW,Math.min(maxW,Math.max(1,
    Math.min(cols,r.w+Math.round((x-p.x)/cellWidth))))):r.w;
  const h=heightChange?Math.max(minH,Math.min(maxH,Math.max(1,
    Math.min(rows,r.h+Math.round((y-p.y)/cellHeight))))):r.h;
  r.previewW=w;r.previewH=h;r.moved=r.moved||w!==r.w||h!==r.h;
  r.cell.classList.add('resizing');
  r.cell.dataset.resizeLabel=w+' × '+h;
  r.cell.style.setProperty('--w',Math.min(cols-r.x,w));
  r.cell.style.setProperty('--h',Math.min(rows-r.y,h));
  M.gestureSuppressUntil=Date.now()+600;
}
function move(x,y,event){
  if(!press)return;
  press.lastX=x;press.lastY=y;
  if(press.resize){previewWidgetResize(press,x,y,event);return;}
  const delta=Math.hypot(x-press.x,y-press.y);
  if(press.armed&&!M.drag&&delta>15)beginDrag(press,x,y);
  if(delta>MOVE_TOLERANCE&&!press.armed){
    press.moved=true;
    clearTimer();
  }
  if(!M.drag)return;
  M.drag.x=x;M.drag.y=y;
  M.drag.moved=true;
  if(event&&event.cancelable)event.preventDefault();
  const ghost=$('dragGhost');ghost.style.left=x+'px';ghost.style.top=y+'px';
  // Dragging upward out of the app archive exposes the actual Home grid.
  if(M.drag.source.loc==='drawer'&&M.view==='drawer'&&y<135){
    M.setView('home');M.enterEdit();
    M.gestureSuppressUntil=Date.now()+950;
  }
  if(M.drag.source.loc==='folder'&&M.activeFolder&&y<95){
    M.closeFolder();M.setView('home');M.enterEdit();
    M.gestureSuppressUntil=Date.now()+950;
  }
  highlightTarget(x,y);
  maybeSwitchPage(x);
}
function maybeSwitchPage(x){
  if(!M.drag||!['home','drawer'].includes(M.view)){clearEdge();return;}
  const width=$('launcherShell').getBoundingClientRect().width||window.innerWidth;
  const side=x<32?-1:x>width-32?1:0;
  if(side===edgeDirection)return;
  clearEdge();edgeDirection=side;
  if(!side)return;
  edgeTimer=setTimeout(()=>{
    if(!M.drag)return;
    if(M.view==='drawer'){
      M.changeDrawerPage(edgeDirection);
    }else{
      const current=M.model.pages.findIndex(p=>p.id===M.model.current);
      const next=current+edgeDirection;
      if(next>=0&&next<M.model.pages.length){
        M.goPage(M.model.pages[next].id);
      }else if(next===M.model.pages.length&&M.model.pages.length<32){
        M.mutate(model=>{const page=C.addPage(model,model.current);if(page)model.current=page.id;});
        M.goPage(M.model.current);
      }
    }
    clearEdge();
  },670);
}
function highlightTarget(x,y){
  document.querySelectorAll('.drop-candidate').forEach(n=>n.classList.remove('drop-candidate'));
  const el=document.elementFromPoint?.(x,y);
  const target=el&&el.closest('[data-loc]');
  if(target&&['home','dock','drawer','folder'].includes(target.dataset.loc)){
    target.classList.add('drop-candidate');
    M.drag.target=target;
  }else M.drag.target=null;
}
function homePoint(x,y){
  if(M.view!=='home')return null;
  const page=document.querySelector('.home-page[data-page="'+M.model.current+'"]');
  if(!page)return null;
  const rect=page.getBoundingClientRect();
  if(x<rect.left||x>rect.right||y<rect.top||y>rect.bottom)return null;
  const cols=M.model.settings.homeCols,rows=M.model.settings.homeRows;
  const col=Math.max(0,Math.min(cols-1,Math.floor((x-rect.left)/rect.width*cols)));
  const row=Math.max(0,Math.min(rows-1,Math.floor((y-rect.top)/rect.height*rows)));
  return {pageId:M.model.current,x:col,y:row};
}
function dockIndex(x,y){
  const rect=$('dock').getBoundingClientRect();
  if(x<rect.left||x>rect.right||y<rect.top||y>rect.bottom)return null;
  const count=M.model.settings.dockSlots;
  return Math.max(0,Math.min(count-1,Math.floor((x-rect.left)/rect.width*count)));
}
function dropOnHome(item,source,pageId,x,y){
  let result=false;
  if(source.loc==='home'||source.loc==='dock'){
    result=M.mutate(model=>C.moveAtomic(model,item.id,pageId,x,y));
  }else if(source.loc==='folder'){
    const clone={...item,id:C.uid('app'),x,y,w:1,h:1};
    result=M.mutate(model=>{
      const added=C.addHome(model,clone,pageId,{x,y});
      if(!added)return false;
      const folder=M.findFolder(M.activeFolder||source.folderId);
      if(folder)folder.apps=folder.apps.filter(a=>a.pkg!==item.pkg);
      return true;
    });
  }else{
    const copy={...item,id:C.uid('home'),x,y,w:1,h:1};
    result=M.mutate(model=>{
      const added=C.addHome(model,copy,pageId,{x,y});
      if(!added)return false;
      if(added.x!==x||added.y!==y){
        C.moveToHome(model,added.id,pageId,x,y);
      }
      return true;
    });
  }
  return result!==false&&result!=null;
}
function dropOnDock(item,source,slot){
  let result=false;
  if(item.type==='widget')return false;
  if(source.loc==='home'||source.loc==='dock'){
    result=M.mutate(model=>C.moveToDock(model,item.id,slot));
  }else{
    const copy={...item,id:C.uid('favorite')};
    result=M.mutate(model=>C.addDock(model,copy,slot));
    if(source.loc==='folder'&&result){
      const folder=M.findFolder(source.folderId);
      if(folder)M.mutate(()=>{folder.apps=folder.apps.filter(a=>a.pkg!==item.pkg);});
    }
  }
  return result!==false&&result!=null;
}
function finalizeDrag(x,y){
  clearEdge();
  const dragging=M.drag;if(!dragging)return;
  const {source,item}=dragging;
  let completed=false;
  if(source.loc==='folder'&&M.activeFolder){
    const target=dragging.target||document.elementFromPoint?.(x,y)?.closest?.('[data-loc="folder"]');
    completed=!!M.moveFolderApp?.(source.folderId,item.pkg,source.folderId,
      target?.dataset.loc==='folder'?target.dataset.pkg:null);
  }else if(source.loc==='drawer'&&M.view==='drawer'){
    // Drag an individual app within the library. A drop on another app
    // creates a folder; a drop elsewhere moves only this app's position.
    const target=dragging.target||document.elementFromPoint?.(x,y)?.closest?.('[data-loc="drawer"]');
    let destination=null;
    if(target?.dataset.loc==='drawer'){
      const pkg=target.dataset.pkg;
      const id=target.dataset.uid;
      destination=pkg?M.apps.find(a=>a.pkg===pkg):M.drawerSnapshot?.find(a=>a.id===id);
    }
    completed=!!M.organizeDrawerDrop(item,destination);
  }else{
    const dock=dockIndex(x,y);
    const home=homePoint(x,y);
    if(dock!==null){
      completed=dropOnDock(item,source,dock);
      if(completed)M.toast('FAVORITES UPDATED');
    }else if(home){
      completed=dropOnHome(item,source,home.pageId,home.x,home.y);
      if(completed)M.toast('HOME SCREEN UPDATED');
    }
    if(!completed&&source.loc==='drawer'&&M.view==='home'){
      // A lifted app dragged to Home may land on unused space instead of
      // an exact cell. In that case place just that app in the next free slot.
      const added=M.mutate(model=>C.addHome(model,{...item,id:C.uid('home'),x:0,y:0,w:1,h:1},model.current));
      if(added){completed=true;M.toast('APP ADDED TO HOME');}
    }
    if(!completed&&source.loc==='folder'){
      const added=M.mutate(model=>C.addHome(model,{...item,id:C.uid('home'),x:0,y:0,w:1,h:1},model.current));
      if(added){
        const folder=M.findFolder(source.folderId);
        if(folder)M.mutate(()=>{folder.apps=folder.apps.filter(a=>a.pkg!==item.pkg);});
        completed=true;M.toast('MOVED APP TO HOME');
      }
    }
  }
  M.drag=null;
  $('dragGhost').classList.add('hidden');$('dragGhost').textContent='';
  document.querySelectorAll('.drop-candidate,.drag-origin,.held-item').forEach(n=>{
    n.classList.remove('drop-candidate','drag-origin','held-item');
  });
  M.gestureSuppressUntil=Date.now()+580;
  M.render();
  if(!completed)M.toast('APP WAS NOT MOVED');
}
M.endDrag=function(cancel=false){
  clearEdge();clearTimer();press=null;
  document.querySelectorAll('.held-item').forEach(n=>n.classList.remove('held-item'));
  if(this.drag){
    if(!cancel)finalizeDrag(this.drag.x,this.drag.y);
    else{
      this.drag=null;
      $('dragGhost').classList.add('hidden');$('dragGhost').textContent='';
      document.querySelectorAll('.drop-candidate,.drag-origin').forEach(n=>n.classList.remove('drop-candidate','drag-origin'));
      this.render();
    }
  }
};
function finish(x,y){
  clearTimer();clearEdge();
  const p=press;press=null;
  if(!p)return;
  p.source?.container?.classList.remove('held-item');
  if(p.resize){
    const r=p.resize;
    if(!r.moved){
      M.openSheet('resize',{id:r.id});
    }else{
      const done=M.mutate(model=>C.resizeSmart(model,r.id,r.previewW,r.previewH));
      if(!done)M.toast('NOT ENOUGH ROOM TO RESIZE');
      M.renderHome();
    }
    M.gestureSuppressUntil=Date.now()+550;
    return;
  }
  if(M.drag){finalizeDrag(x,y);return;}
  if(p.longPressed){
    M.gestureSuppressUntil=Date.now()+600;
    if(p.source?.loc==='drawer'){
      M.openSheet('app-actions',{item:p.source.item});
    }else if(p.source?.loc==='folder'){
      M.openSheet('folder-app-actions',{app:p.source.item});
    }else if(p.source?.loc==='home'||p.source?.loc==='dock'){
      M.enterEdit();
    }
    return;
  }
  const dx=x-p.x,dy=y-p.y;
  if(Math.max(Math.abs(dx),Math.abs(dy))<SWIPE_DISTANCE)return;
  if(Math.abs(dx)>Math.abs(dy)*1.24){
    if(p.route==='home'&&!M.edit&&p.source?.item?.type==='stack'&&M.model.settings.widgetStackSwipe!==false){
      M.changeStack(p.source.uid,dx<0?1:-1);
      M.gestureSuppressUntil=Date.now()+400;
    }else if(p.route==='home'&&!M.edit&&M.model.settings.swipePages!==false){
      M.stepPage(dx<0?1:-1);M.gestureSuppressUntil=Date.now()+420;
    }else if(p.route==='folder'&&M.activeFolder){
      M.goFolderPage(M.folderPage+(dx<0?1:-1));
    }else if(p.route==='drawer'){
      const pane=$('drawerPages');
      const moved=Math.abs(pane.scrollLeft-p.scrollStart);
      const width=pane.clientWidth;
      if(width===0 || moved<width*.32)M.changeDrawerPage(dx<0?1:-1);
    }
  }else if(Math.abs(dy)>Math.abs(dx)*1.25){
    if(p.route==='home'&&!M.edit&&dy<0&&M.model.settings.swipeUp!==false){
      M.setView('drawer');M.gestureSuppressUntil=Date.now()+430;
    }else if(p.route==='drawer'&&dy>0&&M.model.settings.swipeDown!==false){
      const scroller=$('drawerPages');
      const vertical=M.model.settings.appLayout==='vertical';
      if(!vertical||((scroller?.scrollTop||0)<=3&&dy>115)){
        M.setView('home');M.gestureSuppressUntil=Date.now()+430;
      }
    }
  }
}
function cancel(){clearTimer();clearEdge();press?.source?.container?.classList.remove('held-item');press=null;M.endDrag(true);}
M.installGestures=function(){
  this.installUi();
  // Touch events are required: Samsung WebView may cancel pointer events
  // once its scroll recognizer starts, but touchend still captures gestures.
  document.addEventListener('touchstart',event=>{
    if(event.touches.length!==1){cancel();return;}
    const t=event.touches[0];atStart(t.clientX,t.clientY,event.target);
    if(press&&press.source?.loc==='folder')press.source.folderId=M.activeFolder;
  },{passive:true});
  document.addEventListener('touchmove',event=>{
    if(event.touches.length!==1)return;
    const t=event.touches[0];move(t.clientX,t.clientY,event);
  },{passive:false});
  document.addEventListener('touchend',event=>{
    if(!event.changedTouches.length)return;
    const t=event.changedTouches[0];finish(t.clientX,t.clientY);
  },{passive:true});
  document.addEventListener('touchcancel',()=>cancel(),{passive:true});
  // Desktop and Chromebook browser tests work with the mouse as well.
  document.addEventListener('pointerdown',event=>{
    if(event.pointerType==='touch'||event.button!==0)return;
    mouseDown=true;atStart(event.clientX,event.clientY,event.target);
    if(press&&press.source?.loc==='folder')press.source.folderId=M.activeFolder;
  });
  document.addEventListener('pointermove',event=>{
    if(event.pointerType==='touch'||!mouseDown)return;
    move(event.clientX,event.clientY,event);
  });
  document.addEventListener('pointerup',event=>{
    if(event.pointerType==='touch'||!mouseDown)return;
    mouseDown=false;finish(event.clientX,event.clientY);
  });
  document.addEventListener('pointercancel',()=>{mouseDown=false;cancel();});
  document.addEventListener('contextmenu',event=>{
    const source=sourceFrom(event.target);
    if(!source||!validScene())return;
    event.preventDefault();
    if(press?.longPressed)return; // touchend chooses tap-options or drag
    clearTimer();press=null;
    if(source.loc==='drawer')this.openSheet('app-actions',{item:source.item});
    else if(source.loc==='folder')this.openSheet('folder-app-actions',{app:source.item});
    else if(source.loc==='home'||source.loc==='dock')this.enterEdit();
  });
  document.addEventListener('keydown',event=>{
    if(event.target.matches('input,textarea'))return;
    if(this.view==='home'&&(event.key==='ArrowLeft'||event.key==='ArrowRight')){
      event.preventDefault();this.stepPage(event.key==='ArrowLeft'?1:-1);
    }
    if(this.view==='drawer'&&(event.key==='ArrowLeft'||event.key==='ArrowRight')){
      event.preventDefault();this.changeDrawerPage(event.key==='ArrowLeft'?1:-1);
    }
  });
};
})();
