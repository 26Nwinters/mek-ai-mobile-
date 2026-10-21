/* MEK-AI v0.6 built-in responsive widgets, customization and widget stacks. */
(function(){
'use strict';
const M=window.Mek,C=M.Core,$=M.$;
const E=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;};
const KINDS={
  mek:'MEK-AI COMPANION',clock:'DOT MATRIX CLOCK',battery:'BATTERY',
  tasks:'TODAY TASKS',notes:'WORKSHOP NOTE',weather:'WEATHER SHORTCUT',
  music:'MUSIC SHORTCUT',house:'HOUSE CONTROL DECK',calendar:'CALENDAR'
};
M.stackDom=function(item){
  const host=E('div','widget-tile widget-stack');host.dataset.stack=item.id;
  const children=Array.isArray(item.stack)?item.stack:[];
  const active=children[Math.max(0,Math.min(children.length-1,item.active||0))];
  if(!active)return host;
  const child={id:active.id,type:'widget',kind:active.kind,
    config:active.config||{},w:item.w,h:item.h};
  const widget=this.widgetDom(child);
  widget.classList.add('widget-stack-current');
  widget.style.border='none';widget.style.boxShadow='none';
  host.append(widget);
  const marker=E('div','widget-stack-indicators');
  for(let i=0;i<children.length;i++){
    const dot=E('span',i===item.active?'current':'');
    marker.append(dot);
  }
  host.append(marker);
  host.setAttribute('aria-label','Stack with '+children.length+' widgets · swipe sideways');
  return host;
};
M.changeStack=function(id,delta){
  const found=C.locate(this.model,id);
  if(!found||found.item.type!=='stack')return false;
  const before=found.item.active||0,limit=found.item.stack.length;
  const index=Math.max(0,Math.min(limit-1,before+delta));
  if(index===before)return false;
  this.mutate(model=>{
    const loc=C.locate(model,id);
    if(loc&&loc.item.type==='stack')loc.item.active=index;
  });
  return true;
};
M.activeStackItem=function(item){
  const child=item.stack?.[item.active||0];
  return child?{type:'widget',kind:child.kind,config:child.config||{}}:null;
};
const oldOpen=M.openItem;
M.openItem=function(item){
  if(item?.type==='stack')return oldOpen.call(this,this.activeStackItem(item));
  return oldOpen.call(this,item);
};
const originalWidget=M.widgetDom;
M.widgetDom=function(item){
  const widget=originalWidget.call(this,item);
  const config=item.config||{};
  const tint=['amber','olive','rust','copper','slate'].includes(config.tint)?config.tint:'amber';
  widget.dataset.tint=tint;
  widget.classList.add('configured-widget');
  const alpha=Number(config.opacity);
  if(Number.isFinite(alpha)&&alpha>=.35&&alpha<=1){
    widget.style.setProperty('--widget-opacity',alpha);
  }
  if(item.kind==='mek'){
    const moods={
      idle:['● COMPANION IDLE','Keeping watch over the workshop.'],
      happy:['● COMPANION HAPPY','The circuits are in a good mood.'],
      thinking:['● COMPANION THINKING','Processing a very important thought.'],
      sleep:['◦ COMPANION RESTING','Wake me when you need something.']
    };
    const mood=Object.prototype.hasOwnProperty.call(moods,config.mood)?config.mood:'idle';
    widget.dataset.mood=mood;
    const line=widget.querySelector('.micro-label.amber');
    const hint=widget.querySelector('.robot-hint');
    if(line)line.textContent=moods[mood][0];
    if(hint)hint.textContent=moods[mood][1];
    widget.querySelector('img')?.setAttribute('loading','lazy');
  }
  if(item.kind==='clock'){
    widget.dataset.clockStyle=['dots','minimal'].includes(config.clockStyle)?config.clockStyle:'dots';
    const simple=document.createElement('div');
    simple.className='clock-minimal-time';
    simple.textContent=this.now().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
    widget.insertBefore(simple,widget.querySelector('.widget-foot'));
  }
  return widget;
};
M.renderCompanionWidgetSettings=function(host,loc){
  const item=loc.item;
  const current=item.type==='stack'?item.stack[item.active||0]:item;
  const config=current.config||{};
  host.append(E('p','sheet-help','Customize this MEK-AI widget without affecting others on Home.'));
  const opacity=E('div','options-row'),left=E('span'),slider=E('input');
  left.append(E('b',null,'SURFACE TRANSPARENCY'),E('small',null,'Keep content readable over wallpaper'));
  slider.type='range';slider.min='35';slider.max='100';slider.value=Math.round((config.opacity||.92)*100);
  slider.setAttribute('aria-label','Widget opacity');
  slider.onchange=()=>{
    this.mutate(model=>{
      const at=C.locate(model,item.id)?.item;
      if(!at)return;
      const child=at.type==='stack'?at.stack[at.active||0]:at;
      child.config={...(child.config||{}),opacity:Number(slider.value)/100};
    });
  };
  opacity.append(left,slider);host.append(opacity);
  const section=E('div','picker-section-label','ACCENT');
  host.append(section);
  for(const tint of ['amber','olive','rust','copper','slate']){
    const b=E('button','option-button'+((config.tint||'amber')===tint?' selected':''),tint.toUpperCase());
    b.onclick=()=>{
      this.mutate(model=>{
        const target=C.locate(model,item.id)?.item;
        if(!target)return;
        const child=target.type==='stack'?target.stack[target.active||0]:target;
        child.config={...(child.config||{}),tint};
      });
      this.renderSheet();
    };
    host.append(b);
  }
  if(current.kind==='mek'){
    host.append(E('div','picker-section-label','MEK-AI EXPRESSION'));
    for(const mood of ['idle','happy','thinking','sleep']){
      const b=E('button','option-button'+((config.mood||'idle')===mood?' selected':''),mood.toUpperCase());
      b.onclick=()=>{
        this.mutate(model=>{
          const x=C.locate(model,item.id)?.item;if(!x)return;
          const child=x.type==='stack'?x.stack[x.active||0]:x;
          child.config={...(child.config||{}),mood};
        });
        this.renderSheet();
      };
      host.append(b);
    }
  }
  if(current.kind==='clock'){
    host.append(E('div','picker-section-label','CLOCK PRESENTATION'));
    for(const style of ['dots','minimal']){
      const b=E('button','option-button'+((config.clockStyle||'dots')===style?' selected':''),style.toUpperCase());
      b.onclick=()=>{
        this.mutate(model=>{
          const x=C.locate(model,item.id)?.item;if(!x)return;
          const child=x.type==='stack'?x.stack[x.active||0]:x;
          child.config={...(child.config||{}),clockStyle:style};
        });this.renderSheet();
      };
      host.append(b);
    }
  }
};
M.renderStackPicker=function(host,loc){
  const item=loc.item;
  host.append(E('p','sheet-help','Stack built-in widgets of one size. Swipe sideways inside the stack to change widgets without changing Home pages.'));
  const count=item.type==='stack'?item.stack.length:1;
  host.append(E('div','picker-section-label',count+' OF 10 STACK POSITIONS'));
  const grid=E('div','picker-grid');
  for(const [kind,label] of Object.entries(KINDS)){
    const b=E('button');b.type='button';
    b.append(E('span','picker-symbol',kind==='mek'?'◧':'▧'),E('b',null,label),
      E('small',null,'ADD TO THIS STACK'));
    b.onclick=()=>{
      const success=this.mutate(model=>C.addToStack(model,item.id,{type:'widget',kind,x:0,y:0,w:item.w,h:item.h}));
      if(success){this.openSheet('stack-edit',{id:item.id});this.toast('STACK UPDATED');}
      else this.toast('STACK IS FULL');
    };
    grid.append(b);
  }
  host.append(grid);
};
M.renderStackEdit=function(host,loc){
  const item=loc.item;
  if(item.type!=='stack'){host.append(E('p','sheet-help','This widget is not currently stacked.'));return;}
  host.append(E('p','sheet-help','Choose the visible widget, reorder them, or remove one without deleting the other widgets.'));
  for(let i=0;i<item.stack.length;i++){
    const child=item.stack[i];
    const box=E('div','page-manager-item');
    const heading=E('span');heading.append(E('b',null,KINDS[child.kind]||child.kind));
    const action=E('div','page-manager-actions');
    for(const [text,fn] of [
      ['●',()=>{this.mutate(model=>{const x=C.locate(model,item.id)?.item;if(x?.type==='stack')x.active=i;});this.renderSheet();}],
      ['←',()=>{this.mutate(model=>{const x=C.locate(model,item.id)?.item;if(x?.type==='stack'&&i>0){[x.stack[i-1],x.stack[i]]=[x.stack[i],x.stack[i-1]];x.active=i-1;}});this.renderSheet();}],
      ['→',()=>{this.mutate(model=>{const x=C.locate(model,item.id)?.item;if(x?.type==='stack'&&i<x.stack.length-1){[x.stack[i+1],x.stack[i]]=[x.stack[i],x.stack[i+1]];x.active=i+1;}});this.renderSheet();}],
      ['×',()=>{this.mutate(model=>C.removeStackChild(model,item.id,i));this.renderSheet();}]
    ]){
      const b=E('button',null,text);b.onclick=fn;action.append(b);
    }
    box.append(E('span','picker-symbol',child.kind==='mek'?'◧':'▧'),heading,action);
    host.append(box);
  }
  const add=E('button','sheet-primary','＋ ADD A WIDGET TO THIS STACK');
  add.onclick=()=>this.openSheet('stack-add',{id:item.id});host.append(add);
};
const oldClock=M.refreshClock;
M.refreshClock=function(){
  oldClock.call(this);
  const value=this.now().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
  document.querySelectorAll('.clock-minimal-time').forEach(node=>node.textContent=value);
};
const oldSheet=M.renderSheet;
M.renderSheet=function(){
  const id=this.sheetArgs?.id,loc=id?C.locate(this.model,id):null,host=$('sheetBody');
  if(this.sheet==='widget-config'&&loc){
    $('sheetTitle').textContent='CUSTOMIZE WIDGET';host.replaceChildren();
    if(loc.item.type==='android-widget'){
      const details=E('p','sheet-help','This widget is controlled by its Android application. Use the provider settings where available.');
      host.append(details);
      const btn=E('button','sheet-primary','OPEN WIDGET CONFIGURATION');
      btn.onclick=()=>{this.closeSheet();this.native()?.reconfigureWidget?.(loc.item.nativeId);};
      host.append(btn);
    }else this.renderCompanionWidgetSettings(host,loc);
    return;
  }
  if(this.sheet==='stack-add'&&loc){
    $('sheetTitle').textContent='ADD TO WIDGET STACK';host.replaceChildren();
    this.renderStackPicker(host,loc);return;
  }
  if(this.sheet==='stack-edit'&&loc){
    $('sheetTitle').textContent='EDIT WIDGET STACK';host.replaceChildren();
    this.renderStackEdit(host,loc);return;
  }
  return oldSheet.call(this);
};
})();
