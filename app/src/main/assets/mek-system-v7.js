/* MEK-AI Mobile 0.7.0 — interactive System Experience, NOT an Android SystemUI replacement. */
(function(){
'use strict';
const VERSION='0.7.2', KEY='mek_system_v7';
const $=id=>document.getElementById(id);
const DEFAULTS={accent:'amber',compact:false,clock24:false,reduceMotion:false,privateNotifications:true,nav:'gestures',character:true,lockNotifications:true,brightness:65};
let prefs={...DEFAULTS};
try{prefs={...DEFAULTS,...JSON.parse(localStorage.getItem(KEY)||'{}')};}catch(e){}
const S={view:'closed',previous:[],expanded:false,notice:'',notifications:[],unlocked:false,query:'',lastRefresh:0};
const safe=(s,n=150)=>String(s==null?'':s).slice(0,n);
function escape(s){return safe(s,400).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function native(){return window.MEK||null;}
function invoke(name,...args){try{const api=native();return api&&typeof api[name]==='function'?api[name](...args):null;}catch(e){return null;}}
function time(){return new Date().toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',hour12:!prefs.clock24});}
function date(){return new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(prefs));}catch(e){}}
function battery(){try{const v=JSON.parse(invoke('battery')||'{}');return Number.isFinite(+v.percent)?Math.max(0,Math.min(100,Math.round(v.percent))):null;}catch(e){return null;}}
function status(){const p=battery();return '<span>✦ MEK-AI / '+VERSION+'</span><span>'+time()+'　'+(p===null?'▣':p+'%')+'</span>';}
function icon(name){return {'wifi':'⌁','bluetooth':'ᛒ','flashlight':'✦','airplane':'✈','display':'◐','volume':'♫','battery':'▣','settings':'⚙','home':'⌂','lock':'▤','dnd':'☾','apps':'▦','assistant':'◈','notifications':'▤','privacy':'◇','storage':'▣','about':'ⓘ','wallpaper':'◈','gesture':'↔','sound':'♫','network':'⌁','device':'▣','security':'◇'}[name]||'◈';}
function panelTitle(kicker,title){return '<div class="sys-heading"><button type="button" data-sys-back aria-label="Back">‹</button><div><small>'+kicker+'</small><h2>'+title+'</h2></div><button type="button" data-sys-home aria-label="Return to Home">⌂</button></div>';}
function navigate(view,push=true){if(push&&S.view!=='closed'&&S.view!==view)S.previous.push(S.view);S.view=view;S.query='';refreshNative();draw();}
function open(view){if(window.Mek?.edit)window.Mek.exitEdit();if(window.Mek?.activeFolder)window.Mek.closeFolder();if(window.Mek?.sheet)window.Mek.closeSheet();S.previous=[];navigate(view,false);}
function close(){S.view='closed';S.previous=[];S.expanded=false;draw();}
function back(){if(S.view==='closed'){return false;}if(S.expanded&&S.view==='shade'){S.expanded=false;draw();return true;}if(S.previous.length){navigate(S.previous.pop(),false);return true;}close();return true;}
function reveal(){
 const root=$('systemExperience'),open=S.view!=='closed';
 const changed=root.classList.contains('sys-open')!==open;
 root.classList.toggle('sys-open',open);
 root.setAttribute('aria-hidden',open?'false':'true');
 document.body.classList.toggle('system-experience-open',open);
 // A clock tick, notification update or settings redraw is not a Home transition.
 // Only touch native AppWidgetHostViews when the overlay actually opens/closes.
 if(changed){
   if(open)window.Mek?.updateNativeWidgetLayer?.(false);
   else window.Mek?.scheduleWidgetSync?.();
 }
}
function lockView(){
  const n=S.notifications.length;
  return '<section class="sys-lock"><div class="sys-lock-top"><span>◈　MEK-AI / PERSONAL TERMINAL</span><button type="button" data-sys-view="shade">⌄　NOTICES</button></div>'+
  '<div class="sys-lock-center"><span class="sys-lock-sub">THE HIDEAWAY</span><div class="sys-lock-time" data-sys-clock>'+time()+'</div><div class="sys-lock-date">'+date()+'</div>'+
  (prefs.character?'<img class="sys-lock-robot" src="mek.webp" alt="MEK-AI robot companion">':'')+
  '<div class="sys-lock-caption">SYSTEM READY · SIMULATED LOCK SCREEN</div></div>'+
  '<div class="sys-lock-bottom">'+(prefs.lockNotifications?'<button data-sys-view="notifications">▤　'+n+' NOTIFICATION'+(n===1?'':'S')+'</button>':'')+
  '<button class="sys-lock-unlock" data-sys-unlock>⌃<span>SWIPE UP OR TAP TO ENTER</span></button>'+
  '<div class="sys-lock-caveat">PREVIEW ONLY · ANDROID\'S SECURE LOCK SCREEN IS UNCHANGED</div></div></section>';
}
const TILES=[
 ['wifi','WI-FI','wifi','Opens Android Wi-Fi controls'],
 ['bluetooth','BLUETOOTH','bluetooth','Opens Android Bluetooth controls'],
 ['flashlight','FLASHLIGHT','torch','Toggle the device torch when available'],
 ['airplane','AIRPLANE','airplane','Opens Android airplane-mode controls'],
 ['dnd','FOCUS','dnd','Opens Do Not Disturb settings'],
 ['display','DISPLAY','display','Opens Android display settings'],
 ['battery','BATTERY','battery','Opens Android battery settings'],
 ['settings','SETTINGS','sys-settings','Open MEK-AI Settings']
];
function tile([name,title,kind,hint]){
 const isTorch=kind==='torch', enabled=isTorch&&invoke('isTorchOn')===true;
 return '<button type="button" class="sys-quick-tile '+(enabled?'active':'')+'" data-sys-tile="'+kind+'" aria-label="'+title+' - '+hint+'"><span class="sys-quick-icon">'+icon(name)+'</span><span><b>'+title+'</b><small>'+(isTorch?(enabled?'ON':'OFF'):(kind==='sys-settings'?'MEK-AI':'OPEN CONTROLS'))+'</small></span></button>';
}
function shadeView(){
 const items=TILES.slice(0,S.expanded?8:4);
 return '<section class="sys-shade"><div class="sys-shade-handle" data-sys-expand>━━━━━━</div>'+
 '<div class="sys-shade-date">'+date().toUpperCase()+'</div><div class="sys-shade-top"><div class="sys-shade-clock">'+time()+'</div><div class="sys-top-actions"><button data-sys-view="lock" title="Lock-screen preview" aria-label="Open lock-screen preview">▣</button><button data-sys-view="settings" title="MEK-AI Settings" aria-label="MEK-AI Settings">⚙</button></div></div>'+
 '<div class="sys-quick-grid">'+items.map(tile).join('')+'</div>'+
 '<div class="sys-brightness"><span>☼</span><input aria-label="MEK-AI display brightness" type="range" min="10" max="100" value="'+prefs.brightness+'" data-sys-brightness><span>◐</span></div>'+
 '<div class="sys-shade-row"><button data-sys-expand>'+(S.expanded?'SHOW LESS':'ALL QUICK SETTINGS')+'　'+(S.expanded?'⌃':'⌄')+'</button><button data-sys-view="notifications">NOTIFICATIONS　↗</button></div>'+
 '<div class="sys-shade-notes">'+renderNotifications(true)+'</div>'+
 '<div class="sys-disclaimer">MEK-AI SHADE PREVIEW · SYSTEM SHADE REMAINS AVAILABLE</div></section>';
}
function refreshNotifications(){
 try{const list=JSON.parse(invoke('getNotifications')||'[]');S.notifications=Array.isArray(list)?list.slice(0,40):[];}catch(e){S.notifications=[];}
 S.lastRefresh=Date.now();
}
function permissionGranted(){return invoke('notificationAccessGranted')===true;}
function updateLive(){
 if(S.view==='closed')return;
 const root=$('systemExperience');
 const write=(selector,value)=>{const el=root.querySelector(selector);if(el&&el.textContent!==value)el.textContent=value;};
 // Preserve the actual scroll position and existing notification DOM during
 // periodic updates instead of rebuilding the entire full-screen overlay.
 const charge=battery();write('.sys-topbar span:last-child',time()+'　'+(charge===null?'▣':charge+'%'));
 if(S.view==='shade')write('.sys-shade-clock',time());
 if(S.view==='lock'){write('.sys-lock-time',time());write('.sys-lock-date',date());}
 if(Date.now()-S.lastRefresh<=12000)return;
 const old=JSON.stringify(S.notifications);
 refreshNotifications();
 if(old===JSON.stringify(S.notifications))return;
 if(S.view==='shade'||S.view==='notifications'){
   const list=root.querySelector(S.view==='shade'?'.sys-shade-notes':'.sys-notifications');
   if(list){const y=list.scrollTop;list.innerHTML=renderNotifications(S.view==='shade');list.scrollTop=y;}
 }else if(S.view==='lock'&&prefs.lockNotifications){
   write('.sys-lock-bottom [data-sys-view="notifications"]','▤　'+S.notifications.length+' NOTIFICATION'+(S.notifications.length===1?'':'S'));
 }
}
function renderNotifications(compact=false){
 if(!permissionGranted())return '<div class="sys-empty"><b>NOTIFICATION ACCESS IS OFF</b><p>Grant MEK-AI notification access to display your actual device notifications. You can revoke it in Android Settings.</p><button data-sys-tile="notification-access">ENABLE ACCESS ↗</button></div>';
 if(!S.notifications.length)return '<div class="sys-empty"><span>◌</span><b>ALL CLEAR</b><p>No visible device notifications right now.</p></div>';
 return '<div class="sys-notification-list">'+S.notifications.slice(0,compact?3:35).map(n=>{
 const name=escape(n.app||'Android'), title=prefs.privateNotifications&&S.view==='lock'?'Hidden notification':escape(n.title||name);
 const detail=prefs.privateNotifications&&S.view==='lock'?'':escape(n.text||'');
 const key=encodeURIComponent(safe(n.key,280));
 return '<article class="sys-notification"><div class="sys-notification-icon">'+icon('notifications')+'</div><div class="sys-notification-content"><small>'+name+'</small><b>'+title+'</b><span>'+detail+'</span></div><div class="sys-notification-actions"><button data-sys-open-notification="'+key+'" aria-label="Open notification">↗</button><button data-sys-dismiss-notification="'+key+'" aria-label="Dismiss notification">×</button></div></article>';
 }).join('')+'</div>';
}
function notificationView(){
 return '<section class="sys-page">'+panelTitle('DEVICE / LIVE EVENTS','Notifications')+
 '<div class="sys-section-label">DEVICE NOTIFICATIONS</div><div class="sys-notifications">'+renderNotifications(false)+'</div>'+
 '<div class="sys-section-tail"><button data-sys-tile="notification-access">MANAGE ACCESS ↗</button><button data-sys-refresh>REFRESH ↻</button></div>'+
 '<p class="sys-fineprint">Messages come from the Android notification listener only after permission is granted. This does not replace the Android system shade.</p></section>';
}
const SETTINGS=[
 {id:'personalization',title:'Personalization',sub:'Visual theme, clock, robot, layout',i:'wallpaper'},
 {id:'display',title:'Display',sub:'Brightness, motion, appearance',i:'display'},
 {id:'sound',title:'Sound & media',sub:'Device sound settings',i:'sound'},
 {id:'connectivity',title:'Network & connections',sub:'Wi-Fi, Bluetooth, mobile connections',i:'network'},
 {id:'notifications',title:'Notifications',sub:'Live notification permissions and previews',i:'notifications'},
 {id:'navigation',title:'Navigation',sub:'MEK-AI Back, Home and Recents demo',i:'gesture'},
 {id:'security',title:'Security & privacy',sub:'Authentication and private notifications',i:'security'},
 {id:'device',title:'Device',sub:'Battery, storage, apps and Android Settings',i:'device'},
 {id:'assistant',title:'MEK-AI companion',sub:'Robot, voice assistant and home controls',i:'assistant'},
 {id:'about',title:'About MEK-AI',sub:'Prototype capabilities and system limits',i:'about'}
];
function prefSwitch(key,label,hint){return '<label class="sys-pref"><span><b>'+label+'</b><small>'+hint+'</small></span><input type="checkbox" data-sys-pref="'+key+'" '+(prefs[key]?'checked':'')+' aria-label="'+label+'"></label>';}
function action(label,desc,kind){return '<button class="sys-settings-action" data-sys-tile="'+kind+'"><span><b>'+label+'</b><small>'+desc+'</small></span><span>↗</span></button>';}
function settingView(){
 const found=SETTINGS.filter(x=>(x.title+' '+x.sub).toLowerCase().includes(S.query.toLowerCase()));
 return '<section class="sys-page">'+panelTitle('SYSTEM EXPERIENCE / CONFIGURATION','MEK-AI Settings')+
 '<div class="sys-search"><span>⌕</span><input type="search" data-sys-search placeholder="Search settings" aria-label="Search MEK-AI settings" value="'+escape(S.query)+'"></div>'+
 '<div class="sys-setting-groups">'+found.map(x=>'<button class="sys-category" data-sys-category="'+x.id+'"><span class="sys-category-icon">'+icon(x.i)+'</span><span><b>'+x.title+'</b><small>'+x.sub+'</small></span><span>›</span></button>').join('')+'</div>'+
 '<p class="sys-fineprint">Preferences change the MEK-AI prototype. Restricted device controls open the real Android Settings app.</p></section>';
}
function categoryView(){
 const id=S.view.slice('category:'.length),info=SETTINGS.find(s=>s.id===id);
 if(!info)return settingView();
 let content='';
 if(id==='personalization')content=
 '<div class="sys-section-label">MEK-AI APPEARANCE</div>'+
 '<div class="sys-choice-row"><button data-sys-accent="amber" class="'+(prefs.accent==='amber'?'selected':'')+'">AMBER</button><button data-sys-accent="moss" class="'+(prefs.accent==='moss'?'selected':'')+'">MOSS</button></div>'+
 prefSwitch('character','Animated companion art','Show MEK-AI artwork on the lock-screen preview')+
 prefSwitch('compact','Compact controls','Use denser control and menu spacing')+
 prefSwitch('clock24','24-hour clock','Display time in 24-hour format')+
 action('Home appearance','Open the existing Home customization','home-settings');
 if(id==='display')content=prefSwitch('reduceMotion','Reduce animations','Disable decorative transition effects')+
 '<div class="sys-section-label">APP DISPLAY BRIGHTNESS</div><div class="sys-brightness"><span>☼</span><input type="range" min="10" max="100" data-sys-brightness value="'+prefs.brightness+'"><span>'+prefs.brightness+'%</span></div>'+
 action('System display settings','Full device brightness and display controls','display');
 if(id==='sound')content=action('Volume controls','Open Android sound settings','volume')+action('Do Not Disturb','Open Android notification interruption settings','dnd');
 if(id==='connectivity')content=action('Wi-Fi','Open Android Wi-Fi controls','wifi')+action('Bluetooth','Open Bluetooth controls','bluetooth')+action('Airplane mode','Restricted: controlled by Android','airplane');
 if(id==='notifications')content=action('Notification access','Allow or revoke Android notification access','notification-access')+
 prefSwitch('privateNotifications','Hide private lock-screen previews','Protect content in the simulated lock preview')+
 prefSwitch('lockNotifications','Show lock-screen notification count','Display unread count and shortcut')+
 action('View notifications','Open live notification inbox','notifications-view');
 if(id==='navigation')content='<div class="sys-section-label">MEK-AI PROTOTYPE NAVIGATION</div>'+
 '<div class="sys-choice-row"><button data-sys-nav="gestures" class="'+(prefs.nav==='gestures'?'selected':'')+'">GESTURE BAR</button><button data-sys-nav="buttons" class="'+(prefs.nav==='buttons'?'selected':'')+'">3 BUTTONS</button></div>'+
 '<p class="sys-fineprint">This setting changes only the MEK-AI prototype footer; Android\'s system navigation remains unchanged.</p>';
 if(id==='security')content='<div class="sys-empty"><b>SECURE UNLOCK STAYS WITH ANDROID</b><p>MEK-AI does not ask you to create or enter a real PIN. Use your system lock screen for actual device security.</p></div>'+
 action('Android security settings','Biometrics, PIN and device lock','security')+
 action('Try lock-screen preview','Show the simulated MEK-AI lock screen','lock-view');
 if(id==='device')content=action('Android Settings','Open the real device configuration','settings-native')+
 action('Battery','Android battery information','battery')+
 action('Installed applications','Android apps settings','apps')+
 action('Default Home app','Choose your device launcher','home-role')+
 action('MEK-AI Home settings','Existing launcher grids, themes, widgets','home-settings');
 if(id==='assistant')content='<div class="sys-assistant"><img src="mek.webp" alt="MEK-AI companion"><span>◈ COMPANION / CONNECTED LAUNCHER</span><h3>HELLO, OPERATOR.</h3><p>My voice assistant opens in the existing MEK-AI experience. Your phone will request microphone access when needed.</p><button data-sys-tile="assistant-open">TALK TO MEK-AI ↗</button><button data-sys-tile="house-open">HOUSE CONTROLS ↗</button></div>';
 if(id==='about')content='<div class="sys-about"><span>◈ MK / 07</span><h3>MEK-AI MOBILE '+VERSION+'</h3><p>SYSTEM EXPERIENCE PREVIEW</p><p>Custom Home, lock-screen prototype, notification inbox, Quick Settings, in-app navigation, and Settings. This Android APK does not replace protected SystemUI, system gestures, or keyguard.</p><p>DESIGNED FOR ANDROID 12+ · APPETIZE EVALUATION</p></div>';
 return '<section class="sys-page">'+panelTitle('MEK-AI SETTINGS / '+id.toUpperCase(),escape(info.title))+'<div class="sys-category-detail">'+content+'</div></section>';
}
function recentView(){
 return '<section class="sys-page">'+panelTitle('NAVIGATION / SESSION','Recent screens')+'<div class="sys-section-label">MEK-AI SCREENS</div>'+
 [['home','Home'],['lock','Lock screen preview'],['shade','Quick Settings'],['notifications','Notifications'],['settings','Settings']].map(([id,name])=>'<button class="sys-recent" data-sys-'+(id==='home'?'home':'view')+'="'+id+'"><span>'+icon(id)+'</span><b>'+name+'</b><span>↗</span></button>').join('')+
 '<p class="sys-fineprint">This is the prototype\'s screen history, not Android\'s real Recent Apps list.</p></section>';
}
function footer(){
 if(prefs.nav==='buttons')return '<nav class="sys-navigation" aria-label="MEK-AI prototype navigation"><button data-sys-back aria-label="Back">◁</button><button data-sys-home aria-label="Home">○</button><button data-sys-view="recents" aria-label="Recent screens">□</button></nav>';
 return '<nav class="sys-navigation gestures" aria-label="MEK-AI prototype navigation"><button data-sys-back aria-label="Back" title="Back">‹</button><button class="sys-gesture-pill" data-sys-home aria-label="Return to Home"><span></span></button><button data-sys-view="recents" aria-label="Recent screens">□</button></nav>';
}
function draw(){
 const root=$('systemExperience');if(!root)return;
 reveal();if(S.view==='closed'){root.innerHTML='';return;}
 root.classList.toggle('sys-moss',prefs.accent==='moss');
 root.classList.toggle('sys-compact',prefs.compact);
 root.classList.toggle('sys-reduced-motion',prefs.reduceMotion);
 const content=S.view==='lock'?lockView():S.view==='shade'?shadeView():S.view==='notifications'?notificationView():
   S.view==='settings'?settingView():S.view==='recents'?recentView():S.view.startsWith('category:')?categoryView():settingView();
 root.innerHTML='<div class="sys-backdrop"></div><div class="sys-shell"><header class="sys-topbar">'+status()+'</header><div class="sys-content">'+content+'</div>'+
 (S.notice?'<div class="sys-notice" role="status">'+escape(S.notice)+'</div>':'')+footer()+'</div>';
}
function toast(msg){S.notice=msg;draw();clearTimeout(toast.timer);toast.timer=setTimeout(()=>{S.notice='';if(S.view!=='closed')draw();},2600);}
function nativeTile(kind){
 const mapped={wifi:'wifi',bluetooth:'bluetooth',display:'display',battery:'battery',settings:'settings',airplane:'airplane',dnd:'dnd',volume:'volume',apps:'apps',security:'security','settings-native':'settings','home-role':'home'};
 if(kind==='sys-settings'){navigate('settings');return;}
 if(kind==='notifications-view'){navigate('notifications');return;}
 if(kind==='lock-view'){navigate('lock');return;}
 if(kind==='home-settings'){close();window.Mek?.setView('settings');return;}
 if(kind==='assistant-open'){close();window.Mek?.setView('assistant');return;}
 if(kind==='house-open'){close();window.Mek?.setView('house');return;}
 if(kind==='notification-access'){invoke('openNotificationAccess');toast('ANDROID NOTIFICATION ACCESS SETTINGS OPENED');return;}
 if(kind==='torch'){
   const result=invoke('toggleTorch');if(result===null||result==='unavailable')toast('FLASHLIGHT UNAVAILABLE IN THIS DEVICE OR EMULATOR');
   else toast(result==='on'?'FLASHLIGHT ON':'FLASHLIGHT OFF');return;
 }
 if(mapped[kind]){invoke('openDefault',mapped[kind]);return;}
 toast('DEVICE CONTROL NOT AVAILABLE');
}
function refreshNative(){if(S.view==='notifications'||S.view==='shade'||S.view==='lock'){refreshNotifications();}}
function consume(event){
 const target=event.target;if(!target.closest('#systemExperience'))return;
 const btn=target.closest('button');
 if(btn?.hasAttribute('data-sys-home')){event.stopPropagation();close();return;}
 if(btn?.hasAttribute('data-sys-back')){event.stopPropagation();back();return;}
 if(btn?.hasAttribute('data-sys-unlock')){event.stopPropagation();close();return;}
 if(btn?.hasAttribute('data-sys-refresh')){refreshNative();draw();return;}
 if(btn?.hasAttribute('data-sys-expand')){S.expanded=!S.expanded;draw();return;}
 if(btn?.hasAttribute('data-sys-view')){const dest=btn.dataset.sysView;event.stopPropagation();navigate(dest);return;}
 if(btn?.hasAttribute('data-sys-category')){navigate('category:'+btn.dataset.sysCategory);return;}
 if(btn?.hasAttribute('data-sys-tile')){nativeTile(btn.dataset.sysTile);return;}
 if(btn?.hasAttribute('data-sys-nav')){prefs.nav=btn.dataset.sysNav;persist();draw();return;}
 if(btn?.hasAttribute('data-sys-accent')){prefs.accent=btn.dataset.sysAccent;persist();draw();return;}
 if(btn?.hasAttribute('data-sys-open-notification')){
   invoke('openNotification',decodeURIComponent(btn.dataset.sysOpenNotification));refreshNative();draw();return;
 }
 if(btn?.hasAttribute('data-sys-dismiss-notification')){
   invoke('dismissNotification',decodeURIComponent(btn.dataset.sysDismissNotification));refreshNative();draw();return;
 }
}
function install(){
 const root=$('systemExperience');if(!root)return;
 document.addEventListener('click',e=>{const btn=e.target.closest('[data-sys-open]');if(btn&&!root.contains(btn))open(btn.dataset.sysOpen);});
 root.addEventListener('click',consume);
 root.addEventListener('change',e=>{
   if(e.target.dataset.sysPref){const key=e.target.dataset.sysPref;if(Object.prototype.hasOwnProperty.call(DEFAULTS,key)){prefs[key]=!!e.target.checked;persist();draw();}}
 });
 root.addEventListener('input',e=>{
   if(e.target.hasAttribute('data-sys-brightness')){prefs.brightness=Math.max(10,Math.min(100,+e.target.value||65));persist();invoke('setAppBrightness',prefs.brightness);return;}
   if(e.target.hasAttribute('data-sys-search')){S.query=e.target.value;const pos=e.target.selectionStart;draw();const input=root.querySelector('[data-sys-search]');if(input){input.focus();input.setSelectionRange(pos,pos);}return;}
 });
 // Existing launcher gesture controller listens on document; stop propagation of
 // covered-area pointer/touch events so dragging a panel never moves Home icons.
 ['touchstart','touchmove','touchend','pointerdown','pointermove','pointerup','contextmenu'].forEach(type=>{
   root.addEventListener(type,e=>e.stopPropagation());
 });
 let touch=null;
 root.addEventListener('touchstart',e=>{
   if(e.touches.length!==1){touch=null;return;}
   const t=e.touches[0];
   touch={x:t.clientX,y:t.clientY,view:S.view,
     notes:!!e.target.closest('.sys-shade-notes'),
     handle:!!e.target.closest('.sys-shade-handle'),
     control:!!e.target.closest('button,input')};
 },{passive:true});
 root.addEventListener('touchend',e=>{
   if(!touch||!e.changedTouches.length)return;
   const start=touch;touch=null;
   const t=e.changedTouches[0],dy=t.clientY-start.y,dx=t.clientX-start.x;
   if(Math.abs(dy)<70||Math.abs(dy)<Math.abs(dx)*1.2||start.control||S.view!==start.view)return;
   if(S.view==='lock'&&dy< -70){close();return;}
   if(S.view!=='shade')return;
   // Swiping on a notification reveals the full inbox, never sends the user Back.
   // Swiping inside normal scroll content is left to the WebView's native scroll.
   if(start.notes&&dy< -75){navigate('notifications');return;}
   if(!start.handle)return;
   if(dy>75&&!S.expanded){S.expanded=true;draw();}
   else if(dy< -75&&S.expanded){S.expanded=false;draw();}
 },{passive:true});
 root.addEventListener('touchcancel',()=>{touch=null;},{passive:true});
 document.addEventListener('keydown',e=>{if(S.view!=='closed'&&(e.key==='Escape'||e.key==='Backspace'&&!e.target.matches('input,textarea'))){e.preventDefault();back();}},true);
 // Gesture from top bezel to open an in-app replacement shade preview.
 let edge=null;
 document.addEventListener('touchstart',e=>{const t=e.touches[0];edge=(S.view==='closed'&&t?.clientY<58)?t.clientY:null;},{passive:true});
 document.addEventListener('touchend',e=>{if(edge===null)return;const t=e.changedTouches[0];const start=edge;edge=null;if(t&&t.clientY-start>85)open('shade');},{passive:true});
 $('terminalStatus')?.addEventListener('click',()=>open('shade'));
 const shortcut=document.createElement('button');shortcut.type='button';shortcut.className='sys-launch-shortcut';shortcut.id='systemExperienceLaunch';
 shortcut.textContent='◈ SYSTEM';shortcut.setAttribute('aria-label','Open MEK-AI system experience');
 shortcut.addEventListener('click',()=>open('shade'));
 $('terminalStatus')?.append(shortcut);
 // Android's actual Back button already delegates to window.goBackInLauncher.
 const oldBack=window.goBackInLauncher;window.goBackInLauncher=()=>back()||(typeof oldBack==='function'&&oldBack());
 window.mekSystemRefresh=()=>{refreshNative();if(S.view!=='closed')draw();};
 invoke('setAppBrightness',prefs.brightness);
 setInterval(updateLive,15000);
 draw();
}
window.MekSystem={open,close,back,get view(){return S.view;},get preferences(){return {...prefs};},refresh:()=>{refreshNative();draw();}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();