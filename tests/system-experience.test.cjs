const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const asset=name=>fs.readFileSync(path.join(root,'app/src/main/assets',name),'utf8');
function prototype(options={}){
 const dom=new JSDOM(asset('index.html'),{url:'https://mek.test/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;
 const actions={system:[],opened:[],dismissed:[],brightness:[],torch:0,widgetLayers:0};
 w.Mek={scheduleWidgetSync(){actions.widgetLayers++},updateNativeWidgetLayer(enabled){actions.layerActive=enabled;},edit:false};
 w.MEK={
  battery:()=>JSON.stringify({percent:82,charging:false}),
  getNotifications:()=>JSON.stringify(options.notifications||[]),
  notificationAccessGranted:()=>!!options.permission,
  openNotificationAccess:()=>actions.system.push('notification-access'),
  openNotification:key=>actions.opened.push(key),
  dismissNotification:key=>actions.dismissed.push(key),
  openDefault:kind=>actions.system.push(kind),
  isTorchOn:()=>false,
  toggleTorch:()=>{actions.torch++;return options.torch||'on';},
  setAppBrightness:n=>actions.brightness.push(n)
 };
 w.eval(asset('mek-system-v7.js'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded',{bubbles:true}));
 return {w,dom,actions,root:w.document.getElementById('systemExperience')};
}
function tap(w,selector){
 const target=w.document.querySelector(selector);
 assert.ok(target,'Missing expected interactive control: '+selector);
 target.click();
}
test('v0.7.0 prototype is bundled and loaded after the regular launcher',()=>{
 const html=asset('index.html');
 assert.match(html,/id="systemExperience"/);
 assert.match(html,/mek-system-v7\.css/);
 assert.match(html,/mek-system-v7\.js/);
 assert.ok(html.indexOf('launcher-v5-gestures.js')<html.indexOf('mek-system-v7.js'));
 const gradle=fs.readFileSync(path.join(root,'app/build.gradle.kts'),'utf8');
 assert.match(gradle,/versionName = "0\.7\.0"/);
});
test('shade opens from Home and closing restores native Android widgets',()=>{
 const {w,actions,root}=prototype();
 assert.equal(root.getAttribute('aria-hidden'),'true');
 tap(w,'#systemExperienceLaunch');
 assert.equal(root.getAttribute('aria-hidden'),'false');
 assert.equal(w.MekSystem.view,'shade');
 assert.equal(actions.layerActive,false);
 tap(w,'[data-sys-home]');
 assert.equal(w.MekSystem.view,'closed');
 assert.ok(actions.widgetLayers>=1);
 domClose(w);
});
test('lock screen has visible prototype-only security disclosure and unlock path',()=>{
 const {w,root}=prototype();
 w.MekSystem.open('lock');
 assert.match(root.textContent,/SIMULATED LOCK SCREEN/);
 assert.match(root.textContent,/ANDROID.S SECURE LOCK SCREEN IS UNCHANGED/);
 tap(w,'[data-sys-unlock]');
 assert.equal(w.MekSystem.view,'closed');
 domClose(w);
});
test('Quick Settings use Android bridges and report unavailable torch correctly',()=>{
 const {w,actions,root}=prototype({torch:'unavailable'});
 w.MekSystem.open('shade');
 tap(w,'[data-sys-tile="wifi"]');
 assert.deepEqual(actions.system,['wifi']);
 tap(w,'[data-sys-tile="torch"]');
 assert.equal(actions.torch,1);
 assert.match(root.textContent,/FLASHLIGHT UNAVAILABLE/);
 domClose(w);
});
test('notification inbox requires explicit access before reading',()=>{
 const {w,actions,root}=prototype();
 w.MekSystem.open('notifications');
 assert.match(root.textContent,/NOTIFICATION ACCESS IS OFF/);
 tap(w,'[data-sys-tile="notification-access"]');
 assert.deepEqual(actions.system,['notification-access']);
 domClose(w);
});
test('notifications are escaped, can be opened and dismissed by key',()=>{
 const {w,root,actions}=prototype({permission:true,notifications:[{key:'key/42',app:'Messages',title:'Hi <script>unsafe</script>',text:'Meet soon'}]});
 w.MekSystem.open('notifications');
 assert.equal(root.querySelector('script'),null);
 assert.match(root.textContent,/Hi <script>unsafe/);
 tap(w,'[data-sys-open-notification]');
 assert.deepEqual(actions.opened,['key/42']);
 tap(w,'[data-sys-dismiss-notification]');
 assert.deepEqual(actions.dismissed,['key/42']);
 domClose(w);
});
test('Settings save appearance, navigation and privacy preferences',()=>{
 const {w,root}=prototype();
 w.MekSystem.open('settings');
 tap(w,'[data-sys-category="personalization"]');
 tap(w,'[data-sys-accent="moss"]');
 assert.equal(w.MekSystem.preferences.accent,'moss');
 assert.match(w.localStorage.getItem('mek_system_v7'),/"accent":"moss"/);
 w.MekSystem.open('settings');
 tap(w,'[data-sys-category="navigation"]');
 tap(w,'[data-sys-nav="buttons"]');
 assert.ok(root.querySelector('.sys-navigation:not(.gestures)'));
 domClose(w);
});
test('prototype brightness is app-window only and real Android settings remain accessible',()=>{
 const {w,actions}=prototype();
 w.MekSystem.open('settings');
 tap(w,'[data-sys-category="display"]');
 const range=w.document.querySelector('[data-sys-brightness]');
 range.value='42';range.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.equal(actions.brightness.at(-1),42);
 tap(w,'[data-sys-tile="display"]');
 assert.deepEqual(actions.system,['display']);
 domClose(w);
});
test('overlay gates native widgets even if normal Home re-sync fires',()=>{
 const js=asset('launcher-v5.js'),main=fs.readFileSync(path.join(root,'app/src/main/java/com/mekai/mobile/MainActivity.java'),'utf8');
 assert.match(js,/document\.body\.classList\.contains\('system-experience-open'\)/);
 assert.match(main,/@JavascriptInterface public void openNotificationAccess/);
 assert.match(main,/@JavascriptInterface public String getNotifications/);
 assert.match(main,/@JavascriptInterface public void setAppBrightness/);
 const manifest=fs.readFileSync(path.join(root,'app/src/main/AndroidManifest.xml'),'utf8');
 assert.match(manifest,/BIND_NOTIFICATION_LISTENER_SERVICE/);
 assert.match(manifest,/android:name="\.MekNotificationListener"/);
});
function domClose(w){w.close();}
