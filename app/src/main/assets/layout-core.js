/* MEK-AI Mobile layout model. Pure functions also covered by Node tests. */
(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MekLayout = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';
  const allowed = new Set(['clock','weather','battery','mek','tasks','music','notes','shortcut','app','folder']);
  const shortcutKinds = new Set(['phone','messages','camera','browser','music','settings','drawer']);
  const defaultLayout = [
    {id:'default-clock',type:'clock'},
    {id:'default-weather',type:'weather'},
    {id:'default-battery',type:'battery'},
    {id:'default-mek',type:'mek'},
    {id:'default-tasks',type:'tasks'},
    {id:'default-phone',type:'shortcut',kind:'phone',label:'Phone'},
    {id:'default-messages',type:'shortcut',kind:'messages',label:'Messages'},
    {id:'default-camera',type:'shortcut',kind:'camera',label:'Camera'},
    {id:'default-music',type:'music'}
  ];
  const widgetTypes = ['clock','weather','battery','mek','tasks','music','notes'];
  const labels = {
    clock:'Dot clock',weather:'Weather shortcut',battery:'Battery monitor',
    mek:'MEK-AI companion',tasks:'Tasks and reminders',music:'Music shortcut',notes:'Workshop note'
  };
  let serial = 0;
  function columns(value) {
    const num = Number(value);
    return Number.isFinite(num) ? Math.max(3, Math.min(6, Math.round(num))) : 4;
  }
  function validAppPackage(pkg) {
    return typeof pkg === 'string' && pkg.length <= 180 && /^[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+$/.test(pkg);
  }
  function rows(value) {
    const n=Number(value);
    return Number.isFinite(n) ? Math.max(4, Math.min(8, Math.round(n))) : 6;
  }
  function drawerColumns(value) {
    const n=Number(value);
    return Number.isFinite(n) ? Math.max(4,Math.min(6,Math.round(n))) : 5;
  }
  function folderColumns(value) {
    const n=Number(value);
    return Number.isFinite(n) ? Math.max(3,Math.min(6,Math.round(n))) : 4;
  }
  function folderRows(value) {
    const n=Number(value);
    return Number.isFinite(n) ? Math.max(3,Math.min(6,Math.round(n))) : 4;
  }
  function cleanApps(apps) {
    if(!Array.isArray(apps))return [];
    const seen=new Set();
    return apps.slice(0,72).filter(a=>{
      if(!a || !validAppPackage(a.pkg) || seen.has(a.pkg))return false;
      seen.add(a.pkg);return true;
    }).map(a=>({pkg:a.pkg,label:String(a.label||'App').slice(0,55)}));
  }
  function normalize(input) {
    if (!Array.isArray(input)) return defaultLayout.map(x=>({...x}));
    const out = [], used = new Set();
    for (const candidate of input.slice(0,40)) {
      if (!candidate || typeof candidate !== 'object' || !allowed.has(candidate.type)) continue;
      if (typeof candidate.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(candidate.id) || used.has(candidate.id)) continue;
      if (candidate.type === 'app' && !validAppPackage(candidate.pkg)) continue;
      if (candidate.type === 'shortcut' && !shortcutKinds.has(candidate.kind)) continue;
      const item = {id:candidate.id,type:candidate.type};
      if (item.type === 'app') { item.pkg=candidate.pkg; item.label=String(candidate.label||'App').slice(0,55); }
      if (item.type === 'shortcut') { item.kind=candidate.kind; item.label=String(candidate.label||candidate.kind).slice(0,55); }
      if (item.type === 'folder') {
        item.name=String(candidate.name||'Folder').slice(0,35);
        item.apps=cleanApps(candidate.apps);
      }
      used.add(item.id);
      out.push(item);
    }
    return out;
  }
  function newTile(type, data) {
    if (!allowed.has(type)) throw new Error('Unknown tile type');
    const item = {id:'tile-'+Date.now().toString(36)+'-'+(++serial),type};
    if (type==='app') {
      if (!data || !validAppPackage(data.pkg)) throw new Error('Invalid application package');
      item.pkg=data.pkg;
      item.label=String(data.label||'App').slice(0,55);
    }
    if (type==='folder') {
      item.name=String(data&&data.name||'New Folder').slice(0,35);
      item.apps=cleanApps(data&&data.apps);
    }
    if (type==='shortcut') {
      if (!data || !shortcutKinds.has(data.kind)) throw new Error('Invalid shortcut');
      item.kind=data.kind;
      item.label=String(data.label||data.kind).slice(0,55);
    }
    return item;
  }
  function span(item, cols) {
    const count=columns(cols);
    if(item.type==='shortcut'||item.type==='app'||item.type==='folder') return 1;
    if(['mek','tasks','music','notes'].includes(item.type)) return count;
    return Math.min(2,count);
  }
  /* Fit widgets into a physical rows x columns desktop grid without
     overlapping cells. Existing tile order is preserved; extra pages
     are generated only as needed. */
  function dimensions(item, colCount) {
    const cols=columns(colCount);
    if(['app','shortcut','folder'].includes(item.type))return {w:1,h:1};
    if(item.type==='clock')return {w:Math.min(2,cols),h:2};
    if(item.type==='battery'||item.type==='weather')return {w:Math.min(2,cols),h:1};
    if(item.type==='music')return {w:cols,h:1};
    return {w:cols,h:2};
  }
  function pack(layout,colCount,rowCount){
    const cols=columns(colCount), height=rows(rowCount);
    const tiles=normalize(layout);
    const pages=[];
    function newPage(){
      const grid=Array(cols*height).fill(false);
      const placements=[];
      const page={grid,placements};
      pages.push(page);
      return page;
    }
    let page=newPage();
    for(const item of tiles){
      const {w,h}=dimensions(item,cols);
      function tryPlace(target){
        for(let row=0;row<=height-h;row++){
          for(let col=0;col<=cols-w;col++){
            let available=true;
            for(let dy=0;dy<h&&available;dy++)
              for(let dx=0;dx<w;dx++)
                if(target.grid[(row+dy)*cols+col+dx]){available=false;break;}
            if(!available)continue;
            for(let dy=0;dy<h;dy++)
              for(let dx=0;dx<w;dx++)target.grid[(row+dy)*cols+col+dx]=true;
            target.placements.push({tile:item,col,row,w,h});
            return true;
          }
        }
        return false;
      }
      if(!tryPlace(page)){
        page=newPage();
        tryPlace(page);
      }
    }
    return pages.map(p=>p.placements);
  }
  function move(layout, sourceId, targetId) {
    const list = normalize(layout);
    const from = list.findIndex(x=>x.id===sourceId), to = list.findIndex(x=>x.id===targetId);
    if(from<0||to<0||from===to) return list;
    const [item]=list.splice(from,1);
    list.splice(to,0,item);
    return list;
  }
  function shift(layout,id,direction) {
    const list=normalize(layout);
    const from=list.findIndex(x=>x.id===id),to=from+direction;
    if(from<0||to<0||to>=list.length)return list;
    return move(list,id,list[to].id);
  }
  return {defaultLayout,widgetTypes,labels,columns,rows,drawerColumns,folderColumns,folderRows,normalize,newTile,span,dimensions,pack,move,shift,cleanApps};
});
