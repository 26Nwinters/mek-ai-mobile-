/* MEK-AI Mobile v0.2: editable launcher, non-blocking app drawer. */
'use strict';
const $ = id => document.getElementById(id);
const STORAGE = {
  tasks:'mek_mobile_tasks_v1',
  wallpaper:'mek_mobile_wallpaper_v1',
  motion:'mek_mobile_reduce_motion_v1',
  home:'mek_mobile_grid_v2',
  cols:'mek_mobile_columns_v2',
  theme:'mek_mobile_theme_v2',
  note:'mek_mobile_note_v2'
};
function storageGet(key, fallback) {
  try {
    const value=localStorage.getItem(key);
    return value===null ? fallback : JSON.parse(value);
  } catch(e) { return fallback; }
}
function storageSet(key,value) { try{localStorage.setItem(key,JSON.stringify(value));}catch(e){} }
const model=window.MekLayout;
const appState={
  route:'home', edit:false, pickMode:false, dragging:null, suppressClickUntil:0,
  cols:model.columns(storageGet(STORAGE.cols,4)),
  tiles:model.normalize(storageGet(STORAGE.home,null)),
  loaded:false, loading:false, apps:[], renderToken:0,
  iconCache:new Map(), iconQueue:[], iconPending:new Set(), iconWorker:false,
  iconObserver:null, editorKind:'', longPressTimer:null, pressOrigin:null
};

