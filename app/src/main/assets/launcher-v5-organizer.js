/* MEK-AI v0.5.3: One UI-style app library organization and selection. */
(function(){
'use strict';
const M=window.Mek,C=M.Core,$=M.$;
M.selectMode=false;
M.selectedApps=new Set();
M.drawerSnapshot=null;
M.enableLibrarySelection=function(pkg=null){
  if(this.view!=='drawer')this.setView('drawer');
  this.selectMode=true;
  this.selectedApps=new Set();
  if(pkg&&C.packageOk(pkg))this.selectedApps.add(pkg);
  this.renderDrawer();
  this.renderLibrarySelection();
};
M.disableLibrarySelection=function(){
  if(!this.selectMode)return;
  this.selectMode=false;
  this.selectedApps.clear();
  $('drawerSelectionBar').classList.add('hidden');
  this.renderDrawer();
};
M.toggleLibrarySelection=function(pkg){
  if(!this.selectMode||!C.packageOk(pkg))return;
  if(this.selectedApps.has(pkg))this.selectedApps.delete(pkg);
  else this.selectedApps.add(pkg);
  this.renderLibrarySelection();
};
M.renderLibrarySelection=function(){
  const bar=$('drawerSelectionBar');
  if(!bar)return;
  bar.classList.toggle('hidden',!this.selectMode);
  $('drawerSelect').classList.toggle('active',this.selectMode);
  $('drawerCreateFolder').classList.toggle('hidden',this.selectMode);
  $('drawerSelectedCount').textContent=this.selectedApps.size+' SELECTED';
  for(const id of ['drawerSelectionFolder','drawerSelectionAdd','drawerSelectionHome']){
    $(id).disabled=this.selectedApps.size===0;
  }
  document.querySelectorAll('.app-page-cell').forEach(cell=>{
    const chosen=this.selectMode&&this.selectedApps.has(cell.dataset.pkg);
    cell.classList.toggle('is-selected',chosen);
    let mark=cell.querySelector('.selection-mark');
    if(!mark&&this.selectMode&&cell.dataset.pkg){
      mark=document.createElement('span');mark.className='selection-mark';mark.textContent='✓';
      cell.append(mark);
    }
    if(mark)mark.textContent=chosen?'✓':'';
    if(mark)mark.setAttribute('aria-label',chosen?'Selected':'Not selected');
    cell.setAttribute('aria-selected',chosen?'true':'false');
  });
};
M.selectedLibraryItems=function(){
  const chosen=this.selectedApps;
  return this.apps.filter(a=>chosen.has(a.pkg)).map(a=>({pkg:a.pkg,label:a.label}));
};
M.createLibraryFolder=function(){
  const apps=this.selectedLibraryItems();
  if(!apps.length){this.toast('SELECT AN APP FIRST');return;}
  const folder=C.cleanItem({
    type:'folder',id:C.uid('library-folder'),name:'New Folder',
    color:'olive',apps
  },1,1,true);
  this.mutate(model=>{model.drawerFolders.push(folder);});
  this.disableLibrarySelection();
  this.openFolder(folder.id);
  this.toast('FOLDER CREATED · TAP NAME TO RENAME');
};
M.addSelectedToFolder=function(folderId){
  const apps=this.selectedLibraryItems();
  if(!apps.length){this.toast('SELECT APPS FIRST');return;}
  let added=0;
  this.mutate(model=>{
    const destination=C.locate(model,folderId);
    if(!destination||destination.item.type!=='folder')return;
    const folder=destination.item;
    for(const app of apps){
      if(folder.apps.some(existing=>existing.pkg===app.pkg))continue;
      if(folder.apps.length>=100)break;
      folder.apps.push({pkg:app.pkg,label:app.label});added++;
    }
  });
  this.closeSheet();this.disableLibrarySelection();
  this.toast(added+' APP'+(added===1?'':'S')+' ADDED TO FOLDER');
};
M.addSelectedToHome=function(){
  const apps=this.selectedLibraryItems();
  if(!apps.length)return;
  let added=0;
  this.mutate(model=>{
    for(const app of apps){
      const tile=C.addHome(model,{
        type:'app',id:C.uid('home'),pkg:app.pkg,label:app.label,
        x:0,y:0,w:1,h:1
      },model.current);
      if(tile)added++;
    }
  });
  this.disableLibrarySelection();
  this.setView('home');
  this.enterEdit();
  this.goPage(this.model.current);
  this.toast(added+' APP'+(added===1?'':'S')+' ADDED TO HOME');
};
M.drawerKey=function(item){
  return item?.type==='app'?item.pkg:item?.id;
};
M.reorderDrawerItem=function(item,target=null){
  const sourceKey=this.drawerKey(item),targetKey=this.drawerKey(target);
  if(!sourceKey||sourceKey===targetKey)return false;
  const available=this.allDrawerItems().map(x=>this.drawerKey(x));
  const order=available.filter(k=>k!==sourceKey);
  const insertAt=targetKey?order.indexOf(targetKey):order.length;
  order.splice(insertAt<0?order.length:insertAt,0,sourceKey);
  this.mutate(model=>{
    model.settings.appSort='custom';
    model.drawerOrder=order;
  });
  this.toast('APP LIBRARY ORDER UPDATED');
  return true;
};
M.organizeDrawerDrop=function(source,target){
  if(!source)return false;
  if(!target)return this.reorderDrawerItem(source);
  if(this.drawerKey(source)===this.drawerKey(target))return false;
  if(source.type==='app'&&target.type==='folder'){
    const existing=target.apps||[];
    if(existing.some(a=>a.pkg===source.pkg))return false;
    const folderId=target.id;
    this.mutate(model=>{
      const folder=C.locate(model,folderId)?.item;
      if(folder&&folder.apps.length<100)folder.apps.push({pkg:source.pkg,label:source.label});
    });
    this.toast('APP MOVED INTO FOLDER');
    return true;
  }
  if(source.type==='app'&&target.type==='app'){
    const folder=C.cleanItem({
      type:'folder',id:C.uid('library-folder'),name:'New Folder',color:'olive',
      apps:[{pkg:target.pkg,label:target.label},{pkg:source.pkg,label:source.label}]
    },1,1,true);
    this.mutate(model=>{model.drawerFolders.push(folder);});
    this.openFolder(folder.id);
    this.toast('FOLDER CREATED');
    return true;
  }
  return this.reorderDrawerItem(source,target);
};
M.setupLibraryOrganizer=function(){
  $('drawerCreateFolder').onclick=()=>this.openSheet('folder-create');
  $('drawerSelect').onclick=()=>{
    if(this.selectMode)this.disableLibrarySelection();
    else this.enableLibrarySelection();
  };
  $('drawerSelectionCancel').onclick=()=>this.disableLibrarySelection();
  $('drawerSelectionFolder').onclick=()=>this.createLibraryFolder();
  $('drawerSelectionAdd').onclick=()=>this.openSheet('library-target');
  $('drawerSelectionHome').onclick=()=>this.addSelectedToHome();
  this.renderLibrarySelection();
};
// The existing customization sheet stays the single dialog for assigning
// multiple apps to an existing drawer folder.
const originalSheet=M.renderSheet;
M.renderSheet=function(){
  if(this.sheet!=='library-target')return originalSheet.call(this);
  const body=$('sheetBody');body.textContent='';
  $('sheetTitle').textContent='ADD APPS TO A FOLDER';
  const help=document.createElement('p');help.className='sheet-help';
  help.textContent='Choose which existing app-library folder receives the '+this.selectedApps.size+
    ' selected application'+(this.selectedApps.size===1?'':'s')+'.';
  body.append(help);
  const folders=this.model.drawerFolders;
  for(const folder of folders){
    const button=document.createElement('button');button.className='option-button';
    button.textContent=(folder.name||'Folder')+' · '+folder.apps.length+' APPS';
    button.onclick=()=>this.addSelectedToFolder(folder.id);
    body.append(button);
  }
  const create=document.createElement('button');create.className='sheet-primary';
  create.textContent='＋ MAKE NEW FOLDER';
  create.onclick=()=>{this.closeSheet();this.createLibraryFolder();};
  body.append(create);
  if(!folders.length){
    const empty=document.createElement('p');empty.className='sheet-note';
    empty.textContent='No folders yet. You can create one with your current selection.';
    body.insertBefore(empty,create);
  }
};
})();
