/* MEK-AI Mobile v0.5 - deterministic launcher desktop model.
   No DOM, no Android bridge. Every saved layout is normalized. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.MekCore=api;
})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const SYSTEM=new Set(['phone','messages','browser','camera','settings','mek','house','music','weather','calendar','files','drawer']);
const WIDGETS=new Set(['mek','clock','battery','tasks','notes','weather','music','house','calendar']);
const DEFAULTS={homeCols:4,homeRows:6,appCols:5,appRows:6,folderCols:4,folderRows:4,dockSlots:5,theme:'overgrown',dockStyle:'glass',iconSize:54,labels:true,motion:true,wallpaper:true,appSort:'alphabetical',homeDefault:'home-1',swipeUp:true,swipeDown:true,swipePages:true,layoutLocked:false,appLayout:'horizontal',widgetStackSwipe:true};
let seq=0;
function uid(prefix='item'){return prefix+'-'+Date.now().toString(36)+'-'+(++seq).toString(36);}
function clamp(value,min,max,fallback){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):fallback;}
function text(value,limit=60){return String(value==null?'':value).slice(0,limit);}
function packageOk(s){return typeof s==='string'&&s.length<190&&/^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/.test(s);}
function defaultState(){
  return {
    version:5,
    settings:{...DEFAULTS},
    current:'home-1',
    pages:[{id:'home-1',items:[
      {id:'intro',type:'widget',kind:'mek',x:0,y:0,w:4,h:2},
      {id:'clock-1',type:'widget',kind:'clock',x:0,y:2,w:2,h:2},
      {id:'battery-1',type:'widget',kind:'battery',x:2,y:2,w:2,h:1},
      {id:'task-1',type:'widget',kind:'tasks',x:0,y:4,w:4,h:2}
    ]}],
    dock:[
      {id:'dock-phone',type:'system',kind:'phone',label:'Phone'},
      {id:'dock-messages',type:'system',kind:'messages',label:'Messages'},
      {id:'dock-browser',type:'system',kind:'browser',label:'Browser'},
      {id:'dock-camera',type:'system',kind:'camera',label:'Camera'},
      null
    ],
    drawerOrder:[],
    drawerFolders:[],
    notes:'A little place for your thoughts.',
    tasks:[],
    wallpaperChoice:'workshop'
  };
}
function cleanItem(item,cols=4,rows=6,asDock=false){
  if(!item||typeof item!=='object')return null;
  if(!['app','system','folder','widget','android-widget','stack'].includes(item.type))return null;
  const out={id:/^[A-Za-z0-9_-]{1,90}$/.test(item.id||'')?item.id:uid(),type:item.type};
  if(item.type==='app'){
    if(!packageOk(item.pkg))return null;
    out.pkg=item.pkg;out.label=text(item.label||'App');
  }
  if(item.type==='system'){
    if(!SYSTEM.has(item.kind))return null;
    out.kind=item.kind;out.label=text(item.label||item.kind);
  }
  if(item.type==='widget'){
    if(asDock||!WIDGETS.has(item.kind))return null;
    out.kind=item.kind;
    if(item.config&&typeof item.config==='object')out.config={...item.config};
  }
  if(item.type==='stack'){
    if(asDock)return null;
    out.frameStyle=['transparent','outlined','panel','minimal'].includes(item.frameStyle)?
      item.frameStyle:'panel';
    out.stack=(Array.isArray(item.stack)?item.stack:[]).slice(0,10).filter(ch=>ch&&WIDGETS.has(ch.kind)).map(ch=>({id:uid('stack-child'),kind:ch.kind,config:ch.config&&typeof ch.config==='object'?{...ch.config}:{}}));
    if(!out.stack.length)return null;
    out.active=clamp(item.active,0,out.stack.length-1,0);
  }
  if(item.type==='android-widget'){
    if(asDock)return null;
    // Imported backups cannot restore Android's installation-local widget IDs.
    // Keep an explicit, inert placeholder until Android grants a NEW binding.
    if(item.needsRebind===true){
      out.nativeId=0;
      out.needsRebind=true;
    }else{
      out.nativeId=clamp(item.nativeId,1,1000000,-1);
      if(out.nativeId<1)return null;
    }
    out.label=text(item.label||'Android Widget');
    out.frameStyle=['transparent','outlined','panel','minimal'].includes(item.frameStyle)?
      item.frameStyle:'transparent';
    if(typeof item.provider==='string')out.provider=text(item.provider,240);
    if(item.limits&&typeof item.limits==='object'){
      out.limits={minW:clamp(item.limits.minW,1,cols,1),minH:clamp(item.limits.minH,1,rows,1),
        maxW:clamp(item.limits.maxW,1,cols,cols),maxH:clamp(item.limits.maxH,1,rows,rows),
        resizeH:item.limits.resizeH!==false,resizeV:item.limits.resizeV!==false};
    }
  }
  if(item.type==='folder'){
    out.name=text(item.name||'Folder',35);
    out.color=['olive','amber','rust','charcoal'].includes(item.color)?item.color:'olive';
    const used=new Set();
    out.apps=(Array.isArray(item.apps)?item.apps:[]).slice(0,100).reduce((acc,a)=>{
      if(a&&packageOk(a.pkg)&&!used.has(a.pkg)){
        used.add(a.pkg);acc.push({pkg:a.pkg,label:text(a.label||'App')});
      }
      return acc;
    },[]);
  }
  if(!asDock){
    out.x=clamp(item.x,0,cols-1,0);out.y=clamp(item.y,0,rows-1,0);
    out.w=(['widget','android-widget','stack'].includes(item.type))?clamp(item.w,1,cols,2):1;
    out.h=(['widget','android-widget','stack'].includes(item.type))?clamp(item.h,1,rows,2):1;
    out.w=Math.min(out.w,cols-out.x);out.h=Math.min(out.h,rows-out.y);
  }
  return out;
}
function inside(item,cols,rows){
  return item.x>=0&&item.y>=0&&item.w>=1&&item.h>=1&&item.x+item.w<=cols&&item.y+item.h<=rows;
}
function overlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
function clear(page,item,excludeId){return page.items.every(other=>other.id===excludeId||!overlap(item,other));}
function freePosition(page,item,cols,rows){
  for(let y=0;y<=rows-item.h;y++)for(let x=0;x<=cols-item.w;x++){
    const candidate={...item,x,y};
    if(clear(page,candidate))return {x,y};
  }
  return null;
}
function uniqueIds(model){
  const used=new Set();
  for(const p of model.pages)for(const a of p.items){
    if(used.has(a.id))a.id=uid();used.add(a.id);
  }
  for(const a of model.dock){if(!a)continue;if(used.has(a.id))a.id=uid();used.add(a.id);}
}
function normalize(input){
  const base=defaultState();
  if(!input||typeof input!=='object')return base;
  const st=input.settings||{};
  const s={...DEFAULTS};
  s.homeCols=clamp(st.homeCols,3,6,4);s.homeRows=clamp(st.homeRows,4,8,6);
  s.appCols=clamp(st.appCols,4,6,5);s.appRows=clamp(st.appRows,4,8,6);
  s.folderCols=clamp(st.folderCols,3,6,4);s.folderRows=clamp(st.folderRows,3,6,4);
  s.dockSlots=clamp(st.dockSlots,3,5,5);
  s.iconSize=clamp(st.iconSize,36,72,54);
  s.theme=['overgrown','amber','moss'].includes(st.theme)?st.theme:'overgrown';
  s.dockStyle=['glass','metal','none'].includes(st.dockStyle)?st.dockStyle:'glass';
  s.appSort=['alphabetical','custom'].includes(st.appSort)?st.appSort:'alphabetical';
  s.homeDefault=typeof st.homeDefault==='string'&&/^[A-Za-z0-9_-]{1,60}$/.test(st.homeDefault)?st.homeDefault:'home-1';
  s.labels=st.labels!==false;s.motion=st.motion!==false;s.wallpaper=st.wallpaper!==false;
  s.swipeUp=st.swipeUp!==false;s.swipeDown=st.swipeDown!==false;s.swipePages=st.swipePages!==false;
  s.layoutLocked=st.layoutLocked===true;s.appLayout=st.appLayout==='vertical'?'vertical':'horizontal';s.widgetStackSwipe=st.widgetStackSwipe!==false;
  const pages=[],ids=new Set();
  for(const p of (Array.isArray(input.pages)?input.pages:[]).slice(0,32)){
    if(!p||typeof p!=='object')continue;
    const id=/^[A-Za-z0-9_-]{1,60}$/.test(p.id||'')&&!ids.has(p.id)?p.id:uid('home');
    ids.add(id);
    const page={id,items:[]};
    for(const raw of (Array.isArray(p.items)?p.items:[]).slice(0,70)){
      const item=cleanItem(raw,s.homeCols,s.homeRows);
      if(!item)continue;
      // Instead of losing corrupted or old placements, relocate to an empty cell.
      if(!inside(item,s.homeCols,s.homeRows)||!clear(page,item)){
        const place=freePosition(page,item,s.homeCols,s.homeRows);
        if(!place)continue;
        item.x=place.x;item.y=place.y;
      }
      page.items.push(item);
    }
    pages.push(page);
  }
  if(!pages.length)pages.push({id:'home-1',items:[]});
  const dock=[],source=Array.isArray(input.dock)?input.dock:base.dock;
  for(const raw of source.slice(0,s.dockSlots)){
    if(raw===null){dock.push(null);continue;}
    dock.push(cleanItem(raw,1,1,true));
  }
  while(dock.length<s.dockSlots)dock.push(null);
  const result={
    version:5,settings:s,pages,dock,
    current:pages.some(p=>p.id===input.current)?input.current:pages[0].id,
    drawerOrder:Array.isArray(input.drawerOrder)?input.drawerOrder.filter(packageOk).slice(0,500):[],
    drawerFolders:[],notes:text(input.notes||base.notes,500),
    tasks:Array.isArray(input.tasks)?input.tasks.slice(0,60).filter(t=>t&&typeof t.text==='string').map(t=>({text:text(t.text,140),done:!!t.done})):[],
    wallpaperChoice:['workshop','solid'].includes(input.wallpaperChoice)?input.wallpaperChoice:'workshop'
  };
  const seenFolderIds=new Set();
  for(const f of (Array.isArray(input.drawerFolders)?input.drawerFolders:[]).slice(0,60)){
    const folder=cleanItem({...f,type:'folder'},1,1,true);
    if(folder&&!seenFolderIds.has(folder.id)){result.drawerFolders.push(folder);seenFolderIds.add(folder.id);}
  }
  uniqueIds(result);
  if(!pages.some(p=>p.id===s.homeDefault))s.homeDefault=pages[0].id;
  return result;
}
function pageById(model,id){return model.pages.find(p=>p.id===id);}
function locate(model,id){
  for(const page of model.pages){
    const index=page.items.findIndex(a=>a.id===id);
    if(index>=0)return {kind:'home',page,index,item:page.items[index]};
  }
  const index=model.dock.findIndex(a=>a&&a.id===id);
  if(index>=0)return {kind:'dock',index,item:model.dock[index]};
  const fi=model.drawerFolders.findIndex(a=>a.id===id);
  if(fi>=0)return {kind:'drawer',index:fi,item:model.drawerFolders[fi]};
  return null;
}
function addPage(model,after){
  if(model.pages.length>=32)return null;
  const p={id:uid('home'),items:[]};
  const i=model.pages.findIndex(x=>x.id===after);
  model.pages.splice(i<0?model.pages.length:i+1,0,p);
  return p;
}
function firstFit(model,item,start=0){
  const {homeCols:cols,homeRows:rows}=model.settings;
  for(let i=Math.max(0,start);i<model.pages.length;i++){
    const pos=freePosition(model.pages[i],item,cols,rows);
    if(pos)return {...pos,pageId:model.pages[i].id};
  }
  const fresh=addPage(model);
  if(!fresh)return null;
  const pos=freePosition(fresh,item,cols,rows);
  return pos?{...pos,pageId:fresh.id}:null;
}
function removeLocation(model,id){
  const l=locate(model,id);if(!l)return null;
  if(l.kind==='home')l.page.items.splice(l.index,1);
  if(l.kind==='dock')model.dock[l.index]=null;
  if(l.kind==='drawer')model.drawerFolders.splice(l.index,1);
  return l.item;
}
function addHome(model,item,pageId=null,pos=null){
  const data=cleanItem(item,model.settings.homeCols,model.settings.homeRows);
  if(!data)return null;
  const page=pageById(model,pageId||model.current)||model.pages[0];
  const cols=model.settings.homeCols,rows=model.settings.homeRows;
  let slot=null;
  if(pos){
    data.x=clamp(pos.x,0,cols-1,0);data.y=clamp(pos.y,0,rows-1,0);
    data.w=Math.min(data.w,cols-data.x);data.h=Math.min(data.h,rows-data.y);
    if(clear(page,data))slot={pageId:page.id,x:data.x,y:data.y};
  }
  if(!slot){
    const fit=freePosition(page,data,cols,rows);
    slot=fit?{...fit,pageId:page.id}:firstFit(model,data,model.pages.indexOf(page));
  }
  if(!slot)return null;
  data.x=slot.x;data.y=slot.y;
  pageById(model,slot.pageId).items.push(data);
  model.current=slot.pageId;
  return data;
}
function mergeFolder(model,sourceId,targetId){
  const source=locate(model,sourceId),target=locate(model,targetId);
  if(!source||!target||sourceId===targetId||source.item.type!=='app')return false;
  if(target.item.type==='folder'){
    if(target.item.apps.some(a=>a.pkg===source.item.pkg))return false;
    if(target.item.apps.length>=100)return false;
    target.item.apps.push({pkg:source.item.pkg,label:source.item.label});
    removeLocation(model,sourceId);
    return true;
  }
  if(target.item.type!=='app')return false;
  const at=target.kind==='home'?{x:target.item.x,y:target.item.y}:null;
  const destination=target.kind==='home'?target.page.id:target.kind;
  const folder={id:uid('folder'),type:'folder',name:'New Folder',color:'olive',
    apps:[{pkg:target.item.pkg,label:target.item.label},{pkg:source.item.pkg,label:source.item.label}]};
  removeLocation(model,sourceId);
  removeLocation(model,targetId);
  if(destination==='dock'){
    folder.x=0;folder.y=0;
    const slot=target.index;
    model.dock[slot]=cleanItem(folder,1,1,true);
  }else if(destination==='drawer'){
    model.drawerFolders.push(cleanItem(folder,1,1,true));
  }else addHome(model,folder,destination,at);
  return true;
}
function moveToHome(model,id,pageId,x,y){
  const loc=locate(model,id),page=pageById(model,pageId);
  if(!loc||!page)return false;
  const item=loc.item;
  const cols=model.settings.homeCols,rows=model.settings.homeRows;
  const test={...item,x:clamp(x,0,cols-1,0),y:clamp(y,0,rows-1,0),
    w:Math.min(item.w||1,cols),h:Math.min(item.h||1,rows)};
  test.x=Math.min(test.x,cols-test.w);test.y=Math.min(test.y,rows-test.h);
  const occupants=page.items.filter(other=>other.id!==id&&overlap(test,other));
  if(item.type==='app'&&occupants.length===1&&occupants[0].w===1&&occupants[0].h===1 &&
     (occupants[0].type==='app'||occupants[0].type==='folder')){
    return mergeFolder(model,id,occupants[0].id);
  }
  removeLocation(model,id);
  // Attempt to keep all displaced tiles. If an obstruction is found,
  // relocate it into the first empty area (or onto a new Home page).
  const target=pageById(model,pageId);
  const displaced=target.items.filter(a=>overlap(test,a));
  target.items=target.items.filter(a=>!displaced.includes(a));
  target.items.push({...test,x:test.x,y:test.y});
  for(const displacedItem of displaced){
    let fit=freePosition(target,displacedItem,cols,rows);
    if(!fit){
      const other=firstFit(model,displacedItem,model.pages.indexOf(target)+1);
      if(other){
        pageById(model,other.pageId).items.push({...displacedItem,x:other.x,y:other.y});
      }else{
        // Revert rather than silently delete an existing icon.
        target.items=target.items.filter(a=>a.id!==id);
        target.items.push(...displaced);
        addHome(model,item,loc.kind==='home'?loc.page.id:pageId,loc.kind==='home'?{x:loc.item.x,y:loc.item.y}:null);
        return false;
      }
    }else target.items.push({...displacedItem,x:fit.x,y:fit.y});
  }
  model.current=pageId;return true;
}
function addDock(model,item,slot){
  const s=clamp(slot,0,model.settings.dockSlots-1,0);
  const raw=cleanItem(item,1,1,true);if(!raw||raw.type==='widget')return false;
  const current=model.dock[s];
  model.dock[s]=raw;
  if(current){
    const placed=addHome(model,current,model.current);
    if(!placed){model.dock[s]=current;return false;}
  }
  return true;
}
function moveToDock(model,id,slot){
  const item=locate(model,id);if(!item||item.item.type==='widget')return false;
  if(item.kind==='dock'&&item.index===slot)return true;
  const existing=model.dock[slot]||null;
  const sourcePage=item.kind==='home'?item.page.id:model.current;
  removeLocation(model,id);
  model.dock[slot]=cleanItem(item.item,1,1,true);
  if(existing){
    if(item.kind==='dock')model.dock[item.index]=existing;
    else if(!addHome(model,existing,sourcePage)){
      model.dock[slot]=existing;
      addHome(model,item.item,sourcePage,item.kind==='home'?item.item:null);
      return false;
    }
  }
  return true;
}
function removeItem(model,id){return !!removeLocation(model,id);}
/* Atomic move: snapshot the complete model and roll back on any failed
   placement. This avoids data loss during cross-page drag, reflow or a
   full Home grid. */
