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
  // jsdom never performs CSS layout. Provide actual phone-sized geometry
  // ONLY for native widget cells so placement bridge tests can exercise the
  // SHOW/rect protocol instead of dropping every rect as zero width/height.
  const nativeRect=w.HTMLElement.prototype.getBoundingClientRect;
  w.HTMLElement.prototype.getBoundingClientRect=function(){
    if(this.classList?.contains('grid-cell')&&this.dataset.type==='android-widget'){
      const cols=Number(this.style.getPropertyValue('--w'))||1;
      const rows=Number(this.style.getPropertyValue('--h'))||1;
      const left=32,top=208,width=cols*78,height=rows*82;
      return {left,top,x:left,y:top,width,height,
        right:left+width,bottom:top+height,toJSON(){return this;}};
    }
    return nativeRect.call(this);
  };
  const calls={launch:[],system:[],widgets:[],widgetTransitions:[],widgetInventories:[],widgetLayers:[],widgetTimeline:[],exports:[],imports:0,pickWidget:0,info:[],iconBatches:[]};
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
    requestWidgetCatalog:()=>w.setTimeout(()=>w.mekNativeWidgetCatalog(JSON.stringify([{provider:'com.example.clock/.Widget',package:'com.example.clock',name:'Clock',minWidth:160,minHeight:90,minResizeWidth:100,minResizeHeight:80,maxResizeWidth:380,maxResizeHeight:400,resizeMode:3}])),0),
    requestWidgetPreview:provider=>w.setTimeout(()=>w.mekNativeWidgetPreview(provider,'data:image/webp;base64,AAAA'),0),
    selectWidgetProvider:provider=>{calls.selectedProvider=provider;},
    syncWidgetRects:data=>{
      const value=JSON.parse(data);
      calls.widgets.push(value);
      calls.widgetTimeline.push({kind:'layout',revision:value.revision,allow:value.allow,
        ids:(value.widgets||[]).map(w=>w.id)});
    },
    animateWidgetPageTransition:data=>{
      const value=JSON.parse(data);
      calls.widgetTransitions.push(value);
      calls.widgetTimeline.push({kind:'transition',revision:value.revision,
        allow:true,ids:value.widgets.map(w=>w.id)});
    },
    syncWidgetInventory:data=>calls.widgetInventories.push(JSON.parse(data)),
    setWidgetLayerActive:(allowed,revision)=>{
      calls.widgetLayers.push(allowed);
      calls.widgetTimeline.push({kind:'gate',revision,allow:allowed,ids:[]});
    }
  };
  for(const name of ['launcher-core.js','launcher-v5.js','launcher-v5-ui.js',
    'launcher-v5-sheets.js','launcher-v5-organizer.js','launcher-v6-widgets.js','launcher-v6-companion.js','launcher-v6-folders.js','launcher-v5-gestures.js'])w.eval(read(name));
  await new Promise(resolve=>setTimeout(resolve,45));
  if(!w.document.querySelector('.home-page'))w.Mek.install();
  return {dom,w,d:w.document,M:w.Mek,calls};
}
function touch(w,target,type,x,y){
  const e=new w.Event(type,{bubbles:true,cancelable:true});
  const point={clientX:x,clientY:y};
  Object.defineProperties(e,{
    touches:{value:type==='touchend'||type==='touchcancel'?[]:[point]},
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
    ['dock-phone','dock-messages','dock-browser','dock-camera',undefined]);
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
  assert.deepEqual(Array.from(folder.apps,a=>a.pkg),['com.example.app5','com.example.app6']);
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

test('complete native widget inventory tracks deletion, undo and reset across all pages',async()=>{
  const {dom,M,calls}=await phone();await settle();
  assert.deepEqual(Array.from(calls.widgetInventories.at(-1)),[]);
  M.nativeWidgetChosen(401,'Phone widget',170,90);
  await settle();
  assert.deepEqual(Array.from(calls.widgetInventories.at(-1)),[401]);
  const added=M.model.pages.flatMap(p=>p.items).find(i=>i.nativeId===401);
  assert.ok(added);
  const other=M.Core.addPage(M.model,M.model.current);
  M.mutate(model=>{model.current=other.id;});
  await settle();
  assert.deepEqual(Array.from(calls.widgetInventories.at(-1)),[401],
    'native widget on another Home page must not be deleted');
  M.mutate(model=>M.Core.removeItem(model,added.id));
  await settle();
  assert.deepEqual(Array.from(calls.widgetInventories.at(-1)),[],
    'removal sends an empty native-widget inventory');
  M.undo();
  await settle();
  assert.deepEqual(Array.from(calls.widgetInventories.at(-1)),[401],
    'undo within the native grace window preserves widget binding');
  dom.window.close();
});

test('reloading a layout synchronizes all persisted native widget bindings',async()=>{
  const Core=require('../app/src/main/assets/launcher-core.js');
  const seed=Core.defaultState();
  const other=Core.addPage(seed,seed.current);
  Core.addHome(seed,{id:'widget-457',type:'android-widget',
    nativeId:457,label:'Battery',w:2,h:1},other.id);
  const {dom,calls}=await phone(seed);await settle();
  assert.ok(calls.widgetInventories.some(ids=>ids.includes(457)),
    'restored pages must report their widget IDs to Android');
  dom.window.close();
});

test('Galaxy widget picker displays installed app providers, previews and invokes provider choice',async()=>{
 const {dom,M,d,calls}=await phone();
 M.openSheet('widgets');
 await new Promise(resolve=>setTimeout(resolve,180));
 assert.ok(d.querySelector('.native-widget-catalog'));
 assert.ok(d.querySelector('.provider-widget-item'));
 const button=d.querySelector('.provider-widget-item');
 assert.match(button.textContent,/Clock/);
 button.click();
 assert.equal(calls.selectedProvider,'com.example.clock/.Widget');
 assert.equal(M.sheet,null);
 dom.window.close();
});
test('native widget sizing respects provider resize flags and cell bounds',async()=>{
 const {dom,M}=await phone();
 M.nativeWidgetChosen(980,'Fixed Widget',150,120,
   JSON.stringify({provider:'com.demo/.Fixed',resizeMode:0,minWidth:150,minHeight:120,
     minResizeWidth:150,minResizeHeight:120,maxResizeWidth:150,maxResizeHeight:120}));
 const widget=M.model.pages.flatMap(p=>p.items).find(x=>x.nativeId===980);
 assert.ok(widget&&widget.limits);
 assert.equal(widget.limits.resizeH,false);
 assert.equal(widget.limits.resizeV,false);
 assert.equal(M.Core.resizeSmart(M.model,widget.id,widget.w+1,widget.h),false);
 dom.window.close();
});

test('widget stacks render as one grid tile, swipe between contents and retain dimensions',async()=>{
 const {dom,M,d}=await phone();
 const clock=M.model.pages[0].items.find(x=>x.kind==='clock');
 const originalCount=M.model.pages[0].items.length;
 const before={w:clock.w,h:clock.h};
 M.mutate(model=>M.Core.addToStack(model,clock.id,{type:'widget',kind:'battery',x:0,y:0,w:2,h:2}));
 const stack=M.Core.locate(M.model,clock.id).item;
 assert.equal(stack.type,'stack');assert.equal(stack.stack.length,2);
 assert.equal(stack.w,before.w);assert.equal(stack.h,before.h);
 assert.equal(M.model.pages[0].items.length,originalCount);
 assert.ok(d.querySelector('.widget-stack[data-stack="'+clock.id+'"]'));
 assert.equal(M.changeStack(clock.id,1),true);
 assert.equal(M.Core.locate(M.model,clock.id).item.active,1);
 assert.equal(d.querySelector('.widget-stack-current').classList.contains('widget-battery'),true);
 dom.window.close();
});

test('per-widget expression, tint and opacity changes persist without changing other widgets',async()=>{
 const {dom,M,d}=await phone();
 const robot=M.model.pages[0].items.find(x=>x.kind==='mek');
 M.openSheet('widget-config',{id:robot.id});
 const mood=Array.from(d.querySelectorAll('.option-button')).find(x=>x.textContent==='SLEEP');
 assert.ok(mood);mood.click();
 assert.equal(M.Core.locate(M.model,robot.id).item.config.mood,'sleep');
 const rendered=d.querySelector('.widget-robot');
 assert.equal(rendered.dataset.mood,'sleep');
 const cloned=M.Core.normalize(M.model);
 assert.equal(M.Core.locate(cloned,robot.id).item.config.mood,'sleep');
 dom.window.close();
});

test('stack management can remove one child and return to ordinary widget',async()=>{
 const {dom,M,d}=await phone();
 const robot=M.model.pages[0].items.find(x=>x.kind==='mek');
 M.mutate(model=>M.Core.addToStack(model,robot.id,{type:'widget',kind:'clock',x:0,y:0,w:2,h:2}));
 M.openSheet('stack-edit',{id:robot.id});
 assert.equal(d.querySelectorAll('.page-manager-item').length,2);
 M.mutate(model=>M.Core.removeStackChild(model,robot.id,1));
 assert.equal(M.Core.locate(M.model,robot.id).item.type,'widget');
 dom.window.close();
});

test('Home page virtualization retains 32 pages but renders only adjacent tiles',async()=>{
 const {dom,M,d}=await phone();
 M.mutate(model=>{
   for(let i=0;i<12;i++){
     const page=M.Core.addPage(model,model.pages[model.pages.length-1].id);
     M.Core.addHome(model,{id:'test-app-'+i,type:'app',pkg:'com.test.page'+i,label:'Page '+i},page.id);
   }
 });
 const pages=M.model.pages;
 assert.ok(pages.length>=13);
 assert.equal(d.querySelectorAll('.home-page').length,pages.length);
 assert.ok(d.querySelectorAll('.home-page .grid-cell').length<15,
   'far away Home pages must be virtualized');
 M.goPage(pages[8].id);
 assert.ok(d.querySelector('.home-page[data-page="'+pages[8].id+'"] .grid-cell'));
 assert.equal(d.querySelector('.home-page[data-page="'+pages[0].id+'"] .grid-cell'),null);
 dom.window.close();
});
test('folder apps can be reordered and moved to another folder without duplicates',async()=>{
 const {dom,M}=await phone();
 const f1=M.Core.cleanItem({type:'folder',id:'folder-first',name:'Work',apps:[
   {pkg:'com.example.app1',label:'App1'},{pkg:'com.example.app2',label:'App2'}]},1,1,true);
 const f2=M.Core.cleanItem({type:'folder',id:'folder-next',name:'Games',apps:[
   {pkg:'com.example.app3',label:'App3'}]},1,1,true);
 M.mutate(model=>{model.drawerFolders.push(f1,f2);});
 assert.equal(M.moveFolderApp(f1.id,'com.example.app2',f1.id,'com.example.app1'),true);
 assert.deepEqual(Array.from(M.findFolder(f1.id).apps,a=>a.pkg),['com.example.app2','com.example.app1']);
 assert.equal(M.moveFolderApp(f1.id,'com.example.app2',f2.id),true);
 assert.equal(M.findFolder(f1.id).apps.length,1);
 assert.deepEqual(Array.from(M.findFolder(f2.id).apps,a=>a.pkg),['com.example.app3','com.example.app2']);
 dom.window.close();
});
test('Home layout lock prevents edit mode while preserving Home and drawer navigation',async()=>{
 const {dom,M,d}=await phone();
 M.mutate(model=>{model.settings.layoutLocked=true;});
 M.enterEdit();
 assert.equal(M.edit,false);
 M.setView('drawer');assert.equal(M.view,'drawer');
 M.setView('home');assert.equal(M.view,'home');
 dom.window.close();
});

test('swiping a widget stack switches its active content without paging Home',async()=>{
 const {dom,M,w,d}=await phone();
 const clock=M.model.pages[0].items.find(x=>x.kind==='clock');
 M.mutate(model=>M.Core.addToStack(model,clock.id,{type:'widget',kind:'notes',x:0,y:0,w:2,h:2}));
 const page=M.model.current;
 const tile=d.querySelector('.grid-cell[data-uid="'+clock.id+'"]');
 assert.ok(tile);
 touch(w,tile,'touchstart',310,320);
 touch(w,tile,'touchend',90,321);
 assert.equal(M.model.current,page);
 assert.equal(M.Core.locate(M.model,clock.id).item.active,1);
 dom.window.close();
});
test('a failed multi-step mutation restores all previous Home state',async()=>{
 const {dom,M}=await phone();
 const previous=JSON.stringify(M.model);
 const ok=M.mutate(model=>{model.pages[0].items.length=0;throw Error('Injected layout failure')});
 assert.equal(ok,false);
 assert.equal(JSON.stringify(M.model),previous);
 dom.window.close();
});
test('wallpaper settings switch between original artwork and minimal terminal',async()=>{
 const {dom,M,d}=await phone();
 M.setView('settings');
 M.openSheet('appearance');
 const option=Array.from(d.querySelectorAll('.option-button')).find(x=>x.textContent.includes('SOLID TERMINAL'));
 assert.ok(option);
 option.click();
 assert.equal(M.model.wallpaperChoice,'solid');
 assert.equal(d.body.classList.contains('solid-wallpaper'),true);
 dom.window.close();
});
test('default Home across many pages does not render hidden widget tiles',async()=>{
 const {dom,M,d}=await phone();
 M.mutate(model=>{
   for(let i=0;i<20;i++){
     const p=M.Core.addPage(model,model.pages[model.pages.length-1].id);
     M.Core.addHome(model,{id:'large-'+i,type:'widget',kind:'clock',x:0,y:0,w:2,h:2},p.id);
   }
 });
 assert.equal(d.querySelectorAll('.home-page').length,M.model.pages.length);
 assert.ok(d.querySelectorAll('.clock-canvas').length<=3);
 M.goPage(M.model.pages[18].id);
 assert.ok(d.querySelectorAll('.clock-canvas').length<=3);
 dom.window.close();
});

test('native widgets disappear under folders, sheets, and Home edit, then resume after close',async()=>{
  const {dom,M,calls}=await phone();await settle();
  M.nativeWidgetChosen(701,'Test weather',150,110);
  M.exitEdit();await settle();
  assert.equal(calls.widgetLayers.at(-1),true);
  M.mutate(model=>M.Core.addHome(model,{type:'folder',id:'widget-overlay-folder',
    name:'Social',apps:[{pkg:'com.example.app5',label:'Application 005'}]}));
  M.openFolder('widget-overlay-folder');
  assert.equal(M.activeFolder,'widget-overlay-folder');
  assert.equal(calls.widgetLayers.at(-1),false,
    'opening an HTML folder must immediately suppress Android host widgets');
  M.closeFolder();
  assert.equal(calls.widgetLayers.at(-1),true,
    'closing the folder makes native widgets eligible to reappear');
  M.openSheet('widgets');
  assert.equal(calls.widgetLayers.at(-1),false,'widget gallery should hide native surfaces');
  M.closeSheet();
  assert.equal(calls.widgetLayers.at(-1),true);
  M.enterEdit();
  assert.equal(calls.widgetLayers.at(-1),false,'editing should hide native touch surfaces');
  M.exitEdit();
  assert.equal(calls.widgetLayers.at(-1),true);
  dom.window.close();
});

test('native widgets start without a forced card and offer all four frame styles',async()=>{
  const {dom,M,d}=await phone();
  M.nativeWidgetChosen(702,'Transparent Clock',140,110);
  const item=M.model.pages.flatMap(p=>p.items).find(x=>x.nativeId===702);
  assert.ok(item);
  assert.equal(item.frameStyle,'transparent');
  M.renderHome();
  assert.equal(d.querySelector('.grid-cell[data-uid="'+item.id+'"] .native-widget-placeholder').dataset.frame,'transparent');
  M.openSheet('widget-config',{id:item.id});
  const choices=Array.from(d.querySelectorAll('.option-button'));
  const outlined=choices.find(x=>x.textContent.includes('OUTLINE ONLY'));
  assert.ok(outlined,'native widgets should offer wrapper styling');
  outlined.click();
  const updated=M.Core.locate(M.model,item.id).item;
  assert.equal(updated.frameStyle,'outlined');
  assert.equal(M.Core.locate(M.Core.normalize(M.model),item.id).item.frameStyle,'outlined');
  dom.window.close();
});

test('built-in transparent surface mode persists and does not remove widget contents',async()=>{
  const {dom,M,d}=await phone();
  const robot=M.model.pages[0].items.find(x=>x.kind==='mek');
  M.openSheet('widget-config',{id:robot.id});
  const transparent=Array.from(d.querySelectorAll('.option-button'))
    .find(x=>x.textContent.includes('TRANSPARENT / NO BACKGROUND'));
  assert.ok(transparent);
  transparent.click();
  const item=M.Core.locate(M.model,robot.id).item;
  assert.equal(item.config.frameStyle,'transparent');
  const node=M.widgetDom(item);
  assert.equal(node.dataset.frame,'transparent');
  assert.ok(node.querySelector('img'),'character image stays visible after removing the panel');
  dom.window.close();
});

test('resize controls appear for native widgets and stacks, with separate width/height handles',async()=>{
  const {dom,M,d}=await phone();
  M.nativeWidgetChosen(703,'Test Clock',140,110);
  const native=M.model.pages.flatMap(p=>p.items).find(x=>x.nativeId===703);
  M.selectedWidget=native.id;M.renderHome();
  const tile=d.querySelector('.grid-cell[data-uid="'+native.id+'"]');
  assert.ok(tile.querySelector('.cell-resize'));
  assert.ok(tile.querySelector('.cell-resize-width'));
  assert.ok(tile.querySelector('.cell-resize-height'));
  assert.equal(tile.classList.contains('selected'),true);
  tile.querySelector('.cell-resize-width').click();
  assert.equal(M.sheet,'resize');
  assert.ok(d.querySelector('.stepper'),'separate width and height controls in resize sheet');
  M.closeSheet();
  dom.window.close();
});

test('widget size sheet offers 1-cell wide and tall dimensions without forced aspect ratio',async()=>{
  const {dom,M,d}=await phone();
  const clock=M.model.pages[0].items.find(x=>x.kind==='clock');
  M.openSheet('resize',{id:clock.id});
  const sizes=Array.from(d.querySelectorAll('.picker-grid button')).map(x=>x.textContent);
  assert.ok(sizes.some(x=>x.includes('1 × 3')));
  assert.ok(sizes.some(x=>x.includes('3 × 1')));
  assert.ok(sizes.some(x=>x.includes('4 × 4')));
  dom.window.close();
});

test('leaving edit mode delivers an atomic nonempty SHOW payload with a newer revision',async()=>{
  const {dom,M,calls}=await phone();await settle();
  M.nativeWidgetChosen(811,'Provider clock',165,120);
  M.exitEdit();
  await new Promise(resolve=>setTimeout(resolve,160));
  const layouts=calls.widgets.filter(x=>x.widgets.some(y=>y.id===811));
  assert.ok(layouts.length,'exitEdit must send a real widget rect, not an empty hide packet');
  assert.equal(layouts.at(-1).allow,true);
  assert.equal(layouts.at(-1).widgets[0].visible,true);
  assert.ok(layouts.at(-1).revision>0);
  assert.ok(calls.widgetTimeline.some(x=>x.kind==='gate'&&x.allow===false));
  const actions=calls.widgetTimeline.slice();
  assert.ok(actions.every(x=>Number.isInteger(x.revision)&&x.revision>0));
  for(let i=1;i<actions.length;i++){
    assert.ok(actions[i].revision>actions[i-1].revision,
      'widget gate and position updates must have globally increasing revisions');
  }
  let effective={revision:-1,allow:false,ids:[]};
  // Simulate Android's runOnUiThread calls being serviced out of order.
  for(const action of actions.slice().reverse()){
    if(action.revision>effective.revision)effective=action;
  }
  assert.equal(effective.kind,'layout');
  assert.equal(effective.allow,true);
  assert.ok(effective.ids.includes(811));
  dom.window.close();
});

test('folder transitions send atomically blocked layouts then restore widget views',async()=>{
  const {dom,M,calls}=await phone();await settle();
  M.nativeWidgetChosen(812,'Clock',160,110);
  M.exitEdit();await new Promise(resolve=>setTimeout(resolve,100));
  const folder=M.Core.addHome(M.model,{id:'layer-folder',type:'folder',
    name:'Apps',apps:[{pkg:'com.example.app5',label:'Application 005'}]});
  assert.ok(folder);
  M.renderHome();
  M.openFolder('layer-folder');
  await new Promise(resolve=>setTimeout(resolve,110));
  const blocked=calls.widgets.at(-1);
  assert.equal(blocked.allow,false);
  assert.equal(blocked.widgets.length,0);
  M.closeFolder();
  await new Promise(resolve=>setTimeout(resolve,100));
  const restored=calls.widgets.at(-1);
  assert.equal(restored.allow,true);
  assert.ok(restored.widgets.some(w=>w.id===812));
  assert.ok(restored.revision>blocked.revision);
  dom.window.close();
});

test('native host failures are visible and recover when the provider attaches',async()=>{
  const {dom,M,d,calls}=await phone();await settle();
  M.nativeWidgetChosen(813,'Third party weather',165,110);
  M.exitEdit();await settle();
  M.nativeWidgetHostStatus(813,'missing');
  let cell=d.querySelector('.grid-cell[data-type="android-widget"] .native-widget-placeholder');
  assert.ok(cell?.classList.contains('native-widget-error'));
  assert.equal(cell.dataset.hostStatus,'error');
  cell.click();
  await new Promise(resolve=>setTimeout(resolve,90));
  assert.ok(calls.widgets.some(packet=>packet.allow&&packet.widgets.some(w=>w.id===813)));
  M.nativeWidgetHostStatus(813,'attached');
  cell=d.querySelector('.grid-cell[data-type="android-widget"] .native-widget-placeholder');
  assert.equal(cell.dataset.hostStatus,'attached');
  assert.equal(cell.classList.contains('native-widget-error'),false);
  dom.window.close();
});

test('Android resume explicitly reapplies visible widget positions',async()=>{
  const {dom,M,calls}=await phone();await settle();
  M.nativeWidgetChosen(814,'Weather',150,110);
  M.exitEdit();await new Promise(resolve=>setTimeout(resolve,120));
  const first=calls.widgets.filter(x=>x.allow&&x.widgets.some(y=>y.id===814)).at(-1);
  assert.ok(first);
  M.refreshNative();
  await new Promise(resolve=>setTimeout(resolve,125));
  const next=calls.widgets.filter(x=>x.allow&&x.widgets.some(y=>y.id===814)).at(-1);
  assert.ok(next.revision>first.revision);
  dom.window.close();
});

test('v0.6.3 reuses unchanged Home, dock, folder and app library elements',async()=>{
  const {dom,M,d}=await phone();await settle();
  const originalHome=d.querySelector('.home-page');
  const originalHomeCell=d.querySelector('.home-page .grid-cell');
  const originalDock=d.querySelector('.dock-slot');
  M.renderHome();M.renderDock();
  assert.equal(d.querySelector('.home-page'),originalHome);
  assert.equal(d.querySelector('.home-page .grid-cell'),originalHomeCell);
  assert.equal(d.querySelector('.dock-slot'),originalDock);

  M.setView('drawer');await settle();
  const drawer=d.querySelector('.app-page');
  const drawerIcon=d.querySelector('.app-page-cell');
  M.setView('home');M.setView('drawer');
  assert.equal(d.querySelector('.app-page'),drawer);
  assert.equal(d.querySelector('.app-page-cell'),drawerIcon);
  M.drawerQuery='Application 00';M.renderDrawer();
  assert.notEqual(d.querySelector('.app-page'),drawer,
    'a changed search must invalidate the cached app archive');
  M.drawerQuery='';M.renderDrawer();
  M.setView('home');

  const folder=M.Core.addHome(M.model,{type:'folder',id:'perf-folder',
    name:'Archive',apps:[{pkg:'com.example.app2',label:'Application 002'}]});
  assert.ok(folder);
  M.renderHome();M.openFolder('perf-folder');
  const folderPage=d.querySelector('.folder-page');
  M.closeFolder();M.openFolder('perf-folder');
  assert.equal(d.querySelector('.folder-page'),folderPage,
    'reopening the same folder should reuse its icon DOM');
  M.mutate(model=>{M.findFolder('perf-folder').apps.push({
    pkg:'com.example.app3',label:'Application 003'});});
  assert.notEqual(d.querySelector('.folder-page'),folderPage,
    'a changed folder must rerender its contents');
  dom.window.close();
});

test('v0.6.3 animates adjacent native widget pages with ordered revisions',async()=>{
  const {dom,M,calls}=await phone();await settle();
  M.nativeWidgetChosen(971,'First provider',160,110);
  M.exitEdit();await settle();
  // Providers may not fit on the original first page. Use the actual page
  // selected by the launcher's free-space algorithm, not a fixed page index.
  const source=M.model.pages.find(p=>p.items.some(i=>i.nativeId===971));
  assert.ok(source);
  M.mutate(model=>{M.Core.addPage(model,source.id);});
  const sourceIndex=M.model.pages.findIndex(p=>p.id===source.id);
  const destination=M.model.pages[sourceIndex+1];
  const placed=M.mutate(model=>M.Core.addHome(model,{
    id:'second-native',type:'android-widget',nativeId:972,label:'Second provider',
    x:0,y:0,w:2,h:2,frameStyle:'transparent'
  },destination.id));
  assert.ok(placed);
  // Core.addHome switches current to the receiving page; reset to source.
  M.model.current=source.id;
  M.renderHome();
  M.goPage(destination.id);
  assert.equal(calls.widgetTransitions.length,1);
  const animation=calls.widgetTransitions[0];
  assert.equal(animation.durationMs,240);
  assert.ok(animation.dx<0);
  assert.deepEqual(new Set(animation.widgets.map(w=>w.id)),new Set([971,972]));
  assert.equal(animation.widgets.find(w=>w.id===971).incoming,false);
  assert.equal(animation.widgets.find(w=>w.id===972).incoming,true);
  await new Promise(resolve=>setTimeout(resolve,320));
  const committed=calls.widgets.filter(p=>p.allow&&p.widgets.some(w=>w.id===972)).at(-1);
  assert.ok(committed,'destination native widget must get a final atomic rect update');
  assert.ok(committed.revision>animation.revision);
  dom.window.close();
});

test('v0.6.3 preserves native widget overlays when a folder opens on a new page',async()=>{
  const {dom,M,calls}=await phone();await settle();
  M.nativeWidgetChosen(973,'Weather',160,110);
  M.exitEdit();await settle();
  M.mutate(model=>{M.Core.addPage(model,model.current);});
  M.goPage(M.model.pages[1].id);
  M.openSheet('widgets');
  assert.equal(calls.widgetLayers.at(-1),false,
    'a modal must immediately suppress native widgets even when page sync was scheduled');
  await new Promise(resolve=>setTimeout(resolve,340));
  assert.equal(calls.widgets.at(-1).allow,false,
    'queued transition sync must not reveal native views behind a modal');
  M.closeSheet();await settle();
  assert.equal(calls.widgets.at(-1).allow,true);
  dom.window.close();
});
