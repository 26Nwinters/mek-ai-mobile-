/* MEK-AI Mobile layout model. Pure functions also covered by Node tests. */
(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MekLayout = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';
  const allowed = new Set(['clock','weather','battery','mek','tasks','music','notes','shortcut','app']);
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
    {id:'default-apps',type:'shortcut',kind:'drawer',label:'All apps'},
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
    if (type==='shortcut') {
      if (!data || !shortcutKinds.has(data.kind)) throw new Error('Invalid shortcut');
      item.kind=data.kind;
      item.label=String(data.label||data.kind).slice(0,55);
    }
    return item;
  }
  function span(item, cols) {
    const count=columns(cols);
    if(item.type==='shortcut'||item.type==='app') return 1;
    if(['mek','tasks','music','notes'].includes(item.type)) return count;
    return Math.min(2,count);
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
  return {defaultLayout,widgetTypes,labels,columns,normalize,newTile,span,move,shift};
});