function moveAtomic(model,id,pageId,x,y){
  const snapshot=JSON.parse(JSON.stringify(model));
  let ok=false;
  try{ok=moveToHome(model,id,pageId,x,y)===true;}catch(e){ok=false;}
  if(!ok){
    for(const key of Object.keys(model))delete model[key];
    Object.assign(model,snapshot);
  }
  return ok;
}
function removeSafe(model,id){
  const located=locate(model,id);
  if(!located)return false;
  removeLocation(model,id);
  return true;
}
/* Widgets can be a stack of built-in MEK-AI widgets. Each child keeps
   independent settings while all children share one grid rectangle. */
function addToStack(model,stackId,widget){
  const loc=locate(model,stackId);
  if(!loc||loc.kind!=='home')return false;
  const incoming=cleanItem(widget,model.settings.homeCols,model.settings.homeRows);
  if(!incoming||incoming.type!=='widget')return false;
  const destination=loc.item;
  if(destination.type==='widget'){
    const child={id:uid('stack-child'),kind:destination.kind,config:destination.config||{}};
    Object.assign(destination,{type:'stack',active:0,stack:[child]});
    delete destination.kind;delete destination.config;
  }
  if(destination.type!=='stack')return false;
  if(destination.stack.length>=10)return false;
  destination.stack.push({id:uid('stack-child'),kind:incoming.kind,config:incoming.config||{}});
  return true;
}
function removeStackChild(model,stackId,index){
  const loc=locate(model,stackId);
  if(!loc||loc.item.type!=='stack')return false;
  const stack=loc.item;
  if(index<0||index>=stack.stack.length)return false;
  stack.stack.splice(index,1);
  if(!stack.stack.length)return removeSafe(model,stackId);
  stack.active=Math.min(stack.active,stack.stack.length-1);
  if(stack.stack.length===1){
    stack.type='widget';stack.kind=stack.stack[0].kind;stack.config=stack.stack[0].config||{};
    delete stack.stack;delete stack.active;
  }
  return true;
}
function resize(model,id,w,h){
  const loc=locate(model,id);
  if(!loc||loc.kind!=='home'||!['widget','android-widget','stack'].includes(loc.item.type))return false;
  const cols=model.settings.homeCols,rows=model.settings.homeRows;
  const item=loc.item;
  const candidate={...item,w:clamp(w,1,cols,item.w),h:clamp(h,1,rows,item.h)};
  candidate.w=Math.min(candidate.w,cols-item.x);candidate.h=Math.min(candidate.h,rows-item.y);
  if(!clear(loc.page,candidate,id))return false;
  Object.assign(item,{w:candidate.w,h:candidate.h});return true;
}
/* Independently scale widget width and height. If another tile is in the
   way, move it to a free cell or a new page. All-or-nothing transactional
   update prevents silently losing anything when the page limit is reached. */