function nativeOpen(kind){
  try { if(window.MEK && typeof MEK.openDefault==='function') MEK.openDefault(kind); }
  catch(e) { console.warn('MEK-AI native shortcut unavailable',e); }
}
function navigate(route){
  if(!['home','drawer','mek','controls','settings'].includes(route)) route='home';
  if(appState.edit && !appState.pickMode && route!=='home') exitEditMode();
  if(appState.pickMode && route!=='drawer')appState.pickMode=false;
  closeEditor();
  appState.route=route;
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+route));
  document.querySelectorAll('.nav-item').forEach(v=>v.classList.toggle('on',v.dataset.route===route));
  window.scrollTo(0,0);
  if(route==='drawer')refreshApps();
  if(route==='home'){renderHome();updateBattery();}
  const hint=$('appDrawerModeHint');
  if(hint)hint.classList.toggle('hidden',!appState.pickMode);
}
function cancelAppPick(){appState.pickMode=false;navigate('home');if(!appState.edit)enterEditMode();}
function goBackInLauncher(){
  if(!$('editSheet').classList.contains('hidden')){closeEditor();return;}
  if(appState.pickMode){cancelAppPick();return;}
  if(appState.edit){exitEditMode();return;}
  if(appState.route!=='home'){navigate('home');return;}
  window.scrollTo(0,0);
}
const GLYPHS={
 '0':['11111','10001','10011','10101','11001','10001','11111'],
 '1':['00100','01100','00100','00100','00100','00100','01110'],
 '2':['11111','00001','00001','11111','10000','10000','11111'],
 '3':['11111','00001','00001','01111','00001','00001','11111'],
 '4':['10001','10001','10001','11111','00001','00001','00001'],
 '5':['11111','10000','10000','11111','00001','00001','11111'],
 '6':['11111','10000','10000','11111','10001','10001','11111'],
 '7':['11111','00001','00010','00100','00100','00100','00100'],
 '8':['11111','10001','10001','11111','10001','10001','11111'],
 '9':['11111','10001','10001','11111','00001','00001','11111'],
 ':':['0','0','1','0','1','0','0']
};
function drawClock(){
  const now=new Date();
  const value=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  document.querySelectorAll('canvas.tile-dot-clock').forEach(canvas=>{
    const ctx=canvas.getContext('2d');if(!ctx)return;
    canvas.setAttribute('aria-label','Time '+value);
    const pitch=7.2,gap=10,width=(4*5+1)*pitch+4*gap;
    let x=Math.max(1,(canvas.width-width)/2),y=22;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    for(const ch of value){
      const glyph=GLYPHS[ch]||GLYPHS['0'];
      glyph.forEach((row,iy)=>row.split('').forEach((dot,ix)=>{
        if(dot!=='1')return;
        ctx.beginPath();ctx.arc(x+ix*pitch+2.5,y+iy*pitch+2.5,2.65,0,Math.PI*2);
        ctx.fillStyle='#f1e5d1';ctx.fill();
      }));
      x+=(ch===':'?1:5)*pitch+gap;
    }
  });
}
function updateDate(){
  const date=new Date();
  if($('topTime'))$('topTime').textContent=String(date.getHours()).padStart(2,'0')+':'+String(date.getMinutes()).padStart(2,'0');
  document.querySelectorAll('.tile-date').forEach(node=>node.textContent=date.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}).toUpperCase().replace(',',' ·'));
  drawClock();
}
function updateBattery(){
  try {
    if(!window.MEK||typeof MEK.battery!=='function')return;
    const status=JSON.parse(MEK.battery());
    if(!Number.isFinite(status.percent))return;
    const percent=Math.max(0,Math.min(100,Math.round(status.percent)));
    if($('topBattery'))$('topBattery').textContent=percent+'%';
    document.querySelectorAll('.home-tile[data-type="battery"]').forEach(tile=>{
      const value=tile.querySelector('.widget-reading');
      const fill=tile.querySelector('.battery-fill');
      const label=tile.querySelector('.widget-mini-caption');
      if(value)value.innerHTML=percent+'<small>%</small>';
      if(fill)fill.style.width=percent+'%';
      if(label)label.textContent=status.charging?'CHARGING NOW':'DEVICE BATTERY';
    });
  }catch(e){}
}
function saveLayout(){appState.tiles=model.normalize(appState.tiles);storageSet(STORAGE.home,appState.tiles);}
function widgetHTML(type){
  switch(type){
    case 'clock':return '<div class="widget-body"><div class="widget-eyebrow">CHRONO / LOCAL</div><canvas class="tile-dot-clock" width="300" height="105"></canvas><div class="tile-date"></div></div>';
    case 'weather':return '<div class="widget-body"><div class="widget-eyebrow">WEATHER / LOCAL ↗</div><div class="weather-glyph">☀</div><div class="weather-word">OPEN<br>FORECAST</div></div>';
    case 'battery':return '<div class="widget-body"><div class="widget-eyebrow">POWER CELL / LIVE</div><div class="widget-reading">--<small>%</small></div><div class="battery-track"><div id="batteryFill" class="battery-fill"></div></div><div class="widget-mini-caption">READING DEVICE</div></div>';
    case 'mek':return '<div class="robot-widget"><img src="mek.webp" alt=""><div class="robot-widget-copy"><div class="micro-label warm">● COMPANION</div><strong>MEK<span>-AI</span></strong><small>The workshop\'s little keeper.</small><span class="robot-cta">SAY HELLO ↗</span></div></div>';
    case 'tasks':return '<div class="widget-body"><div class="widget-row-title">TODAY / YOUR LIST <span class="plus" data-task-add="true">＋</span></div><div class="tasks task-widget-list"></div></div>';
    case 'music':return '<div class="music-widget"><span class="music-symbol">♫</span><div class="music-widget-copy"><small>THE HIDEAWAY / AUDIO</small><b>OPEN MUSIC</b></div><span class="music-widget-play">▶</span></div>';
    case 'notes':return '<div class="notes-widget"><div class="widget-row-title">WORKSHOP / NOTES <span>✎</span></div><div class="note-content"></div><div class="widget-mini-caption">TAP TO EDIT YOUR NOTE</div></div>';
    default:return '';
  }
}
const shortcutIcons={
  phone:'☎',messages:'▤',camera:'◎',browser:'◉',music:'♫',settings:'⚙',drawer:'▦'
};
function iconTileHTML(tile){
  const wrap=document.createElement('div');wrap.className='grid-icon-tile';
  const icon=document.createElement('span');icon.className='home-app-icon';
  const label=document.createElement('span');label.className='home-app-label';
  if(tile.type==='app'){
    const initial=document.createElement('span');initial.textContent=(tile.label||'A').charAt(0).toUpperCase();
    icon.append(initial);
    attachAppIcon(icon,tile.pkg);
    label.textContent=tile.label||'App';
  }else{
    const sign=document.createElement('span');sign.textContent=shortcutIcons[tile.kind]||'□';
    icon.append(sign);
    label.textContent=tile.label||tile.kind;
  }
  wrap.append(icon,label);
  return wrap;
}
function renderHome(){
  const host=$('homeGrid');if(!host)return;
  host.style.setProperty('--grid-cols',String(appState.cols));
  host.textContent='';
  const fragment=document.createDocumentFragment();
  for(const tile of appState.tiles){
    const element=document.createElement('div');
    element.className='home-tile';
    element.setAttribute('role','listitem');
    element.tabIndex=0;
    element.dataset.tileId=tile.id;
    element.dataset.type=tile.type;
    element.style.gridColumn='span '+model.span(tile,appState.cols);
    if(tile.type==='app'||tile.type==='shortcut')element.appendChild(iconTileHTML(tile));
    else element.innerHTML=widgetHTML(tile.type);
    const remove=document.createElement('button');
    remove.className='tile-edit-action tile-remove';remove.textContent='×';
    remove.setAttribute('aria-label','Remove '+(tile.label||model.labels[tile.type]||'tile'));
    remove.addEventListener('click',ev=>{ev.stopPropagation();removeTile(tile.id);});
    const handle=document.createElement('button');
    handle.className='tile-edit-action tile-drag-handle';handle.textContent='⠿';
    handle.setAttribute('aria-label','Drag to rearrange '+(tile.label||tile.type));
    handle.addEventListener('pointerdown',ev=>beginTileDrag(ev,tile.id));
    handle.addEventListener('click',ev=>ev.stopPropagation());
    element.append(remove,handle);
    fragment.appendChild(element);
  }
  host.appendChild(fragment);
  if(appState.tiles.length===0){
    const empty=document.createElement('button');
    empty.className='empty-home-grid';empty.textContent='＋ ADD YOUR FIRST WIDGET OR APP';
    empty.onclick=()=>{enterEditMode();openEditor('widgets');};
    host.appendChild(empty);
  }
  renderTasks();
  document.querySelectorAll('.note-content').forEach(node=>node.textContent=String(storageGet(STORAGE.note,'A little place for your thoughts.')).slice(0,300));
  updateDate();
  updateBattery();
}
function removeTile(id){
  if(!appState.edit)return;
  appState.tiles=appState.tiles.filter(t=>t.id!==id);
  saveLayout();renderHome();
}
function addWidget(type){
  if(!model.widgetTypes.includes(type))return;
  if(appState.tiles.length>=40)return;
  appState.tiles.push(model.newTile(type));
  saveLayout();closeEditor();navigate('home');enterEditMode();
  setTimeout(()=>window.scrollTo(0,document.body.scrollHeight),80);
}
function addAppTile(pkg,label){
  if(appState.tiles.length>=40)return;
  try {appState.tiles.push(model.newTile('app',{pkg,label}));}
  catch(e){return;}
  saveLayout();
  appState.pickMode=false;
  navigate('home');
  enterEditMode();
  setTimeout(()=>window.scrollTo(0,document.body.scrollHeight),80);
}
function activateTile(id){
  if(Date.now()<appState.suppressClickUntil||appState.edit)return;
  const tile=appState.tiles.find(t=>t.id===id);if(!tile)return;
  if(tile.type==='app'){
    try{if(window.MEK)MEK.launchApp(tile.pkg);}catch(e){}
    return;
  }
  if(tile.type==='shortcut'){
    if(tile.kind==='drawer')navigate('drawer');
    else nativeOpen(tile.kind);
    return;
  }
  if(tile.type==='mek'){navigate('mek');return;}
  if(tile.type==='weather'){nativeOpen('weather');return;}
  if(tile.type==='battery'){nativeOpen('battery');return;}
  if(tile.type==='music'){nativeOpen('music');return;}
  if(tile.type==='notes'){openEditor('note');return;}
}
function setupTileClicks(){
  const host=$('homeGrid');
  host.addEventListener('click',e=>{
    if(e.target.closest('.tile-edit-action'))return;
    if(e.target.closest('.task-line'))return;
    if(e.target.closest('[data-task-add]')){if(!appState.edit)openEditor('new-task');return;}
    const tile=e.target.closest('[data-tile-id]');
    if(tile)activateTile(tile.dataset.tileId);
  });
  host.addEventListener('keydown',e=>{
    if(!e.target.matches('.home-tile'))return;
    if(appState.edit && e.altKey && (e.key==='ArrowLeft'||e.key==='ArrowRight')){
      e.preventDefault();
      appState.tiles=model.shift(appState.tiles,e.target.dataset.tileId,e.key==='ArrowLeft'?-1:1);
      saveLayout();renderHome();return;
    }
    if(e.key==='Enter'||e.key===' '){e.preventDefault();activateTile(e.target.dataset.tileId);}
  });
}
function enterEditMode(goHome=false){
  if(goHome||appState.route!=='home'){appState.pickMode=false;navigate('home');}
  appState.edit=true;
  document.body.classList.add('edit-home');
  $('editToolbar').classList.remove('hidden');
  $('editHomeButton').classList.add('hidden');
  $('homeHelp').textContent='HOLD ⠿ AND DRAG ONTO ANOTHER TILE TO MOVE IT';
  renderHome();
}
function exitEditMode(){
  appState.edit=false;appState.pickMode=false;
  document.body.classList.remove('edit-home');
  $('editToolbar').classList.add('hidden');
  $('editHomeButton').classList.remove('hidden');
  $('homeHelp').textContent='HOLD AN EMPTY SPOT OR A TILE TO CUSTOMIZE ✳';
  closeEditor();saveLayout();renderHome();
}
function setupLongPress(){
  const area=$('view-home');
  const clear=()=>{
    if(appState.longPressTimer){clearTimeout(appState.longPressTimer);appState.longPressTimer=null;}
    appState.pressOrigin=null;
  };
  area.addEventListener('pointerdown',event=>{
    if(appState.edit||event.button>0||event.target.closest('button,input,textarea,.edit-toolbar'))return;
    appState.pressOrigin={x:event.clientX,y:event.clientY};
    clearTimeout(appState.longPressTimer);
    appState.longPressTimer=setTimeout(()=>{
      appState.longPressTimer=null;appState.pressOrigin=null;
      if(appState.route==='home'){
        appState.suppressClickUntil=Date.now()+650;
        enterEditMode();
        if(navigator.vibrate)try{navigator.vibrate(12);}catch(e){}
      }
    },560);
  },{passive:true});
  area.addEventListener('pointermove',event=>{
    const p=appState.pressOrigin;
    if(p&&Math.hypot(p.x-event.clientX,p.y-event.clientY)>12)clear();
  },{passive:true});
  for(const type of ['pointerup','pointercancel','pointerleave'])area.addEventListener(type,clear,{passive:true});
  area.addEventListener('contextmenu',event=>{
    if(event.target.closest('button,input,textarea'))return;
    event.preventDefault();
    if(!appState.edit){appState.suppressClickUntil=Date.now()+600;enterEditMode();}
  });
}
function beginTileDrag(event,id){
  if(!appState.edit)return;
  event.preventDefault();event.stopPropagation();
  appState.dragging={id,target:null};
  const node=document.querySelector('[data-tile-id="'+id+'"]');
  if(node)node.classList.add('tile-dragging');
  window.addEventListener('pointermove',moveTileDrag,{passive:false});
  window.addEventListener('pointerup',endTileDrag,{once:true});
  window.addEventListener('pointercancel',endTileDrag,{once:true});
}
function moveTileDrag(event){
  const drag=appState.dragging;if(!drag)return;
  event.preventDefault();
  const hit=document.elementFromPoint(event.clientX,event.clientY);
  const target=hit&&hit.closest('[data-tile-id]');
  document.querySelectorAll('.tile-drop-target').forEach(n=>n.classList.remove('tile-drop-target'));
  drag.target=target && target.dataset.tileId!==drag.id ? target.dataset.tileId : null;
  if(drag.target)target.classList.add('tile-drop-target');
}
function endTileDrag(){
  window.removeEventListener('pointermove',moveTileDrag);
  const drag=appState.dragging;appState.dragging=null;
  if(!drag)return;
  if(drag.target){
    appState.tiles=model.move(appState.tiles,drag.id,drag.target);
    saveLayout();
  }
  renderHome();
}
function changeColumns(delta){
  setGridColumns(appState.cols+delta);
}
function setGridColumns(value){
  appState.cols=model.columns(value);
  storageSet(STORAGE.cols,appState.cols);
  if($('settingsGridCount'))$('settingsGridCount').textContent=String(appState.cols);
  renderHome();
  if(appState.editorKind==='grid'&&!$('editSheet').classList.contains('hidden'))renderEditorBody('grid');
}
function openEditor(kind){
  if(kind==='apps'){
    closeEditor();
    appState.pickMode=true;
    navigate('drawer');
    return;
  }
  if(!['widgets','grid','themes','note','new-task'].includes(kind))return;
  appState.editorKind=kind;
  $('editSheet').classList.remove('hidden');
  renderEditorBody(kind);
}
function closeEditor(){const sheet=$('editSheet');if(sheet)sheet.classList.add('hidden');appState.editorKind='';}
function renderEditorBody(kind){
  const body=$('editSheetBody');body.textContent='';
  const title=$('editorHeading');
  function intro(text){
    const p=document.createElement('p');p.className='sheet-help';p.textContent=text;body.append(p);
  }
  if(kind==='widgets'){
    title.textContent='ADD WIDGET';
    intro('Choose a module for your home grid. Hold its ⠿ handle afterward to rearrange it.');
    const grid=document.createElement('div');grid.className='widget-picker-list';
    const icons={clock:'◷',weather:'☀',battery:'▥',mek:'◧',tasks:'☑',music:'♫',notes:'✎'};
    const sub={clock:'LIVE DOT-MATRIX TIME',weather:'FORECAST LINK',battery:'REAL DEVICE POWER',mek:'YOUR ROBOT',tasks:'LOCAL CHECKLIST',music:'MUSIC SHORTCUT',notes:'PERSONAL MEMO'};
    model.widgetTypes.forEach(type=>{
      const button=document.createElement('button');button.className='widget-pick';
      const symbol=document.createElement('span');symbol.textContent=icons[type];
      const heading=document.createElement('strong');heading.textContent=model.labels[type];
      const small=document.createElement('small');small.textContent=sub[type];
      button.append(symbol,heading,small);button.onclick=()=>addWidget(type);grid.append(button);
    });
    body.append(grid);return;
  }
  if(kind==='grid'){
    title.textContent='GRID & TILE COUNT';
    intro('Change the number of tile slots across the home screen. Wide widgets adapt automatically.');
    const control=document.createElement('div');control.className='picker-grid-config';
    const dec=document.createElement('button');dec.textContent='−';dec.onclick=()=>changeColumns(-1);
    const count=document.createElement('strong');count.textContent=appState.cols+' COLUMNS';
    const inc=document.createElement('button');inc.textContent='+';inc.onclick=()=>changeColumns(1);
    control.append(dec,count,inc);body.append(control);
    const demo=document.createElement('div');demo.className='picker-grid-demo';
    demo.style.setProperty('--demo-columns',String(appState.cols));
    for(let i=0;i<appState.cols*2;i++)demo.append(document.createElement('span'));
    body.append(demo);intro('3 columns = larger tiles. 6 columns = more icons. The choice is saved.');return;
  }
  if(kind==='themes'){
    title.textContent='TERMINAL THEMES';
    intro('Keep the weathered industrial look, with slightly different color and atmosphere.');
    const themes=[['overgrown','✳ OVERGROWN GREEN'],['amber','● AMBER INDUSTRIAL'],['moss','◐ MOSS NIGHT']];
    const list=document.createElement('div');list.className='picker-theme-options';
    const current=storageGet(STORAGE.theme,'overgrown');
    themes.forEach(([key,text])=>{
      const b=document.createElement('button');b.classList.toggle('selected',current===key);
      b.textContent=text+(current===key?'   ✓':'');b.onclick=()=>{setTheme(key);renderEditorBody('themes');};
      list.append(b);
    });
    body.append(list);return;
  }
  if(kind==='note'){
    title.textContent='EDIT YOUR WORKSHOP NOTE';
    intro('Your note stays on this device.');
    const textarea=document.createElement('textarea');
    textarea.id='workshopNoteInput';textarea.rows=5;textarea.maxLength=300;
    textarea.value=String(storageGet(STORAGE.note,'A little place for your thoughts.'));
    textarea.style.cssText='width:100%;background:#101b12;color:#eadac0;border:1px solid #aa8452;border-radius:10px;padding:12px;resize:vertical';
    const save=document.createElement('button');save.className='primary-action';save.textContent='SAVE NOTE ✓';
    save.style.marginTop='12px';save.onclick=()=>{storageSet(STORAGE.note,textarea.value);closeEditor();renderHome();};
    body.append(textarea,save);return;
  }
  if(kind==='new-task'){
    title.textContent='NEW TASK';
    intro('Add a local checklist task. No notifications will be scheduled.');
    const input=document.createElement('input');input.type='text';input.maxLength=140;input.id='newTaskField';
    input.placeholder='What needs doing?';
    input.style.cssText='width:100%;padding:13px;background:#101b12;color:#f5dfc0;border:1px solid #a67f4d;border-radius:8px';
    const save=document.createElement('button');save.className='primary-action';save.textContent='ADD TO MY LIST ＋';
    save.style.marginTop='12px';
    save.onclick=()=>{const value=input.value.trim();if(!value)return;const tasks=getTasks();tasks.push({text:value,done:false});storageSet(STORAGE.tasks,tasks);closeEditor();renderTasks();};
    input.addEventListener('keydown',e=>{if(e.key==='Enter')save.click();});
    body.append(input,save);setTimeout(()=>input.focus(),40);
  }
}
function getTasks(){
  const input=storageGet(STORAGE.tasks,[]);
  return Array.isArray(input)?input.filter(t=>t&&typeof t.text==='string').slice(0,30):[];
}
function renderTasks(){
  const tasks=getTasks();
  document.querySelectorAll('.task-widget-list').forEach(host=>{
    host.textContent='';
    if(tasks.length===0){
      const placeholder=document.createElement('div');placeholder.className='task-placeholder';
      placeholder.textContent='NOTHING HERE YET · TAP +';host.append(placeholder);
      return;
    }
    tasks.slice(0,4).forEach((task,index)=>{
      const row=document.createElement('button');row.className='task-line'+(task.done?' complete':'');
      const check=document.createElement('span');check.className='task-check';check.textContent=task.done?'✓':'';
      const label=document.createElement('span');label.textContent=task.text;
      row.append(check,label);
      row.addEventListener('click',ev=>{
        ev.stopPropagation();
        if(appState.edit)return;
        const list=getTasks();if(!list[index])return;
        list[index].done=!list[index].done;
        storageSet(STORAGE.tasks,list);renderTasks();
      });
      row.addEventListener('contextmenu',ev=>{
        ev.preventDefault();ev.stopPropagation();
        if(appState.edit)return;
        const list=getTasks();list.splice(index,1);
        storageSet(STORAGE.tasks,list);renderTasks();
      });
      host.append(row);
    });
  });
}
function addTask(){openEditor('new-task');}
function setTheme(value){
  const accepted=['overgrown','amber','moss'];
  const theme=accepted.includes(value)?value:'overgrown';
  storageSet(STORAGE.theme,theme);
  applyPrefs();
}
function applyPrefs(){
  const wallpaper=storageGet(STORAGE.wallpaper,true),motion=storageGet(STORAGE.motion,false);
  document.body.classList.toggle('no-wallpaper',!wallpaper);
  document.body.classList.toggle('reduce-motion',motion);
  const theme=storageGet(STORAGE.theme,'overgrown');
  for(const t of ['amber','moss'])document.body.classList.toggle('theme-'+t,theme===t);
  if($('wallpaperToggle'))$('wallpaperToggle').checked=wallpaper;
  if($('motionToggle'))$('motionToggle').checked=motion;
  document.querySelectorAll('[data-theme]').forEach(node=>node.classList.toggle('chosen',node.dataset.theme===theme));
}
function setupAppObserver(){
  if(typeof IntersectionObserver!=='function')return;
  appState.iconObserver=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(!entry.isIntersecting)return;
      const node=entry.target,pkg=node.dataset.appIcon;
      appState.iconObserver.unobserve(node);
      if(pkg)queueIcon(pkg,node);
    });
  },{rootMargin:'180px'});
}
function attachAppIcon(node,pkg){
  if(!pkg)return;
  if(appState.iconCache.has(pkg)){setIcon(node,appState.iconCache.get(pkg));return;}
  node.dataset.appIcon=pkg;
  if(appState.iconObserver)appState.iconObserver.observe(node);
  else queueIcon(pkg,node);
}
function setIcon(node,data){
  if(!node||!node.isConnected||!data)return;
  node.textContent='';
  const img=document.createElement('img');img.src=data;img.alt='';img.loading='lazy';
  node.appendChild(img);
}
function queueIcon(pkg,node){
  if(appState.iconCache.has(pkg)){setIcon(node,appState.iconCache.get(pkg));return;}
  appState.iconQueue.push({pkg,node});
  if(!appState.iconWorker)processIconQueue();
}
function processIconQueue(){
  appState.iconWorker=true;
  if(!appState.iconQueue.length){appState.iconWorker=false;return;}
  const task=appState.iconQueue.shift();
  if(!task.node.isConnected){setTimeout(processIconQueue,10);return;}
  let data='';
  try{if(window.MEK&&typeof MEK.getAppIcon==='function')data=MEK.getAppIcon(task.pkg)||'';}catch(e){}
  appState.iconCache.set(task.pkg,data);
  setIcon(task.node,data);
  setTimeout(processIconQueue,45);
}
function refreshApps(){
  if(appState.loaded){renderApps();return;}
  if(appState.loading)return;
  appState.loading=true;
  if($('appCount'))$('appCount').textContent='SCANNING INSTALLED APPS…';
  try{
    if(window.MEK&&typeof MEK.requestApps==='function'){
      MEK.requestApps();
      // Do not block the UI while the OS enumerates launcher activities.
      return;
    }
  }catch(e){console.warn('Async app discovery failed',e);}
  appState.loading=false;
  if($('appCount'))$('appCount').textContent='APP LIST UNAVAILABLE ON THIS PREVIEW';
}
function mekAppsReady(json){
  try{
    const list=JSON.parse(json);
    if(!Array.isArray(list))throw new Error('Invalid installed app list');
    appState.apps=list.filter(a=>a&&typeof a.name==='string'&&typeof a.pkg==='string');
    appState.loaded=true;appState.loading=false;
    if(appState.route==='drawer')renderApps();
    // Refresh saved app labels without downloading 100+ icons at once.
    for(const item of appState.tiles){
      if(item.type!=='app')continue;
      const match=appState.apps.find(a=>a.pkg===item.pkg);
      if(match)item.label=match.name;
    }
    saveLayout();
  }catch(error){
    appState.loading=false;
    if($('appCount'))$('appCount').textContent='UNABLE TO LOAD INSTALLED APPS';
  }
}
function renderApps(){
  if(appState.route!=='drawer')return;
  const query=($('appSearch').value||'').toLowerCase().trim();
  const matches=appState.apps.filter(a=>a.name.toLowerCase().includes(query));
  const host=$('appGrid');host.textContent='';
  const token=++appState.renderToken;
  $('appCount').textContent=matches.length+' APPLICATION'+(matches.length===1?'':'S');
  $('appEmpty').classList.toggle('hidden',matches.length!==0);
  let i=0;
  function batch(){
    if(token!==appState.renderToken)return;
    const frag=document.createDocumentFragment();
    for(let end=Math.min(matches.length,i+24);i<end;i++){
      const app=matches[i];
      const button=document.createElement('button');button.className='app-button';
      button.dataset.pkg=app.pkg;button.dataset.label=app.name;
      const icon=document.createElement('span');icon.className='app-icon-wrap';
      const glyph=document.createElement('span');glyph.textContent=(app.name||'?').charAt(0).toUpperCase();
      glyph.style.color='#efb76c';glyph.style.fontSize='24px';icon.append(glyph);
      attachAppIcon(icon,app.pkg);
      const label=document.createElement('span');label.className='app-name';label.textContent=app.name;
      button.append(icon,label);frag.append(button);
    }
    host.append(frag);
    if(i<matches.length)setTimeout(batch,10);
  }
  batch();
}
function setupAppActions(){
  const host=$('appGrid');
  host.addEventListener('click',e=>{
    const button=e.target.closest('.app-button');if(!button)return;
    if(Date.now()<appState.suppressClickUntil)return;
    if(appState.pickMode){addAppTile(button.dataset.pkg,button.dataset.label);return;}
    try{if(window.MEK)MEK.launchApp(button.dataset.pkg);}catch(err){}
  });
  host.addEventListener('contextmenu',e=>{
    const button=e.target.closest('.app-button');if(!button)return;
    e.preventDefault();
    appState.suppressClickUntil=Date.now()+700;
    addAppTile(button.dataset.pkg,button.dataset.label);
  });
  $('appSearch').addEventListener('input',()=>{if(appState.loaded)renderApps();});
}
let dismissedHomeSetup=false;
function checkHomeStatus(){
  let selected=false;
  try{selected=!!(window.MEK&&MEK.isDefaultHome());}catch(e){}
  const status=$('homeSettingStatus');
  if(status)status.textContent=selected?'MEK-AI IS YOUR HOME LAUNCHER':'MAKE MEK-AI YOUR HOME SCREEN';
  const onboarding=$('homeOnboarding');
  if(onboarding)onboarding.classList.toggle('hidden',selected||dismissedHomeSetup||storageGet('mek_mobile_home_setup_dismissed',false));
}
function dismissHomeOnboarding(){
  dismissedHomeSetup=true;
  storageSet('mek_mobile_home_setup_dismissed',true);
  $('homeOnboarding').classList.add('hidden');
}
function requestMakeHome(){
  try{if(window.MEK)MEK.requestHomeRole();}
  catch(e){nativeOpen('home');}
}
function refreshNative(){updateBattery();updateDate();checkHomeStatus();}
function setGreeting(){
  const hour=new Date().getHours();
  if(!$('mekGreeting'))return;
  $('mekGreeting').textContent=hour<6?'You are still awake? That makes two of us.':hour<12?'Morning! I have been keeping an eye on the workshop. Mostly.':hour<18?'Oh, hello! I was just making sure nothing exploded.':'There you are. I was absolutely not taking a nap.';
}
window.addEventListener('DOMContentLoaded',()=>{
  setupAppObserver();
  setupTileClicks();
  setupLongPress();
  setupAppActions();
  applyPrefs();setGreeting();
  renderHome();updateDate();updateBattery();checkHomeStatus();
  if($('settingsGridCount'))$('settingsGridCount').textContent=String(appState.cols);
  $('wallpaperToggle').addEventListener('change',e=>{storageSet(STORAGE.wallpaper,e.target.checked);applyPrefs();});
  $('motionToggle').addEventListener('change',e=>{storageSet(STORAGE.motion,e.target.checked);applyPrefs();});
  setInterval(()=>{updateDate();updateBattery();},45000);
});
window.navigate=navigate;
window.goBackInLauncher=goBackInLauncher;
window.refreshNative=refreshNative;
window.mekAppsReady=mekAppsReady;
window.enterEditMode=enterEditMode;
window.exitEditMode=exitEditMode;
window.openEditor=openEditor;
window.closeEditor=closeEditor;
window.addTask=addTask;
window.cancelAppPick=cancelAppPick;
window.changeColumns=changeColumns;
window.setGridColumns=setGridColumns;
window.setTheme=setTheme;
window.requestMakeHome=requestMakeHome;
window.dismissHomeOnboarding=dismissHomeOnboarding;
