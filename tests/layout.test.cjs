const test=require('node:test');
const assert=require('node:assert/strict');
const Core=require('../app/src/main/assets/launcher-core.js');

test('defaults represent familiar Samsung grids and a five-slot persistent dock',()=>{
  const state=Core.defaultState();
  assert.equal(state.settings.homeCols,4);
  assert.equal(state.settings.homeRows,6);
  assert.equal(state.settings.appCols,5);
  assert.equal(state.settings.appRows,6);
  assert.equal(state.settings.folderCols,4);
  assert.equal(state.settings.folderRows,4);
  assert.equal(state.dock.length,5);
  assert.deepEqual(state.dock.map(x=>x&&x.kind),['phone','messages','browser','camera',null]);
  assert.equal(state.pages.length,1);
});

test('rejects malformed app package and duplicate folder members',()=>{
  assert.equal(Core.packageOk('com.example.app'),true);
  assert.equal(Core.packageOk('http://bad'),false);
  assert.equal(Core.cleanItem({type:'app',pkg:'<script>'}),null);
  const folder=Core.cleanItem({id:'folder-x',type:'folder',name:'Design',
    apps:[{pkg:'com.example.ps',label:'PS'}, {pkg:'com.example.ps',label:'Duplicate'},
    {pkg:'broken',label:'Invalid'},{pkg:'com.example.ai',label:'Illustrator'}]},4,6);
  assert.equal(folder.apps.length,2);
  assert.deepEqual(folder.apps.map(x=>x.label),['PS','Illustrator']);
});

test('free-cell scan never overlaps and creates a new page when grid is full',()=>{
  const state=Core.normalize(Core.defaultState());
  for(let i=0;i<35;i++)Core.addHome(state,
    {id:'app-'+i,type:'app',pkg:'com.demo.app'+i,label:'App '+i},state.current);
  assert.ok(state.pages.length>=2);
  for(const page of state.pages){
    for(const item of page.items){
      assert.ok(Core.inside(item,state.settings.homeCols,state.settings.homeRows));
      assert.equal(page.items.filter(other=>other.id!==item.id&&Core.overlap(item,other)).length,0);
    }
  }
});

test('moving app onto app creates folder with two applications',()=>{
  const state=Core.defaultState();
  const a=Core.addHome(state,{id:'app-a',type:'app',pkg:'com.demo.alpha',label:'Alpha'});
  const b=Core.addHome(state,{id:'app-b',type:'app',pkg:'com.demo.beta',label:'Beta'});
  assert.ok(a&&b);
  assert.equal(Core.moveToHome(state,a.id,state.current,b.x,b.y),true);
  const folder=state.pages[0].items.find(item=>item.type==='folder');
  assert.ok(folder);
  assert.deepEqual(folder.apps.map(x=>x.pkg),['com.demo.beta','com.demo.alpha']);
  assert.equal(state.pages[0].items.some(x=>x.id===a.id),false);
  assert.equal(state.pages[0].items.some(x=>x.id===b.id),false);
});

test('move icons into the dock without losing the displaced favorite',()=>{
  const state=Core.defaultState();
  const app=Core.addHome(state,{id:'app-a',type:'app',pkg:'com.demo.alpha',label:'Alpha'});
  assert.equal(Core.moveToDock(state,app.id,0),true);
  assert.equal(state.dock[0].pkg,'com.demo.alpha');
  assert.equal(state.pages.some(p=>p.items.some(x=>x.type==='system'&&x.kind==='phone')),true);
});

test('widget resize requires free cells and supports real Android widget IDs',()=>{
  const state=Core.defaultState();
  const battery=state.pages[0].items.find(x=>x.kind==='battery');
  assert.equal(Core.resize(state,battery.id,2,4),false); // Conflicts with tasks below.
  const android=Core.addHome(state,{id:'android-01',type:'android-widget',nativeId:302,
    label:'Third-party Clock',w:2,h:2});
  assert.ok(android);
  const restored=Core.normalize(state);
  assert.equal(restored.pages.flatMap(p=>p.items).some(x=>x.type==='android-widget'&&x.nativeId===302),true);
});

test('separate grid changes preserve every item during reflow',()=>{
  const state=Core.defaultState();
  for(let i=0;i<11;i++)Core.addHome(state,
    {id:'app-'+i,type:'app',pkg:'com.example.id'+i,label:'App '+i});
  const before=state.pages.flatMap(p=>p.items).map(x=>x.id).sort();
  state.settings.homeCols=3;state.settings.homeRows=4;
  Core.reflow(state);
  const after=state.pages.flatMap(p=>p.items).map(x=>x.id).sort();
  assert.deepEqual(after,before);
  for(const p of state.pages)for(const item of p.items)assert.ok(Core.inside(item,3,4));
});

test('home pages support reordering, chosen default and safe deletion',()=>{
  const state=Core.defaultState();
  const second=Core.addPage(state,state.current);
  const third=Core.addPage(state,second.id);
  assert.equal(state.pages.length,3);
  assert.equal(Core.reorderPage(state,third.id,-1),true);
  state.settings.homeDefault=second.id;
  assert.equal(Core.deletePage(state,second.id),true);
  assert.notEqual(state.settings.homeDefault,second.id);
  assert.equal(state.pages.length,2);
  assert.equal(Core.deletePage(state,state.pages[1].id),true);
  assert.equal(Core.deletePage(state,state.pages[0].id),false);
});

