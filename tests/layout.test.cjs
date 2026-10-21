const test=require('node:test');
const assert=require('node:assert/strict');
const L=require('../app/src/main/assets/layout-core.js');

test('grid columns stay within phone-safe range',()=>{
  assert.equal(L.columns(0),3);
  assert.equal(L.columns(9),6);
  assert.equal(L.columns('5'),5);
  assert.equal(L.columns('invalid'),4);
});
test('default desktop has widgets and live shortcuts',()=>{
  const items=L.normalize(null);
  assert.ok(items.length>=9);
  assert.ok(items.some(t=>t.type==='mek'));
  assert.ok(!items.some(t=>t.type==='shortcut'&&t.kind==='drawer'));
});
test('reordering preserves data but changes position',()=>{
  const items=L.normalize(null), moved=L.move(items,items[0].id,items[3].id);
  assert.equal(moved[3].id,items[0].id);
  assert.equal(moved.length,items.length);
  assert.equal(items[0].type,'clock');
});
test('layout spans scale to grid width',()=>{
  assert.equal(L.span({type:'app'},6),1);
  assert.equal(L.span({type:'clock'},3),2);
  assert.equal(L.span({type:'mek'},6),6);
});
test('invalid layout entries never become HTML injections or arbitrary packages',()=>{
  const items=L.normalize([{id:'<script>',type:'notes'},{id:'okay',type:'app',pkg:'bad package'},{id:'fine',type:'app',pkg:'com.example.good',label:'test'}]);
  assert.equal(items.length,1);
  assert.equal(items[0].pkg,'com.example.good');
  assert.throws(()=>L.newTile('app',{pkg:'http://bad.example',label:'Bad'}));
});
test('newly added widgets and apps are valid',()=>{
  const widget=L.newTile('battery');
  const app=L.newTile('app',{pkg:'com.example.test',label:'Test'});
  assert.equal(L.normalize([widget,app]).length,2);
  assert.equal(app.label,'Test');
});

test('physical 4x6 home grid packs tiles onto multiple nonoverlapping pages',()=>{
  const cols=4,rows=6,pages=L.pack(L.defaultLayout,cols,rows);
  assert.ok(pages.length>=2);
  const items=pages.flat();
  assert.equal(items.length,L.defaultLayout.length);
  pages.forEach(page=>{
    const occupied=new Set();
    page.forEach(({col,row,w,h})=>{
      assert.ok(col+w<=cols);
      assert.ok(row+h<=rows);
      for(let y=row;y<row+h;y++)for(let x=col;x<col+w;x++){
        const key=y*cols+x;
        assert.ok(!occupied.has(key),'no home tiles overlap');
        occupied.add(key);
      }
    });
  });
});
test('folders validate app packages and preserve their contents after saving layout',()=>{
  const folder=L.newTile('folder',{name:'Design',apps:[
    {pkg:'com.example.blender',label:'Blender'},
    {pkg:'com.example.blender',label:'Duplicate'},
    {pkg:'broken package',label:'Invalid'},
    {pkg:'com.example.unreal',label:'Unreal'}
  ]});
  const normalized=L.normalize([folder]);
  assert.equal(normalized[0].name,'Design');
  assert.equal(normalized[0].apps.length,2);
  assert.deepEqual(normalized[0].apps.map(a=>a.label),['Blender','Unreal']);
  assert.equal(L.dimensions(folder,4).w,1);
  assert.equal(L.dimensions(folder,4).h,1);
});
test('Samsung-style independent row and column clamps',()=>{
  assert.equal(L.rows(6),6);
  assert.equal(L.drawerColumns(5),5);
  assert.equal(L.folderColumns(4),4);
  assert.equal(L.folderRows(4),4);
  assert.equal(L.rows(99),8);
});
