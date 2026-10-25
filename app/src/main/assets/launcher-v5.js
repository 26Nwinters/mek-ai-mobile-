/* MEK-AI v0.5 main controller. The WebView contains a launcher, not a web site. */
'use strict';
(function(){
const Core=window.MekCore;
const KEY='mek_launcher_v5';
const $=id=>document.getElementById(id);
function read(key,def){
  try {const raw=localStorage.getItem(key);return raw==null?def:JSON.parse(raw);}
  catch(e){return def;}
}
function store(key,value){
  try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(e){return false;}
}
const saved=read(KEY,null);
let initial=saved&&saved.version===5 ? Core.normalize(saved) :
  Core.migrateLegacy(key=>localStorage.getItem(key));
// v0.5.3 adds the missing fifth hotseat position once without deleting
// the four shortcuts chosen by users of the earlier v0.5 APK.
if(!read('mek_mobile_dock_five_v053',false)){
  if(initial.settings.dockSlots===4){
    initial.settings.dockSlots=5;
    initial.dock.push(null);
  }
  // Mark upgraded even when already at five slots, so a later intentional
  // choice of four slots remains four on the next app launch.
  store('mek_mobile_dock_five_v053',true);
}
const Mek={
  Core,$,KEY,model:initial,
  view:'home',edit:false,drawerPage:0,folderPage:0,
  activeFolder:null,drawerQuery:'',picking:null,sheet:null,
  apps:[],appsLoaded:false,appsLoading:false,lastAppsRequest:0,
  iconCache:new Map(),iconQueue:[],iconPending:new Map(),iconBusy:null,
  iconInflight:new Set(),iconCooldown:new Map(),iconDrainTimer:null,iconBatchTimer:null,
  iconBatchCount:0,
  iconObserver:null,history:[],lastToastTimer:null,
  drag:null,gesture:null,gestureSuppressUntil:0,
  selectedWidget:null,drawerIconMenu:null,
  systemCatalog:[
    {id:'system-mek',type:'system',kind:'mek',label:'MEK-AI'},
    {id:'system-house',type:'system',kind:'house',label:'House Controls'},
    {id:'system-settings',type:'system',kind:'settings',label:'Home Settings'}
  ],
  systemGlyphs:{
    phone:'☎',messages:'▤',browser:'◉',camera:'◎',settings:'⚙',
    mek:'◧',house:'⌂',music:'♫',weather:'☀',calendar:'▦',files:'▣',drawer:'▦'
  },
  now(){return new Date()},
  native(){return window.MEK||null},
  mutate(action){
    const before=JSON.stringify(this.model);
    let result;
    try{result=action(this.model);}
    catch(e){
      console.warn('Layout action failed',e);
      // A failed operation must never persist partial desktop changes.
      this.model=Core.normalize(JSON.parse(before));
      this.toast('COULD NOT CHANGE LAYOUT');return false;
    }
    const after=JSON.stringify(this.model);
    if(before!==after){
      this.history.push(before);
      if(this.history.length>20)this.history.shift();
      this.persist(after);
      this.render();
    }
    return result;
  },
  persist(serialized=null,syncInventory=true){
    // mutate() already serialized the validated model for change detection.
    // Reuse it instead of producing a third full JSON snapshot on each move.
    let ok=false;
    try{
      localStorage.setItem(KEY,serialized===null?JSON.stringify(this.model):serialized);
      ok=true;
    }catch(e){ok=false;}
    if(!ok)this.toast('PHONE STORAGE IS UNAVAILABLE');
    // The native widget host needs the complete inventory of allocated IDs.
    // Current-page visibility is not an inventory and must not be used for
    // deletion, or widgets on another Home page would be removed.
    if(ok&&syncInventory)this.scheduleWidgetInventorySync();
  },
  collectNativeWidgetIds(){
    const ids=new Set();
    for(const page of this.model.pages||[]){
      for(const item of page.items||[]){
        if(item.type==='android-widget'&&Number.isInteger(item.nativeId)&&item.nativeId>0)
          ids.add(item.nativeId);
      }
    }
    return [...ids].sort((a,b)=>a-b);
  },
  scheduleWidgetInventorySync(){
    clearTimeout(this.widgetInventoryTimer);
    this.widgetInventoryTimer=setTimeout(()=>this.syncWidgetInventory(),70);
  },
  syncWidgetInventory(){
    const native=this.native();
    if(!native||typeof native.syncWidgetInventory!=='function')return;
    try{native.syncWidgetInventory(JSON.stringify(this.collectNativeWidgetIds()));}
    catch(e){console.warn('Could not sync native widget inventory',e);}
  },
  undo(){
    if(!this.history.length){this.toast('NOTHING TO UNDO');return;}
    this.model=Core.normalize(JSON.parse(this.history.pop()));
    this.persist();this.render();this.toast('LAYOUT RESTORED');
  },
  toast(message){
    const node=$('toast');if(!node)return;
    node.textContent=String(message).slice(0,100);
    node.classList.remove('hidden');
    clearTimeout(this.lastToastTimer);
    this.lastToastTimer=setTimeout(()=>node.classList.add('hidden'),2450);
  },
  setView(route,options={}){
    if(!['home','drawer','assistant','house','settings'].includes(route))route='home';
    // Navigating away cancels any pending home-page widget restoration.
    // Returning Home issues its own authoritative snapshot instead.
    clearTimeout(this.nativePageTransitionTimer);
    this.nativePageTransitionTimer=null;
    this.nativePageTransitionActive=false;
    if(this.sheet)this.closeSheet();
    if(this.activeFolder)this.closeFolder();
    if(route!=='drawer'&&this.selectMode)this.disableLibrarySelection();
    if(route!=='home'&&this.edit&&!options.keepEdit)this.exitEdit();
    this.view=route;
    this.updateNativeWidgetLayer();
    document.body.dataset.view=route;
    document.querySelectorAll('.screen').forEach(n=>n.classList.toggle('active',n.id==='screen-'+route));
    if(route==='drawer'){
      this.refreshApps();
      this.renderDrawer();
    }
    if(route==='home'){
      this.renderHome();
      this.renderDock();
      this.renderPageDots();
    }
    $('editToolbar').classList.toggle('hidden',!this.edit||route!=='home');
    if(route==='settings')this.renderSettings();
    if(route==='assistant')this.refreshGreeting();
    this.scheduleWidgetSync();
  },
  goBack(){
    if(this.drag){this.endDrag(true);return;}
    if(this.activeFolder){this.closeFolder();return;}
    if(this.sheet){this.closeSheet();return;}
    if(this.view!=='home'){this.setView('home');return;}
    if(this.edit){this.exitEdit();return;}
    if(this.model.current!==this.model.settings.homeDefault){
      this.goPage(this.model.settings.homeDefault);return;
    }
  },
  enterEdit(){
    if(this.model.settings.layoutLocked){
      this.toast('HOME LOCKED · UNLOCK IN SETTINGS');return;
    }
    if(this.view!=='home')this.setView('home');
    this.edit=true;
    this.updateNativeWidgetLayer(false);
    document.body.classList.add('editing');
    $('editToolbar').classList.remove('hidden');
    this.renderHome();this.renderDock();
    this.scheduleWidgetSync();
  },
  exitEdit(){
    this.edit=false;this.selectedWidget=null;
    document.body.classList.remove('editing');
    $('editToolbar').classList.add('hidden');
    this.persist();this.renderHome();this.renderDock();
    this.scheduleWidgetSync();
  },
  goPage(id){
    const index=this.model.pages.findIndex(p=>p.id===id);
    if(index<0)return;
    const oldIndex=this.model.pages.findIndex(p=>p.id===this.model.current);
    if(oldIndex===index){
      this.renderPageDots();
      this.scheduleWidgetSync();
      return;
    }
    // A v0.6.3 regression animated actual Android RemoteViews off-screen.
    // Some providers kept their click surface but stopped drawing content.
    // Keep native widgets at real on-screen rectangles; hide during the
    // WebView slide and restore the destination in one versioned snapshot.
    clearTimeout(this.nativePageTransitionTimer);
    this.nativePageTransitionTimer=null;
    const touchingWidgets=[oldIndex,index].some(i=>
      this.model.pages[i]?.items.some(item=>item.type==='android-widget'));
    const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
    const deferNative=this.view==='home'&&this.model.settings.motion&&!reducedMotion&&
      Math.abs(index-oldIndex)===1&&touchingWidgets;
    this.nativePageTransitionActive=deferNative;
    if(deferNative){
      // Block touch surfaces as well as drawing, preventing invisible widgets
      // from intercepting taps while the WebView finishes its own animation.
      this.updateNativeWidgetLayer(false);
      clearTimeout(this.nativeWidgetTimer);
      clearTimeout(this.nativeWidgetFollowup);
      clearTimeout(this.nativeWidgetRecoveryTimer);
      clearTimeout(this.nativeWidgetStatusTimer);
    }
    this.model.current=id;
    this.hydrateHomePages?.();
    const track=$('homeTrack');
    if(track)track.style.transform='translate3d(-'+(index*100)+'%,0,0)';
    this.renderPageDots();
    // Changing desktop pages does not add or remove Android widgets.
    // Avoid scheduling a full native widget ID inventory scan on every swipe.
    this.persist(null,false);
    if(deferNative){
      this.nativePageTransitionTimer=setTimeout(()=>{
        this.nativePageTransitionTimer=null;
        this.nativePageTransitionActive=false;
        this.scheduleWidgetSync();
      },260);
    }else{
      this.scheduleWidgetSync();
    }
  },
  stepPage(delta){
    const i=this.model.pages.findIndex(p=>p.id===this.model.current);
    const index=i+delta;
    if(index<0||index>=this.model.pages.length)return;
    this.goPage(this.model.pages[index].id);
  },
  navigateHorizontal(direction){
    if(this.view==='home')this.stepPage(direction);
    if(this.view==='drawer')this.changeDrawerPage(direction);
  },
  launchApp(pkg){
    try{if(this.native()&&Core.packageOk(pkg))this.native().launchApp(pkg);
    else this.toast('APP UNAVAILABLE OUTSIDE ANDROID');}
    catch(e){this.toast('COULD NOT OPEN APPLICATION');}
  },
  openSystem(kind){
    if(kind==='mek'){this.setView('assistant');return;}
    if(kind==='house'){this.setView('house');return;}
    if(kind==='settings'){this.setView('settings');return;}
    if(kind==='drawer'){this.setView('drawer');return;}
    try{
      if(this.native()&&typeof this.native().openDefault==='function')this.native().openDefault(kind);
      else this.toast('OPEN '+kind.toUpperCase()+' ON YOUR PHONE');
    }catch(e){this.toast('COULD NOT OPEN '+kind.toUpperCase());}
  },
  openItem(item){
    if(!item)return;
    if(item.type==='folder'){this.openFolder(item.id);return;}
    if(item.type==='app'){this.launchApp(item.pkg);return;}
    if(item.type==='system'){this.openSystem(item.kind);return;}
    if(item.type==='widget'){
      if(item.kind==='mek')this.setView('assistant');
      else if(item.kind==='house')this.setView('house');
      else if(item.kind==='notes')this.openSheet('notes-edit');
      else if(item.kind==='tasks')this.openSheet('tasks-edit');
      else if(item.kind==='clock')this.openSystem('calendar');
      else if(item.kind==='battery')this.openSystem('battery');
      else if(item.kind==='weather')this.openSystem('weather');
      else if(item.kind==='music')this.openSystem('music');
      else if(item.kind==='calendar')this.openSystem('calendar');
    }
  },
  refreshApps(force=false){
    if(this.appsLoading)return;
    if(this.appsLoaded&&!force)return;
    if(this.appsLoaded&&!force&&Date.now()-this.lastAppsRequest<25000)return;
    this.appsLoading=true;this.lastAppsRequest=Date.now();
    const native=this.native();
    try{
      if(native&&typeof native.requestApps==='function'){native.requestApps();return;}
      this.appsLoading=false;this.appsLoaded=true;this.renderDrawer();this.renderDock();
    }catch(e){this.appsLoading=false;this.toast('APP DISCOVERY FAILED');}
  },
  appsReady(json){
    try{
      const arr=typeof json==='string'?JSON.parse(json):json;
      if(!Array.isArray(arr))throw Error('Expected app array');
      const seen=new Set();
      this.apps=arr.filter(a=>a&&typeof a.name==='string'&&Core.packageOk(a.pkg)&&!seen.has(a.pkg)&&seen.add(a.pkg))
        .map(a=>({pkg:a.pkg,label:a.name.slice(0,60),type:'app'}));
      this.apps.sort((a,b)=>a.label.localeCompare(b.label,undefined,{sensitivity:'base'}));
      this.appsLoaded=true;this.appsLoading=false;
      if(this.view==='drawer')this.renderDrawer();
      if(this.view==='home')this.renderHome();
      if(this.sheet==='apps-picker')this.renderSheet();
      this.scheduleIconDrain();
    }catch(e){this.appsLoading=false;this.toast('COULD NOT READ INSTALLED APPS');}
  },
  allDrawerItems(){
    const assigned=new Set(this.model.drawerFolders.flatMap(f=>f.apps.map(a=>a.pkg)));
    const apps=this.apps.filter(a=>!assigned.has(a.pkg));
    const items=[...this.systemCatalog,...apps,...this.model.drawerFolders];
    if(this.model.settings.appSort==='custom'){
      const positions=new Map(this.model.drawerOrder.map((key,index)=>[key,index]));
      items.sort((a,b)=>{
        const ka=a.type==='app'?a.pkg:a.id,kb=b.type==='app'?b.pkg:b.id;
        const ia=positions.get(ka)??-1,ib=positions.get(kb)??-1;
        if(ia>=0&&ib>=0)return ia-ib;
        if(ia>=0)return -1;if(ib>=0)return 1;
        return a.label?.localeCompare(b.label||b.name||'')||0;
      });
    }else{
      items.sort((a,b)=>(a.label||a.name||'').localeCompare(b.label||b.name||'',undefined,{sensitivity:'base'}));
    }
    if(!this.drawerQuery)return items;
    const needle=this.drawerQuery.toLowerCase();
    return items.filter(a=>(a.label||a.name||'').toLowerCase().includes(needle));
  },
  render(){
    this.renderHome();this.renderDock();this.renderPageDots();this.renderSettings();
    if(this.view==='drawer')this.renderDrawer();
    if(this.activeFolder)this.renderFolder();
    this.scheduleWidgetSync();
  },
  refreshClock(){
    const now=this.now();
    $('systemTime').textContent=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
    document.querySelectorAll('.clock-canvas').forEach(n=>this.drawClock(n,now));
    document.querySelectorAll('.date-text').forEach(n=>n.textContent=now.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}).toUpperCase().replace(',',' ·'));
    document.querySelectorAll('.calendar-date').forEach(n=>n.textContent=now.toLocaleDateString('en-US',{month:'short',day:'numeric'}).toUpperCase());
  },
  drawClock(canvas,now){
    const glyphs={
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
    const ctx=canvas.getContext('2d');if(!ctx)return;
    const value=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
    canvas.setAttribute('aria-label','Current time '+value);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const pitch=7.2, gap=10, width=(4*5+1)*pitch+4*gap;
    let x=(canvas.width-width)/2,y=12;
    for(const ch of value){
      glyphs[ch].forEach((line,iy)=>[...line].forEach((on,ix)=>{
        if(on==='1'){ctx.beginPath();ctx.arc(x+ix*pitch+2,y+iy*pitch+2,2.7,0,2*Math.PI);ctx.fillStyle='#e9bc82';ctx.fill();}
      }));
      x+=(ch===':'?1:5)*pitch+gap;
    }
  },
  refreshBattery(){
    try{
      const native=this.native();if(!native||typeof native.battery!=='function')return;
      const data=JSON.parse(native.battery());
      const value=Math.max(0,Math.min(100,Math.round(Number(data.percent))));
      if(!Number.isFinite(value))return;
      $('systemBattery').textContent=value+'%';
      document.querySelectorAll('.battery-percent').forEach(el=>el.textContent=value+'%');
      document.querySelectorAll('.battery-fill').forEach(el=>el.style.width=value+'%');
      document.querySelectorAll('.battery-status').forEach(el=>el.textContent=data.charging?'CHARGING':'ON BATTERY');
    }catch(e){}
  },
  canShowNativeWidgets(){
    return this.view==='home'&&!document.body.classList.contains('system-experience-open')&&!this.nativePageTransitionActive&&
      !this.edit&&!this.sheet&&!this.activeFolder&&!this.drag&&
      ['folderOverlay','sheetOverlay','homeSetup'].every(id=>{
        const overlay=$(id);
        return !overlay||overlay.classList.contains('hidden');
      });
  },
  nextNativeWidgetRevision(){
    // A revision ties together Android's visibility gate and geometry
    // updates. Asynchronous runOnUiThread callbacks can otherwise allow an
    // old "hide" operation to arrive AFTER the new "show" geometry packet.
    this.nativeWidgetRevision=(this.nativeWidgetRevision||0)+1;
    return this.nativeWidgetRevision;
  },
  updateNativeWidgetLayer(allowed=this.canShowNativeWidgets()){
    if(this.lastNativeLayerAllowed===allowed)return;
    this.lastNativeLayerAllowed=allowed;
    if(!allowed)this.nativeWidgetStatuses?.clear();
    // Explicitly invalidate cached placement on every modal/edit transition:
    // Home must always send a fresh SHOW + geometry packet on restoration.
    this.lastWidgetPayload=null;
    const native=this.native();
    if(native&&typeof native.setWidgetLayerActive==='function'){
      try{native.setWidgetLayerActive(allowed,this.nextNativeWidgetRevision());}
      catch(e){this.lastNativeLayerAllowed=null;}
    }
  },
  scheduleWidgetSync(){
    // Native AppWidgetHostViews live above the WebView, so a folder or sheet
    // must first hide them. Restoring Home sends a complete atomic snapshot.
    const show=this.canShowNativeWidgets();
    this.updateNativeWidgetLayer(show);
    clearTimeout(this.nativeWidgetTimer);
    clearTimeout(this.nativeWidgetFollowup);
    clearTimeout(this.nativeWidgetRecoveryTimer);
    clearTimeout(this.nativeWidgetStatusTimer);
    this.nativeWidgetTimer=setTimeout(()=>this.syncNativeWidgets(true),40);
    const activePage=show?Core.pageById(this.model,this.model.current):null;
    const hasNativeWidgets=!!activePage?.items.some(item=>item.type==='android-widget');
    if(hasNativeWidgets){
      this.nativeWidgetStatusTimer=setTimeout(()=>{
        if(!this.canShowNativeWidgets())return;
        const active=Core.pageById(this.model,this.model.current);
        for(const item of (active?.items||[])){
          if(item.type!=='android-widget')continue;
          if(this.nativeWidgetStatuses?.get(item.nativeId)!=='attached')
            this.nativeWidgetHostStatus(item.nativeId,'error');
        }
      },3400);
      // WebView layout or Android provider updates may settle a few frames
      // later. Retrying is deliberate, even if rects look unchanged.
      this.nativeWidgetFollowup=setTimeout(()=>this.syncNativeWidgets(true),320);
      this.nativeWidgetRecoveryTimer=setTimeout(()=>this.syncNativeWidgets(true),1400);
    }
  },
  syncNativeWidgets(force=false){
    const native=this.native();
    if(!native||typeof native.syncWidgetRects!=='function')return;
    const allow=this.canShowNativeWidgets();
    this.updateNativeWidgetLayer(allow);
    const widgets=[];
    if(allow){
      const page=Core.pageById(this.model,this.model.current);
      const cells=Array.from(document.querySelectorAll('.home-page'))
        .filter(n=>n.dataset.page===page?.id)
        .flatMap(n=>Array.from(n.querySelectorAll('.grid-cell')));
      for(const item of (page?.items||[])){
        if(item.type!=='android-widget')continue;
        const node=cells.find(n=>n.dataset.uid===item.id);
        if(!node)continue;
        const rect=node.getBoundingClientRect();
        if(!Number.isFinite(rect.width)||!Number.isFinite(rect.height)||
           rect.width<1||rect.height<1)continue;
        widgets.push({id:item.nativeId,x:rect.left,y:rect.top,
          w:rect.width,h:rect.height,visible:true});
      }
    }
    const snapshot={viewportWidth:window.innerWidth,allow,widgets};
    const signature=JSON.stringify(snapshot);
    if(!force&&signature===this.lastWidgetPayload)return;
    this.lastWidgetPayload=signature;
    // The payload owns visibility as well as positioning. Android processes
    // both atomically and rejects older revisions, eliminating the split-
    // bridge invisible-widget race observed after leaving Home edit mode.
    snapshot.revision=this.nextNativeWidgetRevision();
    try{native.syncWidgetRects(JSON.stringify(snapshot));}
    catch(e){this.lastWidgetPayload=null;}
  },
  nativeWidgetHostStatus(id,status){
    id=Number(id);
    if(!Number.isInteger(id)||id<1)return;
    if(!this.nativeWidgetStatuses)this.nativeWidgetStatuses=new Map();
    if(status==='attached')this.nativeWidgetStatuses.set(id,'attached');
    else if(status==='missing'||status==='error')
      this.nativeWidgetStatuses.set(id,'error');
    const state=this.nativeWidgetStatuses.get(id);
    for(const node of document.querySelectorAll('.grid-cell[data-type="android-widget"]')){
      const item=Core.locate(this.model,node.dataset.uid)?.item;
      if(item?.nativeId!==id)continue;
      const panel=node.querySelector('.native-widget-placeholder');
      if(!panel)continue;
      panel.classList.toggle('native-widget-error',state==='error');
      panel.dataset.hostStatus=state||'pending';
      if(state==='error'){
        const title=panel.querySelector('.widget-title-text');
        const hint=panel.querySelector('.widget-foot');
        if(title)title.textContent='Widget unavailable';
        if(hint)hint.textContent='TAP TO RETRY ANDROID WIDGET';
        panel.onclick=e=>{
          e.stopPropagation();
          this.lastWidgetPayload=null;
          this.syncNativeWidgets(true);
        };
      }else panel.onclick=null;
    }
  },
  chooseNativeWidget(){
    const native=this.native();
    if(!native||typeof native.pickAndroidWidget!=='function'){
      this.toast('ANDROID WIDGET PICKER REQUIRES THE APK');return;
    }
    this.closeSheet();this.setView('home');
    try{native.pickAndroidWidget();}catch(e){this.toast('ANDROID WIDGET PICKER UNAVAILABLE');}
  },
  nativeWidgetChosen(nativeId,label,minWidth,minHeight){
    if(!Number.isInteger(nativeId)||nativeId<=0)return;
    const cols=this.model.settings.homeCols,rows=this.model.settings.homeRows;
    const cw=Math.max(240,$('homeViewport').clientWidth)/cols;
    const ch=Math.max(360,$('homeViewport').clientHeight)/rows;
    const w=Core.clamp(Math.ceil(minWidth/cw),2,cols,2);
    const h=Core.clamp(Math.ceil(minHeight/ch),1,rows,2);
    const item={id:Core.uid('android-widget'),type:'android-widget',
      nativeId,label:String(label||'Android Widget').slice(0,60),x:0,y:0,w,h};
    const added=this.mutate(model=>Core.addHome(model,item,model.current));
    if(added){this.goPage(this.model.current);this.enterEdit();this.toast('ANDROID WIDGET ADDED · PRESS DONE');}
    else this.toast('NO SPACE FOR ANDROID WIDGET');
  },
  nativeWidgetError(){this.toast('WIDGET PICKER CANCELLED OR UNAVAILABLE');},
  nativeHome(){
    if(this.drag)this.endDrag(true);
    if(this.edit)this.exitEdit();
    this.setView('home');
    this.goPage(this.model.settings.homeDefault);
  },
  appsChanged(){
    this.appsLoaded=false;this.iconCache.clear();
    this.iconPending.clear();this.iconQueue.length=0;
    this.iconCooldown.clear();
    this.refreshApps(true);
  },
  refreshGreeting(){
    const el=$('assistantGreeting');if(!el)return;
    const hour=new Date().getHours();
    el.textContent=hour<6?'...You are still awake?':hour<12?'Good morning. The workshop is quiet. For now.':hour<18?'Oh! You caught me checking the instruments.':'I was absolutely not taking a nap.';
  },
  showHomeSetup(){
    const native=this.native();
    if(!native||typeof native.isDefaultHome!=='function')return;
    try{
      const selected=!!native.isDefaultHome();
      const dismissed=read('mek_v5_home_prompt_dismissed',false);
      if(!selected&&!dismissed)$('homeSetup').classList.remove('hidden');
      else $('homeSetup').classList.add('hidden');
    }catch(e){}
  },
  refreshNative(){
    this.refreshClock();this.refreshBattery();this.showHomeSetup();
    this.scheduleWidgetInventorySync();
    // Returning from provider configuration or another Android Activity
    // must reattach and remeasure any active AppWidgetHostViews.
    this.scheduleWidgetSync();
    if(Date.now()-this.lastAppsRequest>300000)this.refreshApps(true);
  },
  // App icon tiles are created before they're inserted into the DOM.
  // Queue them, then request only attached icons on the next frame.
  loadIcon(node,pkg){
    if(!node||!Core.packageOk(pkg))return;
    node.dataset.pkg=pkg;
    const cached=this.iconCache.get(pkg);
    if(cached){this.putIcon(node,cached);return;}
    const group=this.iconPending.get(pkg)||new Set();
    group.add(node);this.iconPending.set(pkg,group);
    if(!this.iconQueue.includes(pkg)&&!this.iconInflight.has(pkg))this.iconQueue.push(pkg);
    this.scheduleIconDrain();
  },
  iconIsActive(node){
    if(!node||!node.isConnected)return false;
    const screen=node.closest('.screen');
    if(screen&&!screen.classList.contains('active'))return false;
    const page=node.closest('.home-page');
    if(page&&page.dataset.page!==this.model.current)return false;
    const appPage=node.closest('.app-page');
    if(appPage&&Math.abs(Number(appPage.dataset.page)-this.drawerPage)>1)return false;
    const popup=node.closest('.folder-overlay,.sheet-overlay');
    if(popup&&popup.classList.contains('hidden'))return false;
    return true;
  },
  scheduleIconDrain(){
    if(this.iconDrainTimer)return;
    this.iconDrainTimer=setTimeout(()=>{
      this.iconDrainTimer=null;this.processIcons();
    },24);
  },
  processIcons(){
    if(this.iconInflight.size>0)return;
    const batch=[],delayed=[];
    while(this.iconQueue.length&&batch.length<12){
      const pkg=this.iconQueue.shift();
      if(this.iconCache.has(pkg)||this.iconInflight.has(pkg))continue;
      const set=this.iconPending.get(pkg);
      if(!set||!set.size)continue;
      const live=[...set].filter(node=>node.isConnected);
      if(!live.length){this.iconPending.delete(pkg);continue;}
      this.iconPending.set(pkg,new Set(live));
      if(!live.some(node=>this.iconIsActive(node))){delayed.push(pkg);continue;}
      if(Date.now()<(this.iconCooldown.get(pkg)||0)){delayed.push(pkg);continue;}
      batch.push(pkg);
    }
    this.iconQueue.push(...delayed);
    if(!batch.length)return;
    batch.forEach(pkg=>this.iconInflight.add(pkg));
    this.iconBatchCount++;
    const count=this.iconBatchCount;
    this.iconBatchTimer=setTimeout(()=>{
      if(count!==this.iconBatchCount)return;
      for(const pkg of [...this.iconInflight])this.iconReady(pkg,'');
    },5500);
    try{
      const native=this.native();
      if(native&&typeof native.requestAppIcons==='function'){
        native.requestAppIcons(JSON.stringify(batch));
      }else if(native&&typeof native.requestAppIcon==='function'){
        for(const pkg of batch)native.requestAppIcon(pkg);
      }else batch.forEach(pkg=>this.iconReady(pkg,''));
    }catch(e){batch.forEach(pkg=>this.iconReady(pkg,''));}
  },
  iconsReady(payload){
    try {
      const values=typeof payload==='string'?JSON.parse(payload):payload;
      if(!Array.isArray(values))return;
      for(const entry of values)if(entry&&Core.packageOk(entry.pkg)){
        this.iconReady(entry.pkg,entry.icon||'');
      }
    }catch(e){console.warn('Native icon response was invalid',e);}
    this.scheduleIconDrain();
  },
  iconReady(pkg,data){
    if(!Core.packageOk(pkg))return;
    // A late callback must never overwrite a newer successful icon.
    const good=typeof data==='string'&&/^data:image\/(?:webp|png);base64,/.test(data);
    if(good){
      if(this.iconCache.size>260){
        const oldest=this.iconCache.keys().next().value;
        this.iconCache.delete(oldest);
      }
      this.iconCache.set(pkg,data);
      this.iconCooldown.delete(pkg);
      const nodes=this.iconPending.get(pkg)||new Set();
      for(const node of nodes)this.putIcon(node,data);
      this.iconPending.delete(pkg);
    }else{
      // Don't cache empty icon responses forever. Keep letter placeholders
      // and allow a retry later if Android was briefly busy.
      this.iconPending.delete(pkg);
      this.iconCooldown.set(pkg,Date.now()+30000);
    }
    this.iconInflight.delete(pkg);
    if(!this.iconInflight.size){
      clearTimeout(this.iconBatchTimer);
      this.iconBatchTimer=null;
      this.scheduleIconDrain();
    }
  },
  putIcon(node,data){
    if(!node||!data)return;
    if(node.querySelector('img'))return;
    node.textContent='';
    const img=document.createElement('img');img.src=data;img.alt='';
    img.decoding='async';
    node.append(img);
  },
  validateBackup(json){
    if(typeof json!=='string'||json.length>1500000)throw Error('Invalid backup size');
    const raw=JSON.parse(json);
    if(!raw||raw.version!==5||!Array.isArray(raw.pages))throw Error('This file is not a MEK-AI v0.5 backup');
    return Core.normalize(raw);
  },
  exportBackup(){
    const json=JSON.stringify(this.model,null,2);
    try{
      if(this.native()&&typeof this.native().exportLayout==='function'){
        this.native().exportLayout(json);return;
      }
      this.toast('FILE EXPORT AVAILABLE ON ANDROID');
    }catch(e){this.toast('EXPORT FAILED');}
  },
  importBackup(){
    try{
      if(this.native()&&typeof this.native().importLayout==='function'){
        this.native().importLayout();return;
      }
      this.toast('CHOOSE FILE FROM ANDROID');
    }catch(e){this.toast('IMPORT FAILED');}
  },
  backupImported(json){
    try{
      const restored=this.validateBackup(json);
      this.mutate(model=>{Object.keys(model).forEach(k=>delete model[k]);Object.assign(model,restored);});
      this.goPage(this.model.settings.homeDefault);
      this.closeSheet();this.toast('BACKUP RESTORED');
    }catch(e){this.toast('INVALID BACKUP FILE');}
  },
  backupResult(message){this.toast(message==='saved'?'BACKUP FILE SAVED':'BACKUP CANCELLED OR FAILED');},
  install(){
    // New Home launches start on the user's chosen default desktop, not
    // whichever page was last saved before Android destroyed the Activity.
    if(Core.pageById(this.model,this.model.settings.homeDefault)){
      this.model.current=this.model.settings.homeDefault;
    }
    this.render();
    this.setupControls();
    this.setupLibraryOrganizer();
    this.installGestures();
    this.refreshClock();this.refreshBattery();
    this.refreshApps();this.showHomeSetup();this.refreshGreeting();
    this.scheduleWidgetInventorySync();
    this.scheduleWidgetSync();
    setInterval(()=>{this.refreshClock();this.refreshBattery();},30000);
    window.addEventListener('resize',()=>{this.renderHome();this.renderDock();if(this.view==='drawer')this.renderDrawer();});
  },
  setupControls(){
    document.addEventListener('click',event=>{
      const target=event.target;
      if(Date.now()<this.gestureSuppressUntil && !target.closest('.sheet-panel,.folder-window,.edit-toolbar')){
        event.preventDefault();event.stopImmediatePropagation();return;
      }
      const action=target.closest('[data-action]');
      if(action){this.openSystem(action.dataset.action);return;}
      const screen=target.closest('[data-screen]');
      if(screen){this.setView(screen.dataset.screen);return;}
      const sheet=target.closest('[data-sheet]');
      if(sheet){this.openSheet(sheet.dataset.sheet);return;}
      if(target.closest('[data-close-sub]')){this.setView('home');return;}
    },true);
    $('openEdit').onclick=()=>this.enterEdit();
    $('finishEdit').onclick=()=>this.exitEdit();
    const top=$('.edit-top');
    if(top){
      const undo=document.createElement('button');undo.textContent='↶ UNDO';undo.className='edit-undo';
      undo.style.cssText='font:10px Consolas,monospace;color:var(--amber);margin-left:auto;margin-right:10px';
      undo.onclick=()=>this.undo();
      top.insertBefore(undo,$('finishEdit'));
    }
    $('closeDrawer').onclick=()=>this.setView('home');
    $('appSearch').addEventListener('input',e=>{this.drawerQuery=e.target.value.trim();this.drawerPage=0;this.renderDrawer();});
    $('closeSheet').onclick=()=>this.closeSheet();
    $('closeSheetBackdrop').onclick=()=>this.closeSheet();
    $('closeFolder').onclick=()=>this.closeFolder();
    $('closeFolderBackdrop').onclick=()=>this.closeFolder();
    $('folderTitle').addEventListener('change',e=>{
      if(!this.activeFolder)return;
      const folder=this.findFolder(this.activeFolder);
      if(!folder)return;
      this.mutate(()=>{folder.name=e.target.value.trim().slice(0,35)||'Folder';});
    });
    $('folderAppearance').onclick=()=>this.openSheet('folder-color');
    $('folderAddApp').onclick=()=>{
      if(!this.activeFolder)return;
      this.picking={type:'folder',folderId:this.activeFolder};
      this.openSheet('apps-picker');
    };
    $('makeDefaultHome').onclick=()=>{try{this.native()?.requestHomeRole();}catch(e){}};
    $('dismissSetup').onclick=()=>{$('homeSetup').classList.add('hidden');store('mek_v5_home_prompt_dismissed',true);};
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'||event.key==='Backspace'&&!event.target.matches('input,textarea'))this.goBack();
    });
  }
};
window.Mek=Mek;
window.mekAppsReady=payload=>Mek.appsReady(payload);
window.mekIconReady=(pkg,data)=>Mek.iconReady(pkg,data);
window.mekIconsReady=payload=>Mek.iconsReady(payload);
window.refreshNative=()=>Mek.refreshNative();
window.goBackInLauncher=()=>Mek.goBack();
window.mekBackupImported=json=>Mek.backupImported(json);
window.mekBackupResult=message=>Mek.backupResult(message);
window.mekNativeWidgetChosen=(...args)=>Mek.nativeWidgetChosen(...args);
window.mekNativeWidgetStatus=(id,status)=>Mek.nativeWidgetHostStatus(id,status);
window.mekNativeWidgetError=()=>Mek.nativeWidgetError();
window.mekAppsChanged=()=>Mek.appsChanged();
window.mekNativeHome=()=>Mek.nativeHome();
window.addEventListener('DOMContentLoaded',()=>Mek.install());
})();
