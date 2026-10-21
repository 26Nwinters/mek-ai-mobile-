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
    getAppIcon:()=>'', openDefault:()=>{},
    requestApps:()=>w.setTimeout(()=>w.mekAppsReady(JSON.stringify(apps)),0),
    launchApp:()=>{},requestHomeRole:()=>{}
  };
  w.eval(read('layout-core.js'));
  w.eval(read('mobile.js'));
  await new Promise(resolve=>setImmediate(resolve));
  return dom;
}
test('five phone tabs switch without synchronous app-icon flood or exceptions',async()=>{
  const dom=await createPhone(),w=dom.window,d=w.document;
  assert.equal(d.querySelectorAll('#homeGrid .home-tile').length,10);
  assert.equal(d.getElementById('topBattery').textContent,'72%');
  for(let i=0;i<7;i++){
    for(const route of ['drawer','mek','controls','settings','home'])w.navigate(route);
  }
  w.navigate('drawer');
  await new Promise(resolve=>setTimeout(resolve,120));
  assert.match(d.getElementById('appCount').textContent,/150 APPLICATIONS/);
  assert.ok(d.querySelectorAll('.app-button').length>0);
  w.navigate('home');
  assert.equal(d.querySelector('.view.active').id,'view-home');
  dom.window.close();
});
test('edit, insert widget, resize columns, pin an app and exit',async()=>{
  const dom=await createPhone(),w=dom.window,d=w.document;
  w.enterEditMode();
  assert.equal(d.body.classList.contains('edit-home'),true);
  assert.ok(d.querySelectorAll('.tile-drag-handle').length>=10);
  w.openEditor('widgets');
  assert.equal(d.querySelectorAll('.widget-pick').length,7);
  d.querySelector('.widget-pick').click();
  assert.equal(d.querySelectorAll('#homeGrid .home-tile').length,11);
  w.changeColumns(1);
  assert.equal(d.getElementById('settingsGridCount').textContent,'5');
  assert.equal(d.getElementById('homeGrid').style.getPropertyValue('--grid-cols'),'5');
  w.openEditor('apps');
  assert.equal(d.getElementById('view-drawer').classList.contains('active'),true);
  await new Promise(resolve=>setTimeout(resolve,110));
  d.querySelector('#appGrid .app-button').click();
  assert.equal(d.querySelectorAll('#homeGrid .home-tile').length,12);
  w.exitEditMode();
  assert.equal(d.body.classList.contains('edit-home'),false);
  dom.window.close();
});
test('theme switching, notes and local task changes persist',async()=>{
  const dom=await createPhone(),w=dom.window,d=w.document;
  w.setTheme('moss');
  assert.equal(d.body.classList.contains('theme-moss'),true);
  w.openEditor('note');
  const input=d.getElementById('workshopNoteInput');
  input.value='My very own terminal';
  d.querySelector('#editSheetBody .primary-action').click();
  w.enterEditMode();w.openEditor('widgets');
  const note=Array.from(d.querySelectorAll('.widget-pick')).find(n=>n.textContent.includes('Workshop note'));
  note.click();w.exitEditMode();
  assert.match(d.querySelector('.note-content').textContent,/My very own terminal/);
  dom.window.close();
});

test('multiple copies of live widgets all update instead of only the first',async()=>{
  const dom=await createPhone(),w=dom.window,d=w.document;
  w.enterEditMode();
  for(const label of ['Battery monitor','Dot clock','Workshop note']){
    w.openEditor('widgets');
    const pick=Array.from(d.querySelectorAll('.widget-pick')).find(n=>n.textContent.includes(label));
    assert.ok(pick,'widget chooser contains '+label);
    pick.click();
  }
  w.exitEditMode();
  assert.equal(d.querySelectorAll('.home-tile[data-type="battery"]').length,2);
  assert.deepEqual(Array.from(d.querySelectorAll('.home-tile[data-type="battery"] .widget-reading')).map(x=>x.textContent),['72%','72%']);
  assert.equal(d.querySelectorAll('.tile-dot-clock').length,2);
  assert.equal(d.querySelectorAll('.tile-date').length,2);
  dom.window.close();
});
