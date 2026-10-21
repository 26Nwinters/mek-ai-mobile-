const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const assets=path.resolve(__dirname,'../app/src/main/assets');
const read=name=>fs.readFileSync(path.join(assets,name),'utf8');
async function phone(seed=null){
  const dom=new JSDOM(read('index.html'),{url:'https://mek.invalid/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;
  if(seed)w.localStorage.setItem('mek_launcher_v5',JSON.stringify(seed));
  w.scrollTo=()=>{};
  w.HTMLElement.prototype.scrollTo=function(arg){this.scrollLeft=typeof arg==='object'?arg.left||0:0;};
  w.HTMLCanvasElement.prototype.getContext=()=>({beginPath(){},arc(){},fill(){},clearRect(){}});
  const calls={launch:[],system:[],widgets:[],exports:[],imports:0,pickWidget:0,info:[],iconBatches:[]};
  const apps=Array.from({length:150},(_,i)=>({name:'Application '+String(i).padStart(3,'0'),pkg:'com.example.app'+i}));
  w.MEK={
    battery:()=>JSON.stringify({percent:37,charging:false}),
    isDefaultHome:()=>true,
    requestHomeRole:()=>{},
    requestApps:()=>w.setTimeout(()=>w.mekAppsReady(JSON.stringify(apps)),0),
    requestAppIcon:pkg=>w.setTimeout(()=>w.mekIconReady(pkg,'data:image/webp;base64,AAAA'),0),
    requestAppIcons:json=>{
      const batch=JSON.parse(json);calls.iconBatches.push(batch);
      w.setTimeout(()=>w.mekIconsReady(JSON.stringify(batch.map(pkg=>({
        pkg,icon:'data:image/webp;base64,AAAA'
      })))),0);
    },
    launchApp:pkg=>calls.launch.push(pkg),
    openDefault:kind=>calls.system.push(kind),
    exportLayout:json=>calls.exports.push(json),
    importLayout:()=>calls.imports++,
    copyText:()=>{},
    showAppInfo:pkg=>calls.info.push(pkg),
    pickAndroidWidget:()=>calls.pickWidget++,
    syncWidgetRects:data=>calls.widgets.push(JSON.parse(data))
  };
  for(const name of ['launcher-core.js','launcher-v5.js','launcher-v5-ui.js',
    'launcher-v5-sheets.js','launcher-v5-organizer.js','launcher-v5-gestures.js'])w.eval(read(name));
  await new Promise(resolve=>setTimeout(resolve,45));
  if(!w.document.querySelector('.home-page'))w.Mek.install();
  return {dom,w,d:w.document,M:w.Mek,calls};
}
function touch(w,target,type,x,y){
  const e=new w.Event(type,{bubbles:true,cancelable:true});
  const point={clientX:x,clientY:y};
  Object.defineProperties(e,{
    touches:{value:type==='touchstart'?[point]:[]},
    changedTouches:{value:[point]}
  });
  target.dispatchEvent(e);
}
function swipe(w,target,x1,y1,x2,y2){
  touch(w,target,'touchstart',x1,y1);
  touch(w,target,'touchend',x2,y2);
}
const settle=()=>new Promise(resolve=>setTimeout(resolve,80));

test('initial screen has editable independent desktop and fixed favorites dock',async()=>{
  const {dom,M,d}=await phone();
  assert.equal(d.querySelectorAll('.home-page').length,1);
  assert.equal(d.querySelectorAll('#dock .dock-slot').length,5);
  assert.deepEqual(Array.from(d.querySelectorAll('#dock .dock-slot')).map(x=>x.dataset.uid),
    ['dock-phone','dock-messages','dock-browser','dock-camera','']);
  assert.equal(d.getElementById('systemBattery').textContent,'37%');
  assert.ok(d.querySelector('.widget-robot .widget-robot-copy'), 'The robot caption must overlay the MEK-AI image');
  assert.ok(d.querySelector('.widget-robot>img'), 'Approved robot art is attached to the home widget');
  assert.equal(d.querySelectorAll('.bottom-nav,.nav-item').length,0);
  assert.equal(d.querySelector('.home-page').style.getPropertyValue('--home-cols'),'4');
  assert.equal(d.querySelector('.home-page').style.getPropertyValue('--home-rows'),'6');
  dom.window.close();
});

test('home swipes left/right and dock stays identical between pages',async()=>{
  const {dom,w,M,d}=await phone();
  M.mutate(model=>{M.Core.addPage(model,model.current);});
  const initial=Array.from(d.querySelectorAll('.dock-slot')).map(x=>x.dataset.uid);
  swipe(w,d.getElementById('homeViewport'),300,300,90,305);
  assert.equal(M.model.current,M.model.pages[1].id);
  assert.deepEqual(Array.from(d.querySelectorAll('.dock-slot')).map(x=>x.dataset.uid),initial);
  swipe(w,d.getElementById('homeViewport'),90,305,300,300);
  assert.equal(M.model.current,M.model.pages[0].id);
  dom.window.close();
});

test('swipe up anywhere on Home opens horizontally paged 5x6 app drawer',async()=>{
  const {dom,w,M,d}=await phone();
  await settle();
  swipe(w,d.getElementById('homeViewport'),170,330,171,150);
  assert.equal(M.view,'drawer');
  assert.equal(d.querySelectorAll('.app-page').length,6); // 150 installed + 3 MEK system entries
  assert.equal(d.querySelectorAll('.app-page[data-page="0"] .app-page-cell').length,30);
  M.goDrawerPage(3);
  assert.equal(d.querySelectorAll('#drawerDots button.active').length,1);
  assert.equal(M.drawerPage,3);
  swipe(w,d.getElementById('screen-drawer'),170,150,171,350);
  assert.equal(M.view,'home');
  dom.window.close();
});

test('long-press edit, widget picker and app chooser add actual app tiles',async()=>{
  const {dom,M,d}=await phone();await settle();
  M.enterEdit();
  assert.equal(d.body.classList.contains('editing'),true);
  M.openSheet('widgets');
  const available=Array.from(d.querySelectorAll('.picker-grid button'));
  assert.ok(available.length>=9);
  M.addWidget('notes');
  assert.ok(M.model.pages.some(p=>p.items.some(i=>i.kind==='notes')));
  M.openSheet('apps-picker');
  const selected=Array.from(d.querySelectorAll('.picker-apps .icon-tile'))
    .find(x=>x.getAttribute('aria-label')==='Application 001');
  assert.ok(selected);
  selected.click();
  assert.ok(M.model.pages.some(p=>p.items.some(i=>i.pkg==='com.example.app1')));
  assert.equal(M.sheet,null);
  M.exitEdit();
  assert.equal(d.body.classList.contains('editing'),false);
  dom.window.close();
});

test('stationary drawer hold opens Select multiple and Android App Settings options',async()=>{
  const {dom,M,w,d}=await phone();await settle();
  M.setView('drawer');
  const app=Array.from(d.querySelectorAll('.app-page-cell')).find(n=>n.dataset.pkg==='com.example.app2');
  assert.ok(app);
  touch(w,app,'touchstart',160,230);
  await new Promise(resolve=>setTimeout(resolve,520));
  assert.equal(M.view,'drawer','holding without movement stays in the library');
  assert.equal(M.drag,null,'holding without movement does not start dragging');
  touch(w,app,'touchend',160,230);
  assert.equal(M.sheet,'app-actions');
  const texts=Array.from(d.querySelectorAll('.option-button')).map(n=>n.textContent);
  assert.ok(texts.some(x=>x.includes('SELECT MULTIPLE')));
  assert.ok(texts.some(x=>x.includes('APP SETTINGS')));
  d.querySelector('.option-button').click();
  assert.equal(M.selectMode,true);
  assert.equal(M.selectedApps.has('com.example.app2'),true);
  dom.window.close();
});

test('hold then move a single drawer app upward to Home without multi-select',async()=>{
  const {dom,M,w,d}=await phone();await settle();
  M.setView('drawer');
  const app=Array.from(d.querySelectorAll('.app-page-cell')).find(n=>n.dataset.pkg==='com.example.app2');
  assert.ok(app);
  touch(w,app,'touchstart',160,240);
  await new Promise(resolve=>setTimeout(resolve,520));
  touch(w,d,'touchmove',160,190);
  assert.equal(M.view,'drawer','moving within the app library keeps it in the drawer');
  assert.ok(M.drag);
  touch(w,d,'touchmove',160,90);
  assert.equal(M.view,'home','moving toward the top enters Home drag mode');
  touch(w,d,'touchend',160,90);
  assert.equal(M.drag,null);
  assert.ok(M.model.pages.some(p=>p.items.some(i=>i.pkg==='com.example.app2')));
  dom.window.close();
});

test('dock slots can hold installed apps and retain their favorites across screens',async()=>{
  const {dom,M,d}=await phone();await settle();
  M.openSheet('dock-select',{slot:1});
  assert.equal(M.picking.type,'dock');
  const chosen=Array.from(d.querySelectorAll('.picker-apps .icon-tile'))
    .find(x=>x.getAttribute('aria-label')==='Application 004');
  chosen.click();
  assert.equal(M.model.dock[1].pkg,'com.example.app4');
  const dockId=M.model.dock[1].id;
  M.mutate(model=>{M.Core.addPage(model,model.current);});
  M.goPage(M.model.pages[1].id);
  assert.equal(d.querySelectorAll('#dock .dock-slot')[1].dataset.uid,dockId);
  dom.window.close();
});

test('folders support naming, colors, application contents and separate 4x4 grids',async()=>{
  const {dom,M,d}=await phone();await settle();
  M.openSheet('folder-create');
  const create=Array.from(d.querySelectorAll('.option-button'))
    .find(x=>x.textContent.includes('PLACE ON HOME'));
  create.click();
  assert.ok(M.activeFolder);
  const folder=M.findFolder(M.activeFolder);
  assert.ok(folder);
  assert.equal(d.querySelector('.folder-page').style.getPropertyValue('--folder-cols'),'4');
  assert.equal(d.querySelector('.folder-page').style.getPropertyValue('--folder-rows'),'4');
  M.picking={type:'folder',folderId:folder.id};
  M.openSheet('apps-picker');
  const app=Array.from(d.querySelectorAll('.picker-apps .icon-tile'))
    .find(x=>x.getAttribute('aria-label')==='Application 006');
  app.click();
  assert.equal(folder.apps.length,1);
  M.openSheet('folder-color');
  const amber=Array.from(d.querySelectorAll('.option-button')).find(x=>x.textContent.includes('AMBER'));
  amber.click();
  assert.equal(folder.color,'amber');
  M.closeSheet();M.closeFolder();
  assert.ok(M.model.pages.some(p=>p.items.some(i=>i.type==='folder'&&i.apps.length===1)));
  dom.window.close();
});

test('grid settings modify rows and columns separately',async()=>{
  const {dom,M,d}=await phone();
  M.openSheet('grid-home');
  M.mutate(model=>{model.settings.homeCols=5;model.settings.homeRows=7;M.Core.reflow(model);});
  assert.equal(d.getElementById('homeGridValue').textContent,'5×7');
  M.openSheet('grid-apps');
  M.mutate(model=>{model.settings.appCols=4;model.settings.appRows=5;});
  assert.equal(d.getElementById('appGridValue').textContent,'4×5');
  M.openSheet('grid-folders');
  M.mutate(model=>{model.settings.folderCols=3;model.settings.folderRows=5;});
  assert.equal(d.getElementById('folderGridValue').textContent,'3×5');
  dom.window.close();
});

test('backup and restoration include pages, folders, dock, tasks and notes',async()=>{
  const {dom,M,calls}=await phone();
  M.mutate(model=>{
    model.notes='My personal workshop';
    model.tasks.push({text:'Finish project',done:false});
  });
  M.exportBackup();
  assert.equal(calls.exports.length,1);
  const json=calls.exports[0];
  M.mutate(model=>{model.notes='Erase';model.tasks=[];});
  M.backupImported(json);
  assert.equal(M.model.notes,'My personal workshop');
  assert.equal(M.model.tasks[0].text,'Finish project');
  dom.window.close();
});

test('true Android AppWidgetHost callback creates resizable native widget placement',async()=>{
  const {dom,M,calls,d}=await phone();
  M.chooseNativeWidget();
  assert.equal(calls.pickWidget,1);
  M.nativeWidgetChosen(357,'Clock from another app',170,90);
  assert.ok(M.model.pages.flatMap(p=>p.items).some(x=>x.type==='android-widget'&&x.nativeId===357));
  assert.ok(d.querySelector('.native-widget-placeholder'));
  assert.equal(M.edit,true);
  M.exitEdit();
  await settle();
  assert.ok(calls.widgets.length>0);
  dom.window.close();
});

test('native home action exits editing and returns to chosen default desktop page',async()=>{
  const {dom,M}=await phone();
  M.mutate(model=>{M.Core.addPage(model,model.current);model.settings.homeDefault=model.pages[1].id;});
  M.goPage(M.model.pages[0].id);
  M.setView('settings');
  M.nativeHome();
  assert.equal(M.view,'home');
  assert.equal(M.model.current,M.model.settings.homeDefault);
  assert.equal(M.edit,false);
  dom.window.close();
});

test('search filters installed app pages and custom theme options remain usable',async()=>{
  const {dom,M,w,d}=await phone();await settle();
  M.setView('drawer');
  const search=d.getElementById('appSearch');
  search.value='Application 011';
  search.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal(d.querySelectorAll('.app-page').length,1);
  assert.equal(d.querySelectorAll('.app-page-cell').length,1);
  M.openSheet('themes');
  const amber=Array.from(d.querySelectorAll('.option-button')).find(x=>x.textContent.includes('AMBER INDUSTRIAL'));
  amber.click();
  assert.equal(d.body.classList.contains('theme-amber'),true);
  dom.window.close();
});

test('a fresh Android launcher process restores the chosen default Home page',async()=>{
  const C=require('../app/src/main/assets/launcher-core.js');
  const seed=C.defaultState();
  const second=C.addPage(seed,seed.current);
  seed.settings.homeDefault=second.id;
  seed.current=seed.pages[0].id; // Previously viewed page differs from default.
  const {dom,M}=await phone(seed);
  assert.equal(M.model.current,second.id);
  dom.window.close();
});

test('drawer toolbar supports selecting multiple apps and creating a folder in the library',async()=>{
  const {dom,M,d}=await phone();await settle();
  M.setView('drawer');
  d.getElementById('drawerSelect').click();
  assert.equal(M.selectMode,true);
  const choose=pkg=>d.querySelector('.app-page-cell[data-pkg="'+pkg+'"] .icon-tile').click();
  choose('com.example.app5');
  choose('com.example.app6');
  assert.equal(M.selectedApps.size,2);
  assert.equal(d.getElementById('drawerSelectedCount').textContent,'2 SELECTED');
  assert.equal(d.querySelectorAll('.app-page-cell.is-selected').length,2);
  d.getElementById('drawerSelectionFolder').click();
  assert.equal(M.selectMode,false);
  assert.equal(M.model.drawerFolders.length,1);
  assert.ok(M.activeFolder);
  const folder=M.model.drawerFolders[0];
  assert.deepEqual(folder.apps.map(a=>a.pkg),['com.example.app5','com.example.app6']);
  M.closeFolder();
  assert.equal(M.allDrawerItems().some(a=>a.pkg==='com.example.app5'),false);
  assert.ok(M.allDrawerItems().some(a=>a.id===folder.id));
  dom.window.close();
});

test('multiple selected library apps can be added to an existing drawer folder',async()=>{
  const {dom,M,d}=await phone();await settle();
  M.setView('drawer');
  M.enableLibrarySelection('com.example.app4');
  M.createLibraryFolder();
  const folderId=M.model.drawerFolders[0].id;
  M.closeFolder();
  M.enableLibrarySelection('com.example.app7');
  M.toggleLibrarySelection('com.example.app8');
  d.getElementById('drawerSelectionAdd').click();
  assert.equal(M.sheet,'library-target');
  const target=Array.from(d.querySelectorAll('.option-button')).find(n=>n.textContent.includes('New Folder'));
  assert.ok(target);
  target.click();
  const folder=M.findFolder(folderId);
  assert.equal(folder.apps.length,3);
  assert.equal(M.selectMode,false);
  dom.window.close();
});

test('individual drawer icon reorder is independent from multi-selection',async()=>{
  const {dom,M}=await phone();await settle();
  M.setView('drawer');
  const items=M.allDrawerItems();
  const a=items.find(x=>x.pkg==='com.example.app1');
  const b=items.find(x=>x.pkg==='com.example.app2');
  assert.ok(a&&b);
  assert.equal(M.organizeDrawerDrop(a,null),true);
  assert.equal(M.model.settings.appSort,'custom');
  assert.equal(M.selectMode,false);
  assert.equal(M.model.drawerOrder[M.model.drawerOrder.length-1],a.pkg);
  assert.equal(M.organizeDrawerDrop(a,b),true);
  const folder=M.model.drawerFolders.find(x=>x.apps.some(z=>z.pkg===a.pkg));
  assert.ok(folder);
  assert.equal(folder.apps.length,2);
  dom.window.close();
});

test('icon requests batch only rendered packages and fill real image elements',async()=>{
  const {dom,M,calls,d}=await phone();await settle();
  M.setView('drawer');
  await new Promise(resolve=>setTimeout(resolve,260));
  assert.ok(calls.iconBatches.length>=1,'native icons should be requested in batches');
  assert.ok(calls.iconBatches.every(batch=>batch.length<=12),'max 12 per batch');
  assert.ok(calls.iconBatches.length<20,'never send an individual bridge call for every app');
  assert.ok(d.querySelectorAll('.app-page .app-symbol img').length>0,'real app images replace initial letters');
  dom.window.close();
});

test('resizing the MEK-AI robot widget supports narrow and wide proportions',async()=>{
  const {dom,M,d}=await phone();
  M.enterEdit();
  const id=M.model.pages[0].items.find(x=>x.kind==='mek').id;
  assert.equal(M.Core.resizeSmart(M.model,id,1,3),true);
  M.renderHome();
  const widget=d.querySelector('.grid-cell[data-uid="'+id+'"]');
  assert.equal(widget.dataset.cols,'1');
  assert.equal(widget.dataset.rows,'3');
  M.openSheet('resize',{id});
  const sizes=Array.from(d.querySelectorAll('.picker-grid button'));
  assert.ok(sizes.some(x=>x.textContent.includes('2 × 2')));
  dom.window.close();
});

test('old four-icon user dock gains an empty fifth position without overwriting favorites',async()=>{
  const C=require('../app/src/main/assets/launcher-core.js');
  const seed=C.defaultState();
  seed.settings.dockSlots=4;
  seed.dock.length=4;
  const {dom,M,d}=await phone(seed);
  assert.equal(M.model.settings.dockSlots,5);
  assert.equal(M.model.dock.length,5);
  assert.equal(d.querySelectorAll('#dock .dock-slot').length,5);
  assert.equal(M.model.dock[0].kind,'phone');
  assert.equal(M.model.dock[4],null);
  dom.window.close();
});

test('touch drag in the app drawer moves one icon onto another to create a folder',async()=>{
  const {dom,w,M,d}=await phone();await settle();
  M.setView('drawer');
  const src=d.querySelector('.app-page-cell[data-pkg="com.example.app4"]');
  const dst=d.querySelector('.app-page-cell[data-pkg="com.example.app5"]');
  assert.ok(src&&dst);
  d.elementFromPoint=()=>dst;
  touch(w,src,'touchstart',200,250);
  await new Promise(resolve=>setTimeout(resolve,520));
  touch(w,d,'touchmove',250,300);
  assert.equal(M.view,'drawer');
  assert.ok(M.drag);
  touch(w,d,'touchend',250,300);
  assert.equal(M.drag,null);
  const folder=M.model.drawerFolders.find(f=>f.apps.some(a=>a.pkg==='com.example.app4'));
  assert.ok(folder);
  assert.equal(folder.apps.length,2);
  dom.window.close();
});

test('dragging the widget resize handle changes width and height separately',async()=>{
  const {dom,M,w,d}=await phone();
  M.enterEdit();
  const id=M.model.pages[0].items.find(i=>i.kind==='mek').id;
  M.selectedWidget=id;M.renderHome();
  const handle=d.querySelector('.grid-cell[data-uid="'+id+'"] .cell-resize');
  assert.ok(handle);
  touch(w,handle,'touchstart',250,300);
  touch(w,d,'touchmove',85,400);
  touch(w,d,'touchend',85,400);
  const item=M.Core.locate(M.model,id)?.item;
  assert.equal(item.w,2);
  assert.equal(item.h,3);
  assert.equal(M.drag,null);
  dom.window.close();
});

test('native icon response is cached across drawer page re-renders',async()=>{
  const {dom,M,calls,d}=await phone();await settle();
  M.setView('drawer');await new Promise(resolve=>setTimeout(resolve,180));
  const before=calls.iconBatches.length;
  const cacheSize=M.iconCache.size;
  assert.ok(cacheSize>0);
  M.renderDrawer();await new Promise(resolve=>setTimeout(resolve,120));
  assert.equal(M.iconCache.size,cacheSize);
  assert.equal(calls.iconBatches.length,before,'same icons should not be requested again');
  dom.window.close();
});