function resizeSmart(model,id,width,height){
  const trial=JSON.parse(JSON.stringify(model));
  const loc=locate(trial,id);
  if(!loc||loc.kind!=='home'||!['widget','android-widget','stack'].includes(loc.item.type))return false;
  const cols=trial.settings.homeCols,rows=trial.settings.homeRows;
  const item=loc.item;
  const w=clamp(width,1,cols,item.w),h=clamp(height,1,rows,item.h);
  if(item.type==='android-widget'&&item.limits){
    const lim=item.limits;
    if((w!==item.w&&!lim.resizeH)||(h!==item.h&&!lim.resizeV))return false;
    if(w<lim.minW||w>lim.maxW||h<lim.minH||h>lim.maxH)return false;
  }
  const candidate={...item,w,h,
    x:Math.min(item.x,cols-w),y:Math.min(item.y,rows-h)};
  if(!inside(candidate,cols,rows))return false;
  const index=trial.pages.indexOf(loc.page);
  const displaced=loc.page.items.filter(other=>other.id!==id&&overlap(candidate,other));
  loc.page.items=loc.page.items.filter(other=>other.id===id||!displaced.includes(other));
  Object.assign(item,{x:candidate.x,y:candidate.y,w,h});
  for(const other of displaced){
    const slot=freePosition(loc.page,other,cols,rows);
    if(slot){Object.assign(other,slot);loc.page.items.push(other);continue;}
    const destination=firstFit(trial,other,index+1);
    if(!destination)return false;
    const page=pageById(trial,destination.pageId);
    if(!page)return false;
    page.items.push({...other,x:destination.x,y:destination.y});
  }
  // Reassign only after every displaced tile has a safe destination.
  model.pages=trial.pages;
  model.current=trial.current;
  return true;
}
function reflow(model){
  const cols=model.settings.homeCols,rows=model.settings.homeRows;
  const original=model.pages.map(p=>({id:p.id,items:p.items.slice()}));
  model.pages=original.map(p=>({id:p.id,items:[]}));
  const overflow=[];
  for(let i=0;i<original.length;i++){
    for(const item of original[i].items){
      const t=cleanItem(item,cols,rows);
      if(!t)continue;
      if(inside(t,cols,rows)&&clear(model.pages[i],t)){
        model.pages[i].items.push(t);
      }else{
        const pos=freePosition(model.pages[i],t,cols,rows);
        if(pos)model.pages[i].items.push({...t,...pos});
        else overflow.push({item:t,start:i+1});
      }
    }
  }
  for(const {item,start} of overflow){
    const slot=firstFit(model,item,start);
    if(slot)pageById(model,slot.pageId).items.push({...item,x:slot.x,y:slot.y});
  }
}
function deletePage(model,id){
  if(model.pages.length<=1)return false;
  const page=pageById(model,id);if(!page)return false;
  const index=model.pages.indexOf(page);
  model.pages.splice(index,1);
  for(const item of page.items){
    const slot=firstFit(model,item,Math.max(0,index-1));
    if(slot)pageById(model,slot.pageId).items.push({...item,x:slot.x,y:slot.y});
    else{model.pages.splice(index,0,page);return false;}
  }
  if(model.current===id)model.current=model.pages[Math.min(index,model.pages.length-1)].id;
  if(model.settings.homeDefault===id)model.settings.homeDefault=model.pages[0].id;
  return true;
}
function reorderPage(model,id,delta){
  const index=model.pages.findIndex(p=>p.id===id),target=index+delta;
  if(index<0||target<0||target>=model.pages.length)return false;
  const [page]=model.pages.splice(index,1);model.pages.splice(target,0,page);return true;
}
function migrateLegacy(storage){
  const fresh=defaultState();
  if(typeof storage!=='function')return fresh;
  function load(k,def){try{const value=storage(k);return value===null||value===undefined?def:JSON.parse(value);}catch(e){return def;}}
  const old=load('mek_mobile_grid_v2',null);
  const cols=clamp(load('mek_mobile_columns_v2',4),3,6,4);
  fresh.settings.homeCols=cols;
  const legacyRows=load('mek_mobile_home_rows_v4',6);
  fresh.settings.homeRows=clamp(legacyRows,4,8,6);
  fresh.settings.appCols=clamp(load('mek_mobile_app_cols_v4',5),4,6,5);
  fresh.settings.appRows=clamp(load('mek_mobile_app_rows_v4',6),4,8,6);
  fresh.settings.folderCols=clamp(load('mek_mobile_folder_cols_v4',4),3,6,4);
  fresh.settings.folderRows=clamp(load('mek_mobile_folder_rows_v4',4),3,6,4);
  const theme=load('mek_mobile_theme_v2','overgrown');
  if(['overgrown','amber','moss'].includes(theme))fresh.settings.theme=theme;
  fresh.settings.wallpaper=load('mek_mobile_wallpaper_v1',true)!==false;
  fresh.settings.motion=load('mek_mobile_reduce_motion_v1',false)!==true;
  fresh.tasks=load('mek_mobile_tasks_v1',[]);
  fresh.notes=load('mek_mobile_note_v2',fresh.notes);
  if(!Array.isArray(old)||!old.length)return normalize(fresh);
  fresh.pages=[{id:'home-1',items:[]}];
  const mapping={clock:[2,2],battery:[2,1],weather:[2,1],mek:[cols,2],
    tasks:[cols,2],notes:[cols,2],music:[cols,1]};
  for(const oldItem of old){
    if(!oldItem||(oldItem.type==='shortcut'&&oldItem.kind==='drawer'))continue;
    const type=oldItem.type==='shortcut'?'system':oldItem.type;
    let candidate={id:oldItem.id,type,kind:oldItem.kind,label:oldItem.label,pkg:oldItem.pkg,
      name:oldItem.name,apps:oldItem.apps,w:1,h:1,x:0,y:0};
    if(type==='widget'||mapping[type]){
      candidate.type='widget';candidate.kind=oldItem.type;
      const [w,h]=mapping[oldItem.type]||[1,1];candidate.w=w;candidate.h=h;
    }
    if(candidate.type==='system'&&candidate.kind==='drawer')continue;
    addHome(fresh,candidate,fresh.pages[fresh.pages.length-1].id);
  }
  return normalize(fresh);
}
return {DEFAULTS,SYSTEM,WIDGETS,uid,clamp,packageOk,defaultState,normalize,cleanItem,
  inside,overlap,clear,freePosition,pageById,locate,addPage,firstFit,addHome,
  removeLocation,mergeFolder,moveToHome,moveAtomic,removeSafe,addToStack,removeStackChild,addDock,moveToDock,removeItem,resize,resizeSmart,reflow,deletePage,reorderPage,migrateLegacy};
});