const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../app/src/main/assets/launcher-core.js');

// Deterministic stress test of actual launcher model operations. Keep the
// pseudo-random seed stable so regressions reproduce in GitHub Actions.
test('1300 Home operations preserve item identities, grid safety and atomic failures',()=>{
  let seed=0x4200cafe;
  function rng(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/2**32;}
  function choose(arr){return arr[Math.floor(rng()*arr.length)];}
  function verify(model){
    const all=model.pages.flatMap(p=>p.items);
    assert.equal(new Set(all.map(x=>x.id)).size,all.length,'no duplicate Home IDs');
    for(const page of model.pages){
      for(const [i,a] of page.items.entries()){
        assert.ok(Core.inside(a,model.settings.homeCols,model.settings.homeRows),'inside grid');
        for(let j=i+1;j<page.items.length;j++)
          assert.equal(Core.overlap(a,page.items[j]),false,'no overlapping icons');
      }
    }
  }
  const model=Core.defaultState();
  for(let i=0;i<140;i++)
    Core.addHome(model,{id:'stress-app-'+i,type:'app',pkg:'com.stress.app'+i,label:'Stress '+i});
  verify(model);
  for(let i=0;i<1300;i++){
    const all=model.pages.flatMap(p=>p.items);
    const operation=Math.floor(rng()*6);
    if(operation===0){
      Core.addHome(model,{id:'extra-'+i,type:'app',pkg:'com.stress.add'+i,label:'Added '+i});
    }else if(operation===1){
      const source=choose(all),destination=choose(model.pages);
      if(source&&destination){
        const before=JSON.stringify(model);
        const done=Core.moveAtomic(model,source.id,destination.id,
          Math.floor(rng()*model.settings.homeCols),Math.floor(rng()*model.settings.homeRows));
        if(!done)assert.equal(JSON.stringify(model),before,'failed drag rollback must be exact');
      }
    }else if(operation===2){
      const widget=choose(all.filter(a=>['widget','stack','android-widget'].includes(a.type)));
      if(widget)Core.resizeSmart(model,widget.id,
        1+Math.floor(rng()*model.settings.homeCols),
        1+Math.floor(rng()*model.settings.homeRows));
    }else if(operation===3){
      const widget=choose(all.filter(a=>a.type==='widget'));
      if(widget)Core.addToStack(model,widget.id,{type:'widget',kind:'clock',w:1,h:1});
    }else if(operation===4){
      const apps=all.filter(a=>a.type==='app');
      if(apps.length>70)Core.removeSafe(model,choose(apps).id);
    }else{
      const page=choose(model.pages);
      if(page)Core.reorderPage(model,page.id,rng()<0.5?-1:1);
    }
    verify(model);
  }
  verify(Core.normalize(model));
});
