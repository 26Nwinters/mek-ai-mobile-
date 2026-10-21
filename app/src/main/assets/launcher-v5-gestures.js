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
  let mode=M.view;
  if(M.activeFolder)mode='folder';
  const source=sourceFrom(target);
  press={x,y,lastX:x,lastY:y,when:Date.now(),route:mode,source,
    moved:false,longPressed:false,scrollStart:$('drawerPages')?.scrollLeft||0};
  if(source && ['home','dock','drawer','folder'].includes(source.loc)){
    holdTimer=setTimeout(()=>{
      holdTimer=null;
      if(!press||press.moved)return;
      press.longPressed=true;
      beginDrag(press,x,y);
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
  // Normal Android behavior: holding an icon in the app drawer lifts it
  // onto the Home desktop. No button or intermediate tab is needed.
  if(source.loc==='drawer'){
    if(source.item.type==='folder'){
      // Folders in app archive can also be pinned as a Home shortcut.
      M.setView('home');M.enterEdit();
    }else{M.setView('home');M.enterEdit();}
  }else if(source.loc==='folder'){
    M.closeFolder();M.setView('home');M.enterEdit();
  }else if(!M.edit)M.enterEdit();
  const ghost=$('dragGhost');
  ghost.textContent='';
  ghost.append(M.iconDom(source.item,{noLabel:false}));
  ghost.classList.remove('hidden');
  M.drag={source,item:{...source.item},startX:p.x,startY:p.y,x,y,moved:false,target:null};
  ghost.style.left=x+'px';ghost.style.top=y+'px';
  M.gestureSuppressUntil=Date.now()+1100;
  // Rerender during edit creates new nodes; identify original by ID.
  document.querySelectorAll('[data-uid]').forEach(node=>{
    if(node.dataset.uid===source.uid)node.classList.add('drag-origin');
  });
  if(navigator.vibrate)try{navigator.vibrate(12);}catch(e){}
}
function move(x,y,event){
  if(!press)return;
  press.lastX=x;press.lastY=y;
  const delta=Math.hypot(x-press.x,y-press.y);
  if(delta>MOVE_TOLERANCE){
    press.moved=true;
    clearTimer();
  }
  if(!M.drag)return;
  M.drag.x=x;M.drag.y=y;
  M.drag.moved=M.drag.moved||delta>12;
  if(event&&event.cancelable)event.preventDefault();
  const ghost=$('dragGhost');ghost.style.left=x+'px';ghost.style.top=y+'px';
  highlightTarget(x,y);
  maybeSwitchPage(x);
}
function maybeSwitchPage(x){
  if(!M.drag || M.view!=='home'){clearEdge();return;}
  const width=$('launcherShell').getBoundingClientRect().width;
  const side=x<32?-1:x>width-32?1:0;
  if(side===edgeDirection)return;
  clearEdge();edgeDirection=side;
  if(!side)return;
  edgeTimer=setTimeout(()=>{
    if(!M.drag)return;
    const current=M.model.pages.findIndex(p=>p.id===M.model.current);
    const next=current+edgeDirection;
    if(next>=0&&next<M.model.pages.length){
      M.goPage(M.model.pages[next].id);
      M.toast('HOME PAGE '+(next+1));
    }else if(next===M.model.pages.length&&M.model.pages.length<32){
      M.mutate(model=>{const page=C.addPage(model,model.current);if(page)model.current=page.id;});
      M.goPage(M.model.current);
      M.toast('NEW HOME PAGE');
    }
    clearEdge();
  },660);
}
function highlightTarget(x,y){
  document.querySelectorAll('.drop-candidate').forEach(n=>n.classList.remove('drop-candidate'));
  const el=document.elementFromPoint?.(x,y);
  const target=el&&el.closest('[data-loc]');
  if(target && (target.dataset.loc==='home'||target.dataset.loc==='dock')){
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
    result=M.mutate(model=>C.moveToHome(model,item.id,pageId,x,y));
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
  const dock=dockIndex(x,y);
  const home=homePoint(x,y);
  let completed=false;
  if(dock!==null){
    completed=dropOnDock(item,source,dock);
    if(completed)M.toast('FAVORITES UPDATED');
  }else if(home){
    completed=dropOnHome(item,source,home.pageId,home.x,home.y);
    if(completed)M.toast('HOME SCREEN UPDATED');
  }
  if(!completed&&source.loc==='drawer'){
    // If the app was picked up but not dropped on a cell, still add to Home.
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
  M.drag=null;
  $('dragGhost').classList.add('hidden');$('dragGhost').textContent='';
  document.querySelectorAll('.drop-candidate,.drag-origin').forEach(n=>n.classList.remove('drop-candidate','drag-origin'));
  M.gestureSuppressUntil=Date.now()+580;
  M.render();
  if(!completed&&source.loc==='drawer'&&!dragging.moved){
    M.openSheet('app-actions',{item:source.item});
  }else if(!completed&&source.loc==='folder'&&!dragging.moved){
    M.openFolder(source.folderId);
    M.openSheet('folder-app-actions',{app:source.item});
  }else if(!completed&&dragging.moved)M.toast('NO AVAILABLE DROP LOCATION');
}
M.endDrag=function(cancel=false){
  clearEdge();clearTimer();press=null;
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
  if(M.drag){finalizeDrag(x,y);return;}
  if(p.longPressed)return;
  const dx=x-p.x,dy=y-p.y;
  if(Math.max(Math.abs(dx),Math.abs(dy))<SWIPE_DISTANCE)return;
  if(Math.abs(dx)>Math.abs(dy)*1.24){
    if(p.route==='home'&&!M.edit&&M.model.settings.swipePages!==false){
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
      M.setView('home');M.gestureSuppressUntil=Date.now()+430;
    }
  }
}
function cancel(){clearTimer();clearEdge();press=null;M.endDrag(true);}
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
