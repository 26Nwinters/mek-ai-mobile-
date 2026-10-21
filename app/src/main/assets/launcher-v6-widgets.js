/* MEK-AI v0.6: Galaxy-like widget catalog and provider-aware dimensions. */
(function(){
'use strict';
const M=window.Mek,C=M.Core,$=M.$;
M.widgetCatalog=[];
M.widgetCatalogLoaded=false;
M.widgetPreviewCache=new Map();
M.widgetCatalogQuery='';
M.widgetPreviewRequested=new Set();
M.readWidgetCatalog=function(){
  if(this.widgetCatalogLoaded)return;
  const bridge=this.native();
  if(bridge?.requestWidgetCatalog){
    try{bridge.requestWidgetCatalog();}
    catch(e){this.toast('ANDROID WIDGET CATALOG UNAVAILABLE');}
  }else{this.widgetCatalogLoaded=true;this.widgetCatalog=[];}
};
M.widgetCatalogReady=function(payload){
  try{
    const entries=typeof payload==='string'?JSON.parse(payload):payload;
    if(!Array.isArray(entries))return;
    this.widgetCatalog=entries.filter(w=>w&&typeof w.provider==='string'&&
      w.provider.length<240&&typeof w.name==='string'&&w.package);
    this.widgetCatalogLoaded=true;
    if(this.sheet==='widgets')this.renderSheet();
  }catch(e){this.toast('INVALID ANDROID WIDGET CATALOG');}
};
M.widgetPreviewReady=function(provider,uri){
  if(typeof provider!=='string'||provider.length>240)return;
  this.widgetPreviewCache.set(provider,typeof uri==='string'?uri:'');
  if(this.sheet!=='widgets')return;
  const node=Array.from(document.querySelectorAll('.native-widget-preview')).find(x=>x.dataset.provider===provider);
  if(!node)return;
  if(typeof uri==='string'&&uri.startsWith('data:image/')){
    const img=document.createElement('img');img.src=uri;img.alt='Widget preview';
    node.replaceChildren(img);
  }
};
M.selectNativeProvider=function(provider){
  if(!this.widgetCatalog.some(w=>w.provider===provider)){
    this.toast('WIDGET IS NOT INSTALLED');return;
  }
  const native=this.native();
  if(!native?.selectWidgetProvider){
    this.toast('WIDGET PICKER REQUIRES THE ANDROID APK');return;
  }
  this.closeSheet();
  this.setView('home');
  try{native.selectWidgetProvider(provider);}catch(e){this.toast('UNABLE TO ADD WIDGET');}
};
M.renderWidgetGallery=function(host){
  const Intro=document.createElement('p');Intro.className='sheet-help';
  Intro.textContent='Choose a built-in MEK-AI widget or browse real Android app widgets grouped by their installed provider. Supported sizes depend on each widget.';
  host.append(Intro);
  const heading=document.createElement('div');heading.className='picker-section-label';heading.textContent='MEK-AI / BUILT-IN';
  host.append(heading);
  const iconNames={mek:['◧','MEK-AI COMPANION','4×2'],clock:['◷','DOT-MATRIX CLOCK','2×2'],
    battery:['▣','POWER CELL','2×1'],tasks:['☑','CHECKLIST','4×2'],
    notes:['✎','WORKSHOP NOTES','4×2'],weather:['☀','WEATHER SHORTCUT','2×1'],
    music:['♫','MUSIC SHORTCUT','4×1'],house:['⌂','HOUSE CONTROL DECK','4×1'],
    calendar:['▦','CALENDAR SHORTCUT','2×1']};
  const grid=document.createElement('div');grid.className='picker-grid';
  for(const [kind,[glyph,name,size]] of Object.entries(iconNames)){
    const button=document.createElement('button');button.type='button';
    for(const [tag,cls,value] of [['span','picker-symbol',glyph],['b','',name],['small','',size+' CELLS']]){
      const node=document.createElement(tag);if(cls)node.className=cls;node.textContent=value;button.append(node);
    }
    button.onclick=()=>this.addWidget(kind);
    grid.append(button);
  }
  host.append(grid);
  const head=document.createElement('div');head.className='picker-section-label';
  head.textContent='INSTALLED ANDROID APP WIDGETS';host.append(head);
  const search=document.createElement('input');search.type='search';search.className='picker-search';
  search.placeholder='Search widgets or apps';search.value=this.widgetCatalogQuery;
  host.append(search);
  const entries=document.createElement('div');entries.className='native-widget-catalog';host.append(entries);
  const render=()=>{
    entries.replaceChildren();
    const q=this.widgetCatalogQuery.trim().toLowerCase();
    const shown=this.widgetCatalog.filter(w=>(w.name+' '+w.package).toLowerCase().includes(q));
    const groups=new Map();
    for(const w of shown){
      const group=groups.get(w.package)||[];group.push(w);groups.set(w.package,group);
    }
    if(!this.widgetCatalogLoaded){
      const p=document.createElement('p');p.className='sheet-help';p.textContent='Reading widget providers from Android…';entries.append(p);
    }else if(!shown.length){
      const p=document.createElement('p');p.className='sheet-help';p.textContent='No matching widgets found.';entries.append(p);
    }
    let previewCount=0;
    for(const [pkg,providers] of groups){
      const section=document.createElement('section');section.className='provider-widget-group';
      const h=document.createElement('h3');h.textContent=pkg;section.append(h);
      for(const p of providers){
        const button=document.createElement('button');button.className='provider-widget-item';button.type='button';
        const thumb=document.createElement('span');thumb.className='native-widget-preview';
        thumb.dataset.provider=p.provider;thumb.textContent='▧';
        const cached=this.widgetPreviewCache.get(p.provider);
        if(cached?.startsWith('data:image/')){
          const img=document.createElement('img');img.src=cached;img.alt='';thumb.replaceChildren(img);
        }
        const details=document.createElement('span');details.className='provider-widget-description';
        const name=document.createElement('strong');name.textContent=p.name;
        const caption=document.createElement('small');caption.textContent=
          Math.max(1,Math.round(p.minWidth/70))+'×'+Math.max(1,Math.round(p.minHeight/70))+
          ' START SIZE · '+(p.resizeMode?'RESIZABLE':'FIXED SIZE');
        details.append(name,caption);
        button.append(thumb,details);button.onclick=()=>this.selectNativeProvider(p.provider);
        section.append(button);
        if(!cached && previewCount<12&&!this.widgetPreviewRequested.has(p.provider)){
          this.widgetPreviewRequested.add(p.provider);previewCount++;
          try{this.native()?.requestWidgetPreview?.(p.provider);}catch(e){}
        }
      }
      entries.append(section);
    }
  };
  search.oninput=()=>{this.widgetCatalogQuery=search.value;render();};
  render();
  const fallback=document.createElement('button');fallback.className='sheet-primary';fallback.textContent='OPEN ANDROID SYSTEM WIDGET PICKER';
  fallback.onclick=()=>this.chooseNativeWidget();host.append(fallback);
  if(!this.widgetCatalogLoaded)this.readWidgetCatalog();
};
M.nativeWidgetChosen=(function(existing){
  return function(nativeId,label,minWidth,minHeight,metadata){
    const columns=this.model.settings.homeCols,rows=this.model.settings.homeRows;
    let info={};
    try{info=typeof metadata==='string'?JSON.parse(metadata):metadata||{};}catch(e){}
    const view=$('homeViewport');
    const cw=Math.max(240,view?.clientWidth||350)/columns;
    const ch=Math.max(360,view?.clientHeight||510)/rows;
    let width=Math.max(1,Math.min(columns,Math.ceil(minWidth/cw)));
    let height=Math.max(1,Math.min(rows,Math.ceil(minHeight/ch)));
    // New Android widgets are created with their provider metadata. Providers
    // without a resizeMode cannot be freely scaled by the launcher.
    const mode=Number(info.resizeMode)||0;
    const limits={
      minW:Math.max(1,Math.min(columns,Math.ceil((Number(info.minResizeWidth)||minWidth)/cw))),
      minH:Math.max(1,Math.min(rows,Math.ceil((Number(info.minResizeHeight)||minHeight)/ch))),
      maxW:Math.max(1,Math.min(columns,Number(info.maxResizeWidth)>0?Math.floor(info.maxResizeWidth/cw):columns)),
      maxH:Math.max(1,Math.min(rows,Number(info.maxResizeHeight)>0?Math.floor(info.maxResizeHeight/ch):rows)),
      resizeH:(mode&1)!==0,resizeV:(mode&2)!==0
    };
    if(!limits.resizeH)limits.minW=limits.maxW=width;
    if(!limits.resizeV)limits.minH=limits.maxH=height;
    limits.maxW=Math.max(limits.minW,limits.maxW);
    limits.maxH=Math.max(limits.minH,limits.maxH);
    const item={id:C.uid('android-widget'),type:'android-widget',nativeId,label:String(label||'App widget'),
      provider:info.provider||'',limits,x:0,y:0,w:width,h:height};
    const added=this.mutate(model=>C.addHome(model,item,model.current));
    if(added){
      this.goPage(this.model.current);this.enterEdit();this.toast('NATIVE WIDGET ADDED');
    }else {
      this.toast('NO SPACE FOR WIDGET');
      // Immediately return unused allocated host id to native inventory.
      this.scheduleWidgetInventorySync();
    }
  };
})(M.nativeWidgetChosen);
const previousRender=M.renderSheet;
M.renderSheet=function(){
  if(this.sheet==='widgets'){
    const host=$('sheetBody');host.replaceChildren();
    $('sheetTitle').textContent='WIDGETS / APPLICATIONS';
    this.renderWidgetGallery(host);
    return;
  }
  return previousRender.call(this);
};
window.mekNativeWidgetCatalog=x=>M.widgetCatalogReady(x);
window.mekNativeWidgetPreview=(provider,uri)=>M.widgetPreviewReady(provider,uri);
})();
