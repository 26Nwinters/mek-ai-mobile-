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
const Mek={
  Core,$,KEY,model:initial,
  view:'home',edit:false,drawerPage:0,folderPage:0,
  activeFolder:null,drawerQuery:'',picking:null,sheet:null,
  apps:[],appsLoaded:false,appsLoading:false,lastAppsRequest:0,
  iconCache:new Map(),iconQueue:[],iconPending:new Map(),iconBusy:null,
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
    try{result=action(this.model);}catch(e){console.warn('Layout action failed',e);this.toast('COULD NOT CHANGE LAYOUT');return false;}
    const after=JSON.stringify(this.model);
    if(before!==after){
      this.history.push(before);
      if(this.history.length>20)this.history.shift();
      this.persist();
      this.render();
    }
    return result;
  },
  persist(){
    const ok=store(KEY,this.model);
    if(!ok)this.toast('PHONE STORAGE IS UNAVAILABLE');
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
    if(this.sheet)this.closeSheet();
    if(this.activeFolder)this.closeFolder();
    if(route!=='home'&&this.edit&&!options.keepEdit)this.exitEdit();
    this.view=route;
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
    if(this.view!=='home')this.setView('home');
    this.edit=true;
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
    this.model.current=id;
    const track=$('homeTrack');
    if(track)track.style.transform='translate3d(-'+(index*100)+'%,0,0)';
    this.renderPageDots();
    this.persist();
    this.scheduleWidgetSync();
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
      this.renderDrawer();this.renderDock();
      if(this.view==='home')this.renderHome();
      if(this.sheet==='apps-picker')this.openSheet('apps-picker');
    }catch(e){this.appsLoading=false;this.toast('COULD NOT READ INSTALLED APPS');}
  },
  allDrawerItems(){
    const assigned=new Set(this.model.drawerFolders.flatMap(f=>f.apps.map(a=>a.pkg)));
    const apps=this.apps.filter(a=>!assigned.has(a.pkg));
    const items=[...this.systemCatalog,...apps,...this.model.drawerFolders];
    if(this.model.settings.appSort==='custom'){
      const order=this.model.drawerOrder;
      items.sort((a,b)=>{
        const ka=a.type==='app'?a.pkg:a.id,kb=b.type==='app'?b.pkg:b.id;
        const ia=order.indexOf(ka),ib=order.indexOf(kb);
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
  render(){this.renderHome();this.renderDock();this.renderPageDots();this.renderSettings();if(this.view==='drawer')this.renderDrawer();if(this.activeFolder)this.renderFolder();this.scheduleWidgetSync();},
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
  scheduleWidgetSync(){
    clearTimeout(this.nativeWidgetTimer);
    this.nativeWidgetTimer=setTimeout(()=>this.syncNativeWidgets(),50);
    if(this.view==='home')setTimeout(()=>this.syncNativeWidgets(),290);
  },
  syncNativeWidgets(){
    const native=this.native();if(!native||typeof native.syncWidgetRects!=='function')return;
    const visible=this.view==='home'&&!this.edit&&!this.sheet&&!this.activeFolder&&
      $('homeSetup').classList.contains('hidden');
    const widgets=[];
    if(visible){
      const page=Core.pageById(this.model,this.model.current);
      for(const item of (page?.items||[])){
        if(item.type!=='android-widget')continue;
        const n=Array.from(document.querySelectorAll('.grid-cell')).find(x=>x.dataset.uid===item.id);
        if(!n)continue;
        const rect=n.getBoundingClientRect();
        if(!rect.width||!rect.height)continue;
        widgets.push({id:item.nativeId,x:rect.left,y:rect.top,w:rect.width,h:rect.height,visible:true});
      }
    }
    try{native.syncWidgetRects(JSON.stringify({viewportWidth:window.innerWidth,widgets}));}
    catch(e){}
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
    if(Date.now()-this.lastAppsRequest>30000)this.refreshApps(true);
  },
  loadIcon(node,pkg){
    if(!node||!Core.packageOk(pkg))return;
    node.dataset.pkg=pkg;
    if(this.iconCache.has(pkg)){
      this.putIcon(node,this.iconCache.get(pkg));
      return;
    }
    if(!this.iconPending.has(pkg)){
      this.iconPending.set(pkg,[]);
      this.iconQueue.push(pkg);
    }
    this.iconPending.get(pkg).push(node);
    if(this.iconObserver){
      this.iconObserver.observe(node);
    }else this.processIcons();
  },
  requestVisibleIcon(node){
    if(!node||!node.dataset.pkg)return;
    if(this.iconObserver)this.iconObserver.unobserve(node);
    this.processIcons();
  },
  processIcons(){
    if(this.iconBusy)return;
    while(this.iconQueue.length){
      const pkg=this.iconQueue.shift();
      const connected=(this.iconPending.get(pkg)||[]).some(n=>n.isConnected);
      if(!connected){this.iconPending.delete(pkg);continue;}
      this.iconBusy=pkg;
      try{
        const bridge=this.native();
        if(bridge&&typeof bridge.requestAppIcon==='function'){
          bridge.requestAppIcon(pkg);
          setTimeout(()=>{if(this.iconBusy===pkg)this.iconReady(pkg,'');},3000);
        }else this.iconReady(pkg,'');
      }catch(e){this.iconReady(pkg,'');}
      break;
    }
  },
  iconReady(pkg,data){
    if(!Core.packageOk(pkg))return;
    const value=typeof data==='string'?data:'';
    if(this.iconCache.size>250)this.iconCache.clear();
    this.iconCache.set(pkg,value);
    const nodes=this.iconPending.get(pkg)||[];
    this.iconPending.delete(pkg);
    nodes.forEach(n=>this.putIcon(n,value));
    if(this.iconBusy===pkg)this.iconBusy=null;
    setTimeout(()=>this.processIcons(),0);
  },
  putIcon(node,data){
    if(!node||!node.isConnected||!data)return;
    node.textContent='';
    const img=document.createElement('img');img.src=data;img.alt='';
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
    if(typeof IntersectionObserver==='function'){
      this.iconObserver=new IntersectionObserver(entries=>{
        let any=false;
        entries.forEach(entry=>{
          if(entry.isIntersecting){this.iconObserver.unobserve(entry.target);any=true;}
        });
        if(any)this.processIcons();
      },{rootMargin:'180px'});
    }
    this.render();
    this.setupControls();
    this.installGestures();
    this.refreshClock();this.refreshBattery();
    this.refreshApps();this.showHomeSetup();this.refreshGreeting();
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
window.refreshNative=()=>Mek.refreshNative();
window.goBackInLauncher=()=>Mek.goBack();
window.mekBackupImported=json=>Mek.backupImported(json);
window.mekBackupResult=message=>Mek.backupResult(message);
window.mekNativeWidgetChosen=(id,label,w,h)=>Mek.nativeWidgetChosen(id,label,w,h);
window.mekNativeWidgetError=()=>Mek.nativeWidgetError();
window.mekAppsChanged=()=>Mek.appsChanged();
window.mekNativeHome=()=>Mek.nativeHome();
window.addEventListener('DOMContentLoaded',()=>Mek.install());
})();
