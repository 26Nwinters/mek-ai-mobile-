const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const assets=path.resolve(__dirname,'../app/src/main/assets');
function read(name){return fs.readFileSync(path.join(assets,name),'utf8');}
async function createPhone(){
  const dom=new JSDOM(read('index.html'),{url:'https://mek.local/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;
  w.scrollTo=()=>{};
  w.setInterval=()=>0;
  w.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},beginPath(){},arc(){},fill(){}});
  const apps=Array.from({length:150},(_,i)=>({name:'Application '+String(i).padStart(3,'0'),pkg:'com.example.app'+i}));
  w.MEK={
    battery:()=>JSON.stringify({percent:72,charging:false}),
    isDefaultHome:()=>true,
    getAppIcon:()=>'',requestAppIcon:(pkg)=>w.setTimeout(()=>w.mekIconReady(pkg,''),0),
    openDefault:()=>{},
    requestApps:()=>w.setTimeout(()=>w.mekAppsReady(JSON.stringify(apps)),0),
    launchApp:()=>{},requestHomeRole:()=>{}
  };
  w.eval(read('layout-core.js'));
  w.eval(read('mobile.js'));
  await new Promise(resolve=>setImmediate(resolve));
  return dom;
}
function touch(w,target,type,x,y){
  const e=new w.Event(type,{bubbles:true,cancelable:true});
  const point={clientX:x,clientY:y};
  Object.defineProperty(e,'touches',{value:type==='touchstart'?[point]:[]});
  Object.defineProperty(e,'changedTouches',{value:[point]});
  target.dispatchEvent(e);
}
function swipe(w,element,x1,y1,x2,y2){
  touch(w,element,'touchstart',x1,y1);
  touch(w,element,'touchend',x2,y2);
}
test('no navigation bar or permanent Apps button; home has full six-row grid pages',async()=>{
  const dom=await createPhone(),w=dom.window,d=w.document;
  assert.equal(d.getElementById('bottomNav'),null);
  assert.equal(d.getElementById('appSwipeHandle'),null);
  assert.equal(d.querySelectorAll('.home-tile').length,9);
  assert.equal(d.querySelectorAll('.home-page').length,2);
  assert.equal(d.querySelectorAll('.home-page [data-type="shortcut"] .home-app-label').length,3);
  assert.equal(d.querySelectorAll('.home-tile[data-type="shortcut"] .home-app-label').length,3);
  assert.equal(d.getElementById('topBattery').textContent,'72%');
  assert.equal(d.querySelector('.home-page').style.getPropertyValue('--grid-rows'),'6');
  assert.equal(d.querySelectorAll('#pageRailDots button').length,5); // MEK, two home pages, controls, settings
  dom.window.close();
});
test('Samsung-style separate grids default to 4×6 home, 5×6 apps and 4×4 folder',async()=>{
  const dom=await createPhone(),w=dom.window,d=w.document;
  assert.equal(d.getElementById('homeGridSummary').textContent,'4×6 ↗');
  assert.equal(d.getElementById('appsGridSummary').textContent,'5×6 ↗');
  assert.equal(d.getElementById('foldersGridSummary').textContent,'4×4 ↗');
  w.openEditor('grid-home');assert.match(d.getElementById('editorHeading').textContent,/HOME SCREEN GRID/);
  w.setGridDimension('grid-home','rows',7);
  w.setGridDimension('grid-home','cols',5);
  assert.equal(d.getElementById('homeGridSummary').textContent,'5×7 ↗');
  assert.equal(d.querySelector('.home-page').style.getPropertyValue('--grid-cols'),'5');
  assert.equal(d.querySelector('.home-page').style.getPropertyValue('--grid-rows'),'7');
  w.setGridDimension('grid-apps','cols',4);
  w.setGridDimension('grid-apps','rows',5);
  w.setGridDimension('grid-folders','cols',3);
  w.setGridDimension('grid-folders','rows',5);
  assert.equal(d.getElementById('appsGridSummary').textContent,'4×5 ↗');
  assert.equal(d.getElementById('foldersGridSummary').textContent,'3×5 ↗');
  assert.equal(d.getElementById('homeGridSummary').textContent,'5×7 ↗');
  dom.window.close();
});
test('app drawer shows 5 columns × 6 rows and 150 apps on 5 swipeable pages',async()=>{
  const dom=await createPhone(),w=dom.window,d=w.document;
  w.openAppDrawer();
  await new Promise(resolve=>setTimeout(resolve,65));
  assert.equal(d.querySelectorAll('.app-page').length,5);
  assert.equal(d.querySelectorAll('#appPageDots button').length,5);
  assert.match(d.getElementById('appCount').textContent,/150 APPS/);
  assert.equal(d.querySelector('.app-page').style.getPropertyValue('--app-cols'),'5');
  assert.equal(d.querySelector('.app-page').style.getPropertyValue('--app-rows'),'6');
  assert.equal(d.querySelectorAll('.app-page[data-page-index="0"] .app-button').length,30);
  w.goToAppPage(4,true);
  assert.equal(d.querySelectorAll('.app-page[data-page-index="4"] .app-button').length,30);
  dom.window.close();
});
test('swipe up from central home opens apps, down closes, sideways changes home and MEK pages',async()=>{
  const dom=await createPhone(),w=dom.window,d=w.document;
  swipe(w,d.getElementById('view-home'),160,420,160,245);
  assert.equal(d.querySelector('.view.active').id,'view-drawer');
  await new Promise(resolve=>setTimeout(resolve,65));
  swipe(w,d.getElementById('view-drawer'),160,230,160,370);
  assert.equal(d.querySelector('.view.active').id,'view-home');
  swipe(w,d.getElementById('view-home'),180,280,320,285); // swipe right from home => MEK
  assert.equal(d.querySelector('.view.active').id,'view-mek');
  swipe(w,d.getElementById('view-mek'),320,250,110,255); // left => Home
  assert.equal(d.querySelector('.view.active').id,'view-home');
  swipe(w,d.getElementById('view-home'),320,275,110,275); // left => second Home
  assert.equal(d.querySelector('.view.active').id,'view-home');
  assert.equal(d.getElementById('pageRailLabel').textContent,'HOME 2');
  swipe(w,d.getElementById('view-home'),320,275,110,275); // left => Control
  assert.equal(d.querySelector('.view.active').id,'view-controls');
  swipe(w,d.getElementById('view-controls'),320,275,110,275); // left => Setup
  assert.equal(d.querySelector('.view.active').id,'view-settings');
  swipe(w,d.getElementById('view-settings'),110,275,320,275); // right => Control
  assert.equal(d.querySelector('.view.active').id,'view-controls');
  dom.window.close();
});
test('pin app from Apps chooser after longpress editing and keep it in home grid',async()=>{
  const dom=await createPhone(),w=dom.window,d=w.document;
  w.enterEditMode();
  assert.ok(d.querySelectorAll('.tile-drag-handle').length>=9);
  w.openEditor('apps');
  await new Promise(resolve=>setTimeout(resolve,80));
  assert.equal(d.querySelector('.view.active').id,'view-drawer');
  assert.equal(d.getElementById('appDrawerModeHint').classList.contains('hidden'),false);
  const btn=d.querySelector('#appPageTrack .app-button');
  assert.ok(btn,'app chooser has apps');
  btn.click();
  assert.equal(d.querySelector('.view.active').id,'view-home');
  const pinned=d.querySelector('.home-tile[data-type="app"]');
  assert.ok(pinned,'new app tile exists');
  assert.equal(pinned.querySelector('.home-app-label').textContent,'Application 000');
  assert.equal(d.querySelectorAll('.home-tile').length,10);
  assert.equal(d.querySelector('.edit-home')!==null,true);
  w.exitEditMode();
  dom.window.close();
});
test('create and edit folders, add real app, and display its folder page',async()=>{
  const dom=await createPhone(),w=dom.window,d=w.document;
  w.enterEditMode();
  w.createFolder();
  assert.equal(d.getElementById('folderOverlay').classList.contains('hidden'),false);
  assert.equal(d.querySelectorAll('.home-tile[data-type="folder"]').length,1);
  const name=d.getElementById('folderName');
  name.value='My Apps';
  name.dispatchEvent(new w.Event('change'));
  d.getElementById('folderAdd').click();
  assert.equal(d.querySelector('.view.active').id,'view-drawer');
  await new Promise(resolve=>setTimeout(resolve,80));
  assert.match(d.getElementById('appDrawerModeHint').textContent,/CHOOSE APP FOR FOLDER/);
  d.querySelector('#appPageTrack .app-button').click();
  assert.equal(d.querySelector('.view.active').id,'view-home');
  assert.equal(d.getElementById('folderOverlay').classList.contains('hidden'),false);
  assert.equal(d.querySelectorAll('.folder-page .app-button').length,1);
  assert.equal(d.getElementById('folderName').value,'My Apps');
  w.closeFolder();
  w.exitEditMode();
  const folderTile=d.querySelector('.home-tile[data-type="folder"]');
  assert.equal(folderTile.querySelector('.home-app-label').textContent,'My Apps');
  dom.window.close();
});
test('changing app grid paginates according to independently saved dimensions',async()=>{
  const dom=await createPhone(),w=dom.window,d=w.document;
  w.setGridDimension('grid-apps','cols',4);
  w.setGridDimension('grid-apps','rows',4);
  w.openAppDrawer();await new Promise(resolve=>setTimeout(resolve,80));
  assert.equal(d.querySelectorAll('.app-page').length,10);
  assert.equal(d.querySelectorAll('.app-page[data-page-index="0"] .app-button').length,16);
  assert.equal(d.querySelector('.app-page').style.getPropertyValue('--app-cols'),'4');
  assert.equal(d.querySelector('.app-page').style.getPropertyValue('--app-rows'),'4');
  dom.window.close();
});
test('clock, battery, workshop note copies and other views remain functional',async()=>{
  const dom=await createPhone(),w=dom.window,d=w.document;
  w.enterEditMode();
  for(const label of ['Battery monitor','Dot clock','Workshop note']){
    w.openEditor('widgets');
    const pick=Array.from(d.querySelectorAll('.widget-pick')).find(n=>n.textContent.includes(label));
    pick.click();
  }
  w.exitEditMode();
  assert.equal(d.querySelectorAll('.home-tile[data-type="battery"]').length,2);
  assert.deepEqual(Array.from(d.querySelectorAll('.home-tile[data-type="battery"] .widget-reading')).map(x=>x.textContent),['72%','72%']);
  assert.equal(d.querySelectorAll('.tile-dot-clock').length,2);
  w.navigate('mek');w.navigate('controls');w.navigate('settings');w.navigate('home');
  assert.equal(d.querySelector('.view.active').id,'view-home');
  dom.window.close();
});
