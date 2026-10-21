/* MEK-AI v0.5 desktop UI, folders and app archive. */
(function(){
'use strict';
const M=window.Mek,C=M.Core,$=M.$;
const WIDGET_DEFAULTS={
  mek:[4,2],clock:[2,2],battery:[2,1],tasks:[4,2],notes:[4,2],
  weather:[2,1],music:[4,1],house:[4,1],calendar:[2,1]
};
M.applyPrefs=function(){
  const s=this.model.settings;
  document.body.classList.remove('theme-overgrown','theme-amber','theme-moss','dock-glass','dock-metal','dock-none');
  document.body.classList.add('theme-'+s.theme,'dock-'+s.dockStyle);
  document.body.classList.toggle('solid-wallpaper',!s.wallpaper||this.model.wallpaperChoice==='solid');
  document.body.classList.toggle('hide-icon-labels',!s.labels);
  document.body.classList.toggle('reduce-motion',!s.motion);
  document.body.style.setProperty('--icon-size',s.iconSize+'px');
  document.body.style.setProperty('--dock-slots',s.dockSlots);
};
M.iconDom=function(item,options={}){
  const root=document.createElement('button');
  root.type='button';root.className='icon-tile';
  const symbol=document.createElement('span');
  symbol.className='app-symbol';
  const label=document.createElement('span');label.className='icon-label';
  let name=item.label||item.name||item.kind||'Application';
  if(item.type==='app'){
    const initial=document.createElement('span');
    initial.textContent=name.charAt(0).toUpperCase()||'?';
    symbol.append(initial);
    symbol.classList.add('app-installed');
    // Actual native icons replace the initial letter asynchronously.
    this.loadIcon(symbol,item.pkg);
  }else if(item.type==='folder'){
    symbol.className='folder-symbol '+(item.color||'olive');
    (item.apps||[]).slice(0,4).forEach(app=>{
      const mini=document.createElement('span');mini.className='folder-mini';
      mini.textContent=(app.label||'?').charAt(0).toUpperCase();
      symbol.append(mini);
      this.loadIcon(mini,app.pkg);
    });
    for(let i=symbol.children.length;i<4;i++){
      const mini=document.createElement('span');mini.className='folder-mini';mini.textContent='·';symbol.append(mini);
    }
  }else{
    symbol.textContent=this.systemGlyphs[item.kind]||'◈';
    symbol.classList.add('system-'+item.kind);
  }
  label.textContent=name;
  root.append(symbol,label);
  if(options.noLabel)label.style.display='none';
  root.setAttribute('aria-label',name);
  return root;
};
M.widgetDom=function(item){
  const widget=document.createElement('div');
  widget.className='widget-tile widget-'+(item.kind==='mek'?'robot':item.kind);
  if(item.kind==='house')widget.classList.add('widget-shortcut');
  switch(item.kind){
    case 'mek':{
      const robot=document.createElement('img');robot.src='mek.webp';robot.alt='';
      const copy=document.createElement('div');copy.className='widget-robot-copy';
      copy.innerHTML='<span class="micro-label amber">● COMPANION ONLINE</span><strong>MEK<em>-AI</em></strong><small>Keeper of the Hideaway.</small><span class="robot-hint">SAY HELLO ↗</span>';
      widget.append(robot,copy);break;
    }
    case 'clock':{
      widget.innerHTML='<div class="widget-overline">CHRONO / LOCAL</div><canvas class="clock-canvas" width="300" height="76"></canvas><div class="widget-foot date-text"></div>';break;
    }
    case 'battery':{
      widget.innerHTML='<div class="widget-overline">POWER CELL / LIVE</div><div class="widget-big-number battery-percent">--%</div><div class="widget-battery-track"><span class="battery-fill" style="width:0%"></span></div><div class="widget-foot battery-status">READING DEVICE</div>';break;
    }
    case 'weather':{
      widget.innerHTML='<div class="widget-overline">LOCAL WEATHER ↗</div><div class="widget-title-text">☀ OPEN FORECAST</div><div class="widget-foot">CONDITIONS / EXTERNAL</div>';break;
    }
    case 'tasks':{
      widget.innerHTML='<header><span>TODAY / YOUR TASKS</span><button class="add-task-btn" aria-label="Add task">＋</button></header><div class="task-items"></div>';
      const host=widget.querySelector('.task-items');
      const tasks=this.model.tasks;
      if(!tasks.length){
        const empty=document.createElement('span');empty.className='widget-foot';empty.textContent='NO TASKS YET · TAP +';host.append(empty);
      }
      tasks.slice(0,3).forEach((task,index)=>{
        const row=document.createElement('button');row.type='button';row.className='task-line'+(task.done?' done':'');
        const box=document.createElement('i');box.textContent=task.done?'✓':'';
        const copy=document.createElement('span');copy.textContent=task.text;
        row.append(box,copy);
        row.onclick=e=>{e.stopPropagation();if(this.edit)return;
          this.mutate(state=>{state.tasks[index].done=!state.tasks[index].done;});
        };
        host.append(row);
      });
      widget.querySelector('.add-task-btn').onclick=e=>{e.stopPropagation();this.openSheet('tasks-edit');};
      break;
    }
    case 'notes':{
      widget.innerHTML='<div class="widget-overline">WORKSHOP / MEMO</div><p></p><div class="widget-foot">TAP TO EDIT NOTE ↗</div>';
      widget.querySelector('p').textContent=this.model.notes.slice(0,160);break;
    }
    case 'music':{
      widget.innerHTML='<div class="music-note">♫</div><div class="music-copy"><small>THE HIDEAWAY / AUDIO</small><b>OPEN MUSIC</b></div><span style="color:var(--amber)">▶</span>';break;
    }
    case 'house':{
      widget.innerHTML='<span>⌁</span><b>HOUSE / CONTROLS</b><small>OPEN CONTROL DECK ↗</small>';break;
    }
    case 'calendar':{
      widget.innerHTML='<div class="widget-overline">CALENDAR / LOCAL</div><div class="widget-big-number calendar-date" style="padding:10px"></div><div class="widget-foot">OPEN CALENDAR ↗</div>';break;
    }
  }
  return widget;
};
M.cellDom=function(item,page){
  const cell=document.createElement('div');
  cell.className='grid-cell'+(this.edit?' editing':'');
  cell.dataset.uid=item.id;cell.dataset.loc='home';cell.dataset.page=page.id;
  cell.dataset.type=item.type;
  cell.style.setProperty('--col',item.x+1);cell.style.setProperty('--row',item.y+1);
  cell.style.setProperty('--w',item.w||1);cell.style.setProperty('--h',item.h||1);
  cell.dataset.cols=item.w||1;cell.dataset.rows=item.h||1;
  cell.setAttribute('role','listitem');
  cell.tabIndex=0;
  if(item.type==='android-widget'){
    const placeholder=document.createElement('div');
    placeholder.className='widget-tile native-widget-placeholder';
    const heading=document.createElement('div');heading.className='widget-overline';
    heading.textContent='ANDROID / LIVE WIDGET';
    const title=document.createElement('div');title.className='widget-title-text';
    title.textContent=item.label||'Android widget';
    const hint=document.createElement('div');hint.className='widget-foot';
    hint.textContent='NATIVE CONTENT APPEARS WHEN EDITING IS DONE';
    placeholder.append(heading,title,hint);cell.append(placeholder);
  }else cell.append(item.type==='widget'?this.widgetDom(item):this.iconDom(item));
  cell.addEventListener('click',e=>{
    if(e.target.closest('.cell-remove,.cell-resize,.add-task-btn,.task-line'))return;
    if(Date.now()<this.gestureSuppressUntil)return;
    if(this.edit){
      this.selectedWidget=(item.type==='widget'||item.type==='android-widget')?item.id:null;
      this.renderHome();return;
    }
    this.openItem(item);
  });
  const remove=document.createElement('button');remove.type='button';
  remove.className='cell-remove';remove.textContent='×';remove.title='Remove from Home';
  remove.onclick=e=>{e.stopPropagation();this.mutate(state=>C.removeItem(state,item.id));this.toast('REMOVED FROM HOME');};
  cell.append(remove);
  if(item.type==='widget'||item.type==='android-widget'){
    const resize=document.createElement('button');resize.type='button';
    resize.className='cell-resize';resize.textContent='⤡';resize.title='Drag to resize width and height independently';
    resize.setAttribute('aria-label','Resize '+(item.kind||item.label||'widget'));
    resize.onclick=e=>{e.stopPropagation();this.openSheet('resize',{id:item.id});};
    cell.append(resize);
    if(this.selectedWidget===item.id)cell.classList.add('selected');
  }
  return cell;
};
M.renderHome=function(){
  const track=$('homeTrack');if(!track)return;
  const pages=this.model.pages;
  track.textContent='';
  for(const page of pages){
    const surface=document.createElement('div');surface.className='home-page';
    surface.dataset.page=page.id;
    surface.style.setProperty('--home-cols',this.model.settings.homeCols);
    surface.style.setProperty('--home-rows',this.model.settings.homeRows);
    surface.setAttribute('aria-label','Home page '+(pages.indexOf(page)+1));
    for(const item of page.items)surface.append(this.cellDom(item,page));
    if(!page.items.length){
      const empty=document.createElement('button');empty.className='home-page-empty';
      empty.innerHTML='<strong>YOUR SPACE.</strong><span>HOLD TO ADD APPS OR WIDGETS</span>';
      empty.onclick=()=>{this.enterEdit();this.openSheet('apps-picker');};
      surface.append(empty);
    }
    track.append(surface);
  }
  const index=Math.max(0,pages.findIndex(p=>p.id===this.model.current));
  track.style.transition='none';
  track.style.transform='translate3d(-'+(index*100)+'%,0,0)';
  requestAnimationFrame(()=>{track.style.transition='';});
  this.refreshClock();this.refreshBattery();
  this.renderPageDots();
  this.scheduleWidgetSync();
  this.scheduleIconDrain();
};
M.renderPageDots=function(){
  const host=$('homePageDots');if(!host)return;host.textContent='';
  this.model.pages.forEach((page,index)=>{
    const button=document.createElement('button');button.type='button';
    button.className=page.id===this.model.current?'active':'';
    button.setAttribute('aria-label','Home page '+(index+1));
    button.setAttribute('aria-current',page.id===this.model.current?'page':'false');
    button.onclick=()=>this.goPage(page.id);
    host.append(button);
  });
  $('homeEyebrow').textContent='THE HIDEAWAY / HOME '+(this.model.pages.findIndex(p=>p.id===this.model.current)+1);
};
M.renderDock=function(){
  const host=$('dock');if(!host)return;
  host.style.setProperty('--dock-slots',String(this.model.settings.dockSlots));
  host.textContent='';
  for(let i=0;i<this.model.settings.dockSlots;i++){
    const slot=document.createElement('div');
    slot.className='dock-slot';slot.dataset.loc='dock';slot.dataset.slot=String(i);
    const item=this.model.dock[i];
    if(item){
      slot.dataset.uid=item.id;
      slot.append(this.iconDom(item,{noLabel:true}));
      const remove=document.createElement('button');remove.className='cell-remove';
      remove.textContent='×';remove.setAttribute('aria-label','Remove from dock');
      remove.onclick=e=>{e.stopPropagation();this.mutate(model=>{model.dock[i]=null;});};
      slot.append(remove);
      slot.onclick=e=>{
        if(e.target.closest('.cell-remove')||Date.now()<this.gestureSuppressUntil)return;
        if(this.edit){this.openSheet('dock-select',{slot:i});return;}
        this.openItem(item);
      };
    }else{
      const add=document.createElement('button');add.className='dock-placeholder';
      add.textContent='+';add.setAttribute('aria-label','Add a favorite app');
      add.onclick=e=>{e.stopPropagation();this.openSheet('dock-select',{slot:i});};
      slot.append(add);
    }
    host.append(slot);
  }
  this.applyPrefs();
  this.scheduleIconDrain();
};
M.renderDrawer=function(){
  const host=$('drawerTrack');if(!host)return;
  if(this.view!=='drawer')return;
  const items=this.allDrawerItems();
  this.drawerSnapshot=items;
  const {appCols:cols,appRows:rows}=this.model.settings;
  const size=cols*rows,pageCount=Math.max(1,Math.ceil(items.length/size));
  this.drawerPage=Math.max(0,Math.min(pageCount-1,this.drawerPage));
  $('appCount').textContent=items.length+' APPS / PAGE '+(this.drawerPage+1)+' OF '+pageCount;
  host.textContent='';
  for(let i=0;i<pageCount;i++){
    const page=document.createElement('div');page.className='app-page';
    page.dataset.page=String(i);
    page.style.setProperty('--app-cols',cols);page.style.setProperty('--app-rows',rows);
    page.setAttribute('aria-label','App page '+(i+1));
    host.append(page);
  }
  this.populateDrawerPage(this.drawerPage);
  this.populateDrawerPage(this.drawerPage+1);
  this.populateDrawerPage(this.drawerPage-1);
  const dots=$('drawerDots');dots.textContent='';
  for(let i=0;i<pageCount;i++){
    const dot=document.createElement('button');dot.type='button';
    dot.className=i===this.drawerPage?'active':'';
    dot.setAttribute('aria-label','App page '+(i+1));
    dot.onclick=()=>this.goDrawerPage(i);
    dots.append(dot);
  }
  const scroll=$('drawerPages');
  try{scroll.scrollTo({left:this.drawerPage*(scroll.clientWidth||1),behavior:'auto'});}
  catch(e){scroll.scrollLeft=this.drawerPage*(scroll.clientWidth||1);}
  this.renderLibrarySelection?.();
  this.scheduleIconDrain();
};
M.populateDrawerPage=function(index){
  const host=$('drawerTrack');
  if(index<0||index>=host.children.length)return;
  const page=host.children[index];
  if(page.dataset.loaded==='yes')return;
  page.dataset.loaded='yes';
  const {appCols,appRows}=this.model.settings,size=appCols*appRows;
  const items=(this.drawerSnapshot||this.allDrawerItems()).slice(index*size,(index+1)*size);
  for(const item of items){
    const cell=document.createElement('div');
    cell.className='app-page-cell';cell.dataset.loc='drawer';
    cell.dataset.uid=item.id||'';cell.dataset.pkg=item.pkg||'';
    cell.dataset.kind=item.type;
    const icon=this.iconDom(item);
    icon.onclick=e=>{
      if(Date.now()<this.gestureSuppressUntil)return;
      if(this.selectMode){
        if(item.type==='app')this.toggleLibrarySelection(item.pkg);
        else this.toast('ONLY INSTALLED APPS CAN BE SELECTED');
        return;
      }
      if(this.edit && this.picking){this.pickApp(item);return;}
      this.openItem(item);
    };
    cell.append(icon);
    page.append(cell);
    if(this.selectMode&&item.type==='app'){
      const mark=document.createElement('span');mark.className='selection-mark';
      mark.textContent=this.selectedApps?.has(item.pkg)?'✓':'';
      cell.classList.toggle('is-selected',this.selectedApps?.has(item.pkg));
      cell.append(mark);
    }
  }
};
M.goDrawerPage=function(index){
  const count=$('drawerTrack').children.length;
  this.drawerPage=Math.max(0,Math.min(count-1,index));
  this.populateDrawerPage(this.drawerPage);
  this.populateDrawerPage(this.drawerPage+1);
  this.populateDrawerPage(this.drawerPage-1);
  const scroller=$('drawerPages');
  const left=this.drawerPage*(scroller.clientWidth||1);
  try{scroller.scrollTo({left,behavior:'smooth'});}catch(e){scroller.scrollLeft=left;}
  this.updateDrawerDots();
  this.renderLibrarySelection?.();
  this.scheduleIconDrain();
};
M.changeDrawerPage=function(delta){this.goDrawerPage(this.drawerPage+delta);};
M.updateDrawerDots=function(){
  document.querySelectorAll('#drawerDots button').forEach((node,i)=>node.classList.toggle('active',i===this.drawerPage));
  const count=(this.drawerSnapshot||[]).length;
  $('appCount').textContent=count+' APPS / PAGE '+(this.drawerPage+1)+' OF '+Math.max(1,$('drawerTrack').children.length);
};
M.findFolder=function(id){
  const located=C.locate(this.model,id);
  if(located&&located.item.type==='folder')return located.item;
  return null;
};
M.openFolder=function(id){
  const folder=this.findFolder(id);if(!folder)return;
  this.activeFolder=id;this.folderPage=0;
  $('folderOverlay').classList.remove('hidden');
  $('folderTitle').value=folder.name||'Folder';
  this.renderFolder();
};
M.closeFolder=function(){
  this.activeFolder=null;
  $('folderOverlay').classList.add('hidden');
};
M.renderFolder=function(){
  if(!this.activeFolder)return;
  const folder=this.findFolder(this.activeFolder);if(!folder){this.closeFolder();return;}
  const {folderCols:cols,folderRows:rows}=this.model.settings;
  const capacity=cols*rows;
  const count=Math.max(1,Math.ceil(folder.apps.length/capacity));
  this.folderPage=Math.min(this.folderPage,count-1);
  const track=$('folderTrack');track.textContent='';
  for(let pageIndex=0;pageIndex<count;pageIndex++){
    const page=document.createElement('div');page.className='folder-page';
    page.style.setProperty('--folder-cols',cols);page.style.setProperty('--folder-rows',rows);
    for(const app of folder.apps.slice(pageIndex*capacity,(pageIndex+1)*capacity)){
      const cell=document.createElement('div');cell.className='folder-cell';
      cell.dataset.loc='folder';cell.dataset.pkg=app.pkg;
      const icon=this.iconDom({type:'app',pkg:app.pkg,label:app.label});
      icon.onclick=()=>this.launchApp(app.pkg);
      cell.append(icon);page.append(cell);
    }
    track.append(page);
  }
  const dots=$('folderDots');dots.textContent='';
  for(let i=0;i<count;i++){
    const dot=document.createElement('button');dot.type='button';dot.className=i===this.folderPage?'active':'';
    dot.onclick=()=>this.goFolderPage(i);dots.append(dot);
  }
  this.goFolderPage(this.folderPage);
  this.scheduleIconDrain();
};
M.goFolderPage=function(index){
  const track=$('folderTrack');if(!track)return;
  this.folderPage=Math.max(0,Math.min(track.children.length-1,Math.round(index)));
  track.style.transform='translate3d(-'+(this.folderPage*100)+'%,0,0)';
  this.scheduleIconDrain();
  document.querySelectorAll('#folderDots button').forEach((n,i)=>n.classList.toggle('active',i===this.folderPage));
};
M.renderSettings=function(){
  const s=this.model.settings;
  $('homeGridValue').textContent=s.homeCols+'×'+s.homeRows;
  $('appGridValue').textContent=s.appCols+'×'+s.appRows;
  $('folderGridValue').textContent=s.folderCols+'×'+s.folderRows;
  $('dockCountValue').textContent=s.dockSlots+' SLOTS';
  $('appSortValue').textContent=s.appSort==='alphabetical'?'A–Z':'CUSTOM';
};
M.installUi=function(){
  const scroll=$('drawerPages');
  let queued=false;
  scroll.addEventListener('scroll',()=>{
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{
      queued=false;
      if(this.view!=='drawer')return;
      const width=scroll.clientWidth;if(!width)return;
      const index=Math.max(0,Math.min($('drawerTrack').children.length-1,Math.round(scroll.scrollLeft/width)));
      if(index===this.drawerPage)return;
      this.drawerPage=index;this.populateDrawerPage(index);this.populateDrawerPage(index-1);this.populateDrawerPage(index+1);this.updateDrawerDots();
    });
  },{passive:true});
};
})();
