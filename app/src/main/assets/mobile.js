/* MEK-AI Mobile / lightweight on-device launcher logic.
   Native actions only through the allowlisted Android bridge in MainActivity. */
'use strict';
const STORAGE = {tasks:'mek_mobile_tasks_v1',wallpaper:'mek_mobile_wallpaper_v1',motion:'mek_mobile_reduce_motion_v1'};
const appState = {route:'home',apps:[],loaded:false};
const $ = (id) => document.getElementById(id);
function storageGet(key, fallback) { try { const x=localStorage.getItem(key); return x===null?fallback:JSON.parse(x); } catch(e){ return fallback; } }
function storageSet(key,v) { try {localStorage.setItem(key,JSON.stringify(v));} catch(e) {} }
function navigate(route) {
  if (!['home','drawer','mek','controls','settings'].includes(route)) route='home';
  appState.route=route;
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+route));
  document.querySelectorAll('.nav-item').forEach(v=>v.classList.toggle('on',v.dataset.route===route));
  window.scrollTo({top:0,behavior:'instant'});
  if(route==='drawer') {refreshApps(); setTimeout(()=>{ const input=$('appSearch'); if(input && !input.value) input.blur(); },50); }
  if(route==='home') {drawClock(); updateBattery();}
}
function goBackInLauncher() {if(appState.route!=='home')navigate('home');else window.scrollTo({top:0,behavior:'smooth'});}
const GLYPHS = {
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
 const canvas=$('dotclock'); if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx)return;
 const now=new Date(),str=now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false});
 canvas.setAttribute('aria-label','Current time '+str);
 const sizes=Array.from(str,c=>c===':'?1:5);
 const pitch=7.2,gap=10,width=sizes.reduce((a,b)=>a+b*pitch+gap,0)-gap;
 let x=Math.max(2,(canvas.width-width)/2),y=22;
 ctx.clearRect(0,0,canvas.width,canvas.height);
 str.split('').forEach((char)=>{
   const glyph=GLYPHS[char]||GLYPHS['0'],w=char===':'?1:5;
   glyph.forEach((row,iy)=>row.split('').forEach((dot,ix)=>{
      if(dot!=='1') return;
      ctx.beginPath();ctx.arc(x+ix*pitch+2.5,y+iy*pitch+2.5,2.65,0,Math.PI*2);
      ctx.fillStyle='#f1e5d1';ctx.fill();
   }));
   x+=w*pitch+gap;
 });
}
function updateDate(){
 const now=new Date();
 $('topTime').textContent=now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false});
 $('homeDate').textContent=now.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}).toUpperCase().replace(',',' ·');
 drawClock();
}
function updateBattery(){
 try {
  if(!window.MEK)return;
  const r=JSON.parse(MEK.battery());
  if(typeof r.percent!=='number')return;
  $('topBattery').textContent=r.percent+'%';
  $('batteryValue').innerHTML=r.percent+'<small>%</small>';
  $('batteryFill').style.width=r.percent+'%';
  $('batteryDesc').textContent=r.charging?'CHARGING NOW':'DEVICE BATTERY';
 }catch(e){}
}
function refreshNative(){updateBattery();updateDate();}
function getTasks(){
 const t=storageGet(STORAGE.tasks,[]);
 return Array.isArray(t)?t.filter(x=>x&&typeof x.text==='string').slice(0,30):[];
}
function renderTasks(){
 const host=$('taskList');host.textContent='';
 const tasks=getTasks();
 if(tasks.length===0) {
   const empty=document.createElement('div');empty.className='task-placeholder';empty.textContent='NO TASKS YET · ';
   const add=document.createElement('button');add.textContent='ADD ONE +';add.onclick=addTask;empty.appendChild(add);host.appendChild(empty);
   return;
 }
 tasks.forEach((task,i)=>{
   const row=document.createElement('button');row.className='task-line'+(task.done?' complete':'');
   const circle=document.createElement('span');circle.className='task-check';circle.textContent=task.done?'✓':'';
   const copy=document.createElement('span');copy.textContent=task.text;
   row.append(circle,copy);
   row.onclick=()=>{const list=getTasks();if(!list[i])return;list[i].done=!list[i].done;storageSet(STORAGE.tasks,list);renderTasks();};
   row.oncontextmenu=(ev)=>{ev.preventDefault();const list=getTasks();list.splice(i,1);storageSet(STORAGE.tasks,list);renderTasks();};
   host.appendChild(row);
 });
 const hint=document.createElement('div');hint.className='micro-label';hint.style.cssText='text-align:right;color:#899887;padding:8px 2px 1px';hint.textContent='HOLD A TASK TO DELETE';host.appendChild(hint);
}
function addTask(){
 const overlay=document.createElement('div');
 overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.79);z-index:50;display:grid;place-items:center;padding:20px';
 const panel=document.createElement('form');
 panel.style.cssText='background:#131d16;border:1px solid #b78951;border-radius:16px;padding:20px;max-width:350px;width:100%;box-shadow:0 24px 65px #000';
 const label=document.createElement('label');label.textContent='NEW TASK / YOUR LIST';
 label.className='micro-label warm';label.style.display='block';
 const field=document.createElement('input');field.type='text';field.maxLength=140;field.required=true;field.placeholder='What needs doing?';
 field.style.cssText='margin:17px 0;width:100%;padding:13px;background:#080f0b;color:#f2e2cf;border:1px solid #736048;border-radius:8px';
 const actions=document.createElement('div');actions.style.cssText='display:flex;gap:9px';
 const cancel=document.createElement('button');cancel.type='button';cancel.textContent='CANCEL';cancel.className='outline-action';cancel.style.flex='1';
 cancel.onclick=()=>overlay.remove();
 const save=document.createElement('button');save.type='submit';save.textContent='ADD TASK';save.className='primary-action';save.style.flex='1';
 actions.append(cancel,save);panel.append(label,field,actions);overlay.append(panel);document.body.appendChild(overlay);
 panel.onsubmit=(event)=>{event.preventDefault();const value=field.value.trim();if(!value)return;
 const tasks=getTasks();tasks.push({text:value,done:false});storageSet(STORAGE.tasks,tasks);overlay.remove();renderTasks();};
 field.focus();
}
function refreshApps(){
 if(appState.loaded)return;
 try {
   if(!window.MEK)throw new Error('Native bridge unavailable');
   const apps=JSON.parse(MEK.getApps());
   if(!Array.isArray(apps))throw new Error('App list not an array');
   appState.apps=apps;appState.loaded=true;
   renderApps();
 }catch(error){$('appCount').textContent='APP LIST UNAVAILABLE';}
}
function renderApps(){
 const term=($('appSearch').value||'').toLowerCase().trim();
 const host=$('appGrid');host.textContent='';
 const apps=appState.apps.filter(a=>(a.name||'').toLowerCase().includes(term));
 $('appCount').textContent=apps.length+' APPLICATION'+(apps.length===1?'':'S');
 $('appEmpty').classList.toggle('hidden',apps.length>0);
 apps.forEach(a=>{
  const b=document.createElement('button');b.className='app-button';
  const box=document.createElement('span');box.className='app-icon-wrap';
  if(a.icon){const img=document.createElement('img');img.loading='lazy';img.src=a.icon;img.alt='';box.append(img);}
  else {box.textContent=(a.name||'?').charAt(0).toUpperCase();box.style.color='#f1b66a';}
  const label=document.createElement('span');label.className='app-name';label.textContent=a.name;
  b.append(box,label);b.onclick=()=>{if(window.MEK)MEK.launchApp(a.pkg);};host.append(b);
 });
}
function applyPrefs(){
 const wallpaper=storageGet(STORAGE.wallpaper,true),motion=storageGet(STORAGE.motion,false);
 document.body.classList.toggle('no-wallpaper',!wallpaper);
 document.body.classList.toggle('reduce-motion',motion);
 $('wallpaperToggle').checked=wallpaper;$('motionToggle').checked=motion;
}
function setGreeting(){
 const hour=new Date().getHours();
 $('mekGreeting').textContent=hour<6?'You are still awake? That makes two of us.':hour<12?'Morning! I have been keeping an eye on the workshop. Mostly.':hour<18?'Oh, hello! I was just making sure nothing exploded.':'There you are. I was absolutely not taking a nap.';
}
window.addEventListener('DOMContentLoaded',()=>{
 updateDate();updateBattery();renderTasks();applyPrefs();setGreeting();
 $('appSearch').addEventListener('input',renderApps);
 $('wallpaperToggle').addEventListener('change',event=>{storageSet(STORAGE.wallpaper,event.target.checked);applyPrefs();});
 $('motionToggle').addEventListener('change',event=>{storageSet(STORAGE.motion,event.target.checked);applyPrefs();});
 setInterval(()=>{updateDate();updateBattery();},30000);
});
window.navigate=navigate;window.goBackInLauncher=goBackInLauncher;window.refreshNative=refreshNative;window.addTask=addTask;
