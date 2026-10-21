/* Move apps between Home/Apps folders without duplicate packages. */
(function(){
'use strict';
const M=window.Mek,C=M.Core,$=M.$;
M.moveFolderApp=function(sourceFolderId,packageName,targetFolderId,beforePkg=null){
  const original=this.findFolder(sourceFolderId),target=this.findFolder(targetFolderId);
  if(!original||!target||!C.packageOk(packageName))return false;
  const moving=original.apps.find(a=>a.pkg===packageName);
  if(!moving)return false;
  if(sourceFolderId!==targetFolderId&&target.apps.some(a=>a.pkg===packageName))return false;
  const done=this.mutate(model=>{
    const from=C.locate(model,sourceFolderId)?.item,to=C.locate(model,targetFolderId)?.item;
    if(!from||!to||to.apps.length>=100&&from!==to)return false;
    from.apps=from.apps.filter(a=>a.pkg!==packageName);
    const insertion=beforePkg?to.apps.findIndex(a=>a.pkg===beforePkg):-1;
    to.apps.splice(insertion>=0?insertion:to.apps.length,0,{pkg:moving.pkg,label:moving.label});
    return true;
  });
  if(done&&this.activeFolder)this.renderFolder();
  return !!done;
};
const previousActions=M.renderFolderAppActions;
M.renderFolderAppActions=function(host,opts){
  previousActions.call(this,host,opts);
  const item=opts?.app,sourceId=this.activeFolder;
  if(!item||!sourceId)return;
  const targets=this.model.drawerFolders.concat(this.model.pages.flatMap(page=>page.items))
    .filter(f=>f.type==='folder'&&f.id!==sourceId);
  if(!targets.length)return;
  const btn=document.createElement('button');btn.className='option-button';
  btn.textContent='MOVE TO ANOTHER FOLDER';
  btn.onclick=()=>this.openSheet('folder-target',{app:item,sourceId});
  host.append(btn);
};
const previousSheet=M.renderSheet;
M.renderSheet=function(){
  if(this.sheet!=='folder-target')return previousSheet.call(this);
  const args=this.sheetArgs,host=$('sheetBody');host.replaceChildren();
  $('sheetTitle').textContent='MOVE APPLICATION TO FOLDER';
  const description=document.createElement('p');description.className='sheet-help';
  description.textContent='Choose the destination folder. The original app stays installed.';
  host.append(description);
  const list=[...this.model.drawerFolders,...this.model.pages.flatMap(page=>page.items)]
    .filter(f=>f.type==='folder'&&f.id!==args.sourceId);
  for(const folder of list){
    const button=document.createElement('button');button.className='option-button';
    button.textContent=folder.name+' ('+folder.apps.length+' APPS)';
    button.onclick=()=>{
      const done=this.moveFolderApp(args.sourceId,args.app.pkg,folder.id);
      this.closeSheet();if(done){this.closeFolder();this.toast('APP MOVED BETWEEN FOLDERS');}
      else this.toast('COULD NOT MOVE APP');
    };
    host.append(button);
  }
};
})();