test('migration retains legacy tasks, notes and installed application shortcuts',()=>{
  const old={
    mek_mobile_grid_v2:[{id:'one',type:'app',pkg:'com.example.clock',label:'Clock'},
      {id:'default-apps',type:'shortcut',kind:'drawer',label:'All Apps'}],
    mek_mobile_tasks_v1:[{text:'Buy bread',done:false}],
    mek_mobile_note_v2:'Remember my workshop',
    mek_mobile_theme_v2:'moss'
  };
  const legacy=Core.migrateLegacy(key=>old[key]===undefined?null:JSON.stringify(old[key]));
  assert.equal(legacy.settings.theme,'moss');
  assert.equal(legacy.notes,'Remember my workshop');
  assert.equal(legacy.tasks.length,1);
  assert.ok(legacy.pages[0].items.some(x=>x.pkg==='com.example.clock'));
  assert.ok(!legacy.pages[0].items.some(x=>x.kind==='drawer'));
});

test('state normalization preserves and clamps home, app, folder and dock preferences',()=>{
  const model=Core.defaultState();
  Object.assign(model.settings,{homeCols:8,homeRows:3,appCols:2,appRows:12,
    folderCols:9,folderRows:0,dockSlots:9,swipeUp:false});
  const s=Core.normalize(model).settings;
  assert.equal(s.homeCols,6);
  assert.equal(s.homeRows,4);
  assert.equal(s.appCols,4);
  assert.equal(s.appRows,8);
  assert.equal(s.folderCols,6);
  assert.equal(s.folderRows,3);
  assert.equal(s.dockSlots,5);
  assert.equal(s.swipeUp,false);
});

test('five favorites survive serialization and old four-favorite layouts expand safely',()=>{
  const v5=Core.defaultState();
  v5.settings.dockSlots=4;
  v5.dock.length=4;
  const old=Core.normalize(v5);
  assert.equal(old.dock.length,4);
  old.settings.dockSlots=5;old.dock.push(null);
  const migrated=Core.normalize(old);
  assert.equal(migrated.dock.length,5);
  assert.deepEqual(migrated.dock.slice(0,4).map(x=>x.kind),['phone','messages','browser','camera']);
  assert.equal(migrated.dock[4],null);
});

test('smart widget scaling moves neighboring tiles rather than rejecting all expansion',()=>{
  const state=Core.defaultState();
  const before=state.pages.flatMap(page=>page.items).map(item=>item.id).sort();
  const widget=state.pages[0].items.find(item=>item.kind==='battery');
  assert.ok(widget);
  const done=Core.resizeSmart(state,widget.id,4,3);
  assert.equal(done,true);
  const after=state.pages.flatMap(page=>page.items).map(item=>item.id).sort();
  assert.deepEqual(after,before,'resizing preserves every existing tile');
  const resized=Core.locate(state,widget.id).item;
  assert.equal(resized.w,4);
  assert.equal(resized.h,3);
  for(const page of state.pages){
    for(const item of page.items){
      assert.ok(Core.inside(item,state.settings.homeCols,state.settings.homeRows));
      assert.equal(page.items.filter(other=>other.id!==item.id&&Core.overlap(item,other)).length,0);
    }
  }
});

test('smart widget dimensions independently support narrow and tall proportions',()=>{
  const state=Core.defaultState();
  const widget=state.pages[0].items.find(item=>item.kind==='clock');
  assert.equal(Core.resizeSmart(state,widget.id,1,4),true);
  let item=Core.locate(state,widget.id).item;
  assert.equal(item.w,1);assert.equal(item.h,4);
  assert.equal(Core.resizeSmart(state,widget.id,4,1),true);
  item=Core.locate(state,widget.id).item;
  assert.equal(item.w,4);assert.equal(item.h,1);
});

test('Home lock and archive scroll preferences survive persistence and migration',()=>{
 const m=Core.defaultState();
 m.settings.layoutLocked=true;m.settings.appLayout='vertical';
 const restored=Core.normalize(JSON.parse(JSON.stringify(m)));
 assert.equal(restored.settings.layoutLocked,true);
 assert.equal(restored.settings.appLayout,'vertical');
 restored.settings.appLayout='unrecognized';
 assert.equal(Core.normalize(restored).settings.appLayout,'horizontal');
});
test('widget stack supports multiple built-ins and restores single widget after removal',()=>{
 const model=Core.defaultState(),src=model.pages[0].items.find(x=>x.kind==='clock');
 assert.equal(Core.addToStack(model,src.id,{type:'widget',kind:'battery',x:0,y:0,w:2,h:2}),true);
 const stack=Core.locate(model,src.id).item;
 assert.equal(stack.type,'stack');assert.equal(stack.stack.length,2);
 assert.equal(Core.normalize(model).pages[0].items.find(x=>x.id===src.id).type,'stack');
 assert.equal(Core.removeStackChild(model,src.id,1),true);
 assert.equal(Core.locate(model,src.id).item.type,'widget');
 assert.equal(Core.locate(model,src.id).item.kind,'clock');
});
test('atomic drag rolls back entire Home layout on placement failure',()=>{
 const m=Core.defaultState();const before=JSON.stringify(m);
 assert.equal(Core.moveAtomic(m,'nonexistent','home-1',2,3),false);
 assert.equal(JSON.stringify(m),before);
});
