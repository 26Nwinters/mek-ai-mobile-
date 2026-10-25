/* MEK-AI v0.5: customization sheets, page manager, backup and widget controls. */
(function(){
'use strict';
const M=window.Mek,C=M.Core,$=M.$;
function E(tag,cls,copy){
  const n=document.createElement(tag);
  if(cls)n.className=cls;
  if(copy!=null)n.textContent=String(copy);
  return n;
}
function help(host,content){host.append(E('p','sheet-help',content));}
function primary(host,label,callback,danger=false){
  const b=E('button',danger?'sheet-danger':'sheet-primary',label);b.type='button';b.onclick=callback;host.append(b);return b;
}
function opt(host,title,subtitle,onClick,selected=false){
  const button=E('button','option-button'+(selected?' selected':''));
  button.type='button';button.textContent=title;
  if(subtitle)button.append(E('span','sheet-note',subtitle));
  button.onclick=onClick;host.append(button);return button;
}
function row(host,title,description,content){
  const root=E('div','options-row'),label=E('span');
  label.append(E('b',null,title));if(description)label.append(E('small',null,description));
  root.append(label);if(content)root.append(content);
  host.append(root);return root;
}
function checkbox(host,title,description,checked,onChange){
  const input=E('input');input.type='checkbox';input.checked=checked;
  input.setAttribute('aria-label',title);input.addEventListener('change',()=>onChange(input.checked));
  row(host,title,description,input);
}
function stepper(host,title,description,value,min,max,onChange){
  const group=E('div','stepper');
  const less=E('button',null,'−'),more=E('button',null,'+'),number=E('span',null,value);
  less.type=more.type='button';
  less.disabled=value<=min;more.disabled=value>=max;
  less.onclick=()=>onChange(Math.max(min,value-1));
  more.onclick=()=>onChange(Math.min(max,value+1));
  group.append(less,number,more);row(host,title,description,group);
}
function demo(host,cols,rows){
  const caption=E('div','grid-summary',cols+' × '+rows+' / '+(cols*rows)+' CELLS');
  const grid=E('div','grid-demo');grid.style.setProperty('--preview-cols',cols);
  for(let i=0;i<cols*rows;i++)grid.append(E('span'));
  host.append(caption,grid);
}
M.openSheet=function(kind,options={}){
  this.sheet=kind;this.sheetArgs=options;
  this.updateNativeWidgetLayer(false);
  $('sheetOverlay').classList.remove('hidden');
  this.scheduleWidgetSync();
  this.renderSheet();
};
M.closeSheet=function(){
  this.sheet=null;this.sheetArgs={};
  $('sheetOverlay').classList.add('hidden');
  this.scheduleWidgetSync();
};
M.renderSheet=function(){
  const host=$('sheetBody');if(!host||!this.sheet)return;
  host.textContent='';
  const kind=this.sheet,opts=this.sheetArgs||{},settings=this.model.settings;
  const titles={
    widgets:'WIDGET GALLERY','apps-picker':'CHOOSE AN APPLICATION','grid-home':'HOME SCREEN GRID',
    'grid-apps':'APPS SCREEN GRID','grid-folders':'FOLDER GRID',pages:'MANAGE HOME PAGES',
    dock:'DOCK / HOTBAR',appearance:'ICONS & WALLPAPER',themes:'TERMINAL THEMES',
    gestures:'SWIPE GESTURES',backup:'BACKUP & RESTORE',reset:'RESET LAUNCHER',
    'drawer-sort':'APP DRAWER ORDER','app-actions':'APPLICATION OPTIONS',
    'dock-select':'CHOOSE DOCK APPLICATION','folder-color':'FOLDER APPEARANCE',
    'resize':'RESIZE WIDGET','notes-edit':'WORKSHOP NOTE','tasks-edit':'TODAY\'S TASKS',
    'folder-create':'CREATE FOLDER','folder-app-actions':'FOLDER APPLICATION'
  };
  $('sheetTitle').textContent=titles[kind]||'PERSONALIZE HOME';

  if(kind==='widgets'){
    help(host,'Select a built-in MEK-AI widget. Each widget can be moved and resized after adding it.');
    const cards=E('div','picker-grid');
    const glyphs={mek:'◧',clock:'◷',battery:'▣',tasks:'☑',notes:'✎',weather:'☀',music:'♫',house:'⌂',calendar:'▦'};
    const names={mek:'MEK-AI COMPANION',clock:'DOT-MATRIX CLOCK',battery:'POWER CELL',tasks:'CHECKLIST',notes:'WORKSHOP NOTES',weather:'WEATHER LINK',music:'MUSIC LINK',house:'HOUSE CONTROLS',calendar:'CALENDAR'};
    Object.keys(names).forEach(kind=>{
      const button=E('button');button.type='button';
      const symbol=E('span','picker-symbol',glyphs[kind]),name=E('b',null,names[kind]);
      const size=Object.assign({},WIDGET_DEFAULTS)[kind]||[2,1];
      button.append(symbol,name,E('small',null,size[0]+' × '+size[1]+' GRID CELLS'));
      button.onclick=()=>this.addWidget(kind);
      cards.append(button);
    });
    host.append(cards);
    primary(host,'＋ CHOOSE ANDROID APP WIDGET',()=>this.chooseNativeWidget());
    help(host,'Android widgets use the native AppWidgetHost picker and real provider views. Some providers may require configuration or may not support this experimental WebView overlay.');
    return;
  }

  if(kind==='apps-picker'||kind==='dock-select'){
    if(kind==='dock-select'){
      if(Number.isInteger(opts.slot))this.picking={type:'dock',slot:opts.slot};
      else this.picking={type:'dock',slot:0};
    }else if(!this.picking)this.picking={type:'home'};
    help(host,this.picking?.type==='dock'?'Tap any installed app to keep it in your permanent dock.':this.picking?.type==='folder'?'Select an application for this folder.':'Select an installed app. It will appear on your current Home page.');
    const search=E('input','picker-search');
    search.type='search';search.placeholder='Find an installed app…';search.autocomplete='off';
    host.append(search);
    const grid=E('div','picker-apps');host.append(grid);
    const repaint=()=>{
      grid.textContent='';
      const names=(this.picking?.type==='folder'?[]:this.systemCatalog).concat(this.apps);
      const q=search.value.trim().toLowerCase();
      const found=names.filter(item=>(item.label||'').toLowerCase().includes(q));
      if(!found.length){grid.append(E('p','sheet-note',this.appsLoaded?'No matching apps':'Scanning installed apps…'));return;}
      found.slice(0,180).forEach(item=>{
        const button=this.iconDom(item);
        button.title='Add '+(item.label||'App');
        button.onclick=()=>this.pickApp(item);
        grid.append(button);
      });
    };
    search.oninput=repaint;
    repaint();
    if(!this.appsLoaded)this.refreshApps();
    return;
  }

  if(['grid-home','grid-apps','grid-folders'].includes(kind)){
    const keys=kind==='grid-home'?['homeCols','homeRows',3,6,4,8]:
      kind==='grid-apps'?['appCols','appRows',4,6,4,8]:
      ['folderCols','folderRows',3,6,3,6];
    const [colKey,rowKey,colMin,colMax,rowMin,rowMax]=keys;
    help(host,'Set the number of columns and rows independently. All three screens have their own layout settings.');
    stepper(host,'COLUMNS','Icons across the screen',settings[colKey],colMin,colMax,value=>{
      this.mutate(model=>{model.settings[colKey]=value;if(kind==='grid-home')C.reflow(model);});
      this.renderSheet();
    });
    stepper(host,'ROWS','Grid cells from top to bottom',settings[rowKey],rowMin,rowMax,value=>{
      this.mutate(model=>{model.settings[rowKey]=value;if(kind==='grid-home')C.reflow(model);});
      this.renderSheet();
    });
    demo(host,settings[colKey],settings[rowKey]);
    if(kind==='grid-home')help(host,'When the grid gets smaller, icons and widgets are moved to available cells or another Home page. Your layout can be undone.');
    if(kind==='grid-apps')help(host,'App drawer pages are rebuilt using this grid while Home pages and folders stay unchanged.');
    return;
  }

  if(kind==='pages'){
    help(host,'Reorder Home pages, choose the page opened by the Home button, or add a new page. The dock stays fixed.');
    const list=E('div','page-manager-list');
    this.model.pages.forEach((page,i)=>{
      const item=E('div','page-manager-item'),thumbnail=E('div','page-thumb');
      for(let n=0;n<Math.min(12,page.items.length);n++)thumbnail.append(E('i'));
      const details=E('div');details.append(E('b',null,'HOME PAGE '+(i+1)));
      details.append(E('small',null,page.items.length+' ITEM'+(page.items.length===1?'':'S')+
        (this.model.settings.homeDefault===page.id?' · DEFAULT':'')));
      const actions=E('div','page-manager-actions');
      const act=(label,cb)=>{const b=E('button',null,label);b.type='button';b.onclick=cb;actions.append(b);};
      act('⌂',()=>{
        this.mutate(model=>{model.settings.homeDefault=page.id;});
        this.toast('DEFAULT HOME PAGE UPDATED');this.renderSheet();
      });
      act('←',()=>{this.mutate(model=>C.reorderPage(model,page.id,-1));this.renderSheet();});
      act('→',()=>{this.mutate(model=>C.reorderPage(model,page.id,1));this.renderSheet();});
      act('×',()=>{
        if(this.model.pages.length===1){this.toast('KEEP AT LEAST ONE PAGE');return;}
        this.mutate(model=>C.deletePage(model,page.id));
        this.renderSheet();
      });
      item.append(thumbnail,details,actions);list.append(item);
    });
    host.append(list);
    primary(host,'＋ ADD NEW HOME PAGE',()=>{
      this.mutate(model=>{const page=C.addPage(model,model.current);if(page)model.current=page.id;});
      this.renderSheet();this.toast('HOME PAGE ADDED');
    });
    help(host,'Removing a page moves its apps and widgets to available spaces elsewhere. You cannot delete the last Home page.');
    return;
  }

  if(kind==='dock'){
    help(host,'Your favorite apps are visible on every Home page. Hold and drag icons into or out of the dock.');
    stepper(host,'FAVORITE APP SLOTS','Up to five permanent positions',settings.dockSlots,3,5,value=>{
      this.mutate(model=>{
        const before=model.settings.dockSlots;
        if(value<before)for(let i=value;i<before;i++)if(model.dock[i]){
          C.addHome(model,model.dock[i],model.current);
        }
        model.settings.dockSlots=value;
        model.dock.length=value;
        while(model.dock.length<value)model.dock.push(null);
      });
      this.renderSheet();
    });
    host.append(E('div','picker-section-label','DOCK APPEARANCE'));
    [['glass','FROSTED GLASS'],['metal','WEATHERED METAL'],['none','TRANSPARENT']].forEach(([key,label])=>{
      opt(host,label,null,()=>{this.mutate(model=>{model.settings.dockStyle=key;});this.renderSheet();},settings.dockStyle===key);
    });
    for(let i=0;i<settings.dockSlots;i++){
      const item=this.model.dock[i];
      opt(host,'SLOT '+(i+1)+' / '+(item?.label||item?.name||'EMPTY'),item?'Tap to change this favorite':'Add an app or folder',
        ()=>{this.picking={type:'dock',slot:i};this.openSheet('dock-select',{slot:i});});
    }
    return;
  }

  if(kind==='appearance'){
    help(host,'Adjust the MEK-AI desktop without changing your apps.');
    stepper(host,'ICON SIZE','Size of Home and dock icons',settings.iconSize,36,72,value=>{
      this.mutate(model=>{model.settings.iconSize=value;});this.renderSheet();
    });
    checkbox(host,'SHOW APPLICATION NAMES','Hide labels for a cleaner Home',settings.labels,checked=>{
      this.mutate(model=>{model.settings.labels=checked;});});
    checkbox(host,'WORKSHOP WALLPAPER','Show the sunlit industrial hideaway',settings.wallpaper,checked=>{
      this.mutate(model=>{model.settings.wallpaper=checked;});});
    host.append(E('div','picker-section-label','WALLPAPER STYLE'));
    opt(host,'SUNKISSED WORKSHOP','Overgrown industrial workshop artwork.',()=>{
      this.mutate(model=>{model.wallpaperChoice='workshop';model.settings.wallpaper=true;});
      this.renderSheet();
    },this.model.wallpaperChoice==='workshop');
    opt(host,'SOLID TERMINAL','A simple wallpaper matched to your chosen theme.',()=>{
      this.mutate(model=>{model.wallpaperChoice='solid';model.settings.wallpaper=false;});
      this.renderSheet();
    },this.model.wallpaperChoice==='solid');
    checkbox(host,'ANIMATIONS','Enable page motion and icon jiggle',settings.motion,checked=>{
      this.mutate(model=>{model.settings.motion=checked;});});
    checkbox(host,'LOCK HOME LAYOUT','Prevent accidental dragging or editing',settings.layoutLocked===true,checked=>{
      if(checked&&this.edit)this.exitEdit();
      this.mutate(model=>{model.settings.layoutLocked=checked;});
    });
    return;
  }

  if(kind==='themes'){
    help(host,'Original MEK-AI color palettes. Your artwork and layout stay the same.');
    [['overgrown','OVERGROWN WORKSHOP'],['amber','AMBER INDUSTRIAL'],['moss','MOSS NIGHT']].forEach(([key,label])=>{
      opt(host,label,null,()=>{this.mutate(model=>{model.settings.theme=key;});this.renderSheet();},settings.theme===key);
    });
    return;
  }

  if(kind==='gestures'){
    help(host,'These familiar phone gestures can be enabled or disabled individually.');
    checkbox(host,'SWIPE UP FOR APPS','Open the app drawer from Home',settings.swipeUp!==false,value=>{
      this.mutate(model=>{model.settings.swipeUp=value;});
    });
    checkbox(host,'SWIPE DOWN TO HOME','Close the app drawer with a downward swipe',settings.swipeDown!==false,value=>{
      this.mutate(model=>{model.settings.swipeDown=value;});
    });
    checkbox(host,'SWIPE SIDEWAYS','Switch between Home pages',settings.swipePages!==false,value=>{
      this.mutate(model=>{model.settings.swipePages=value;});
    });
    help(host,'You can always open Apps with an optional shortcut from the widget/application picker, even if swipe-up is disabled.');
    return;
  }

  if(kind==='drawer-sort'){
    help(host,'Choose how the app drawer is ordered. Search always remains available.');
    opt(host,'ALPHABETICAL A–Z','Sort by application name.',()=>{this.mutate(model=>{model.settings.appSort='alphabetical';});this.renderSheet();},settings.appSort==='alphabetical');
    opt(host,'CUSTOM ORDER','Keep your own preferred app order.',()=>{this.mutate(model=>{model.settings.appSort='custom';});this.renderSheet();},settings.appSort==='custom');
    host.append(E('div','picker-section-label','APP DRAWER SCROLLING'));
    opt(host,'HORIZONTAL PAGES','Traditional Galaxy app pages with indicator dots.',()=>{
      this.mutate(model=>{model.settings.appLayout='horizontal';});this.renderSheet();
    },settings.appLayout!=='vertical');
    opt(host,'VERTICAL APP LIST','Optional vertically scrolling app pages.',()=>{
      this.mutate(model=>{model.settings.appLayout='vertical';});this.renderSheet();
    },settings.appLayout==='vertical');
    if(settings.appSort==='custom'){
      const apps=this.allDrawerItems().slice(0,80);
      help(host,'Long-press an app in the drawer to move it up or down. Recent choices appear first.');
      for(const app of apps.slice(0,18)){
        const title=app.label||app.name;
        opt(host,title,'MOVE TO THE FRONT OF THE APP DRAWER',()=>{
          const key=app.type==='app'?app.pkg:app.id;
          this.mutate(model=>{model.drawerOrder=model.drawerOrder.filter(x=>x!==key);model.drawerOrder.unshift(key);});
          this.renderSheet();
        });
      }
    }
    return;
  }

  if(kind==='resize'){
    const located=C.locate(this.model,opts.id);
    if(!located||!['widget','android-widget','stack'].includes(located.item.type)){
      this.closeSheet();return;
    }
    const item=located.item;
    const cols=settings.homeCols,rows=settings.homeRows;
    const lim=item.type==='android-widget'&&item.limits?item.limits:null;
    const minW=lim?lim.minW:1,maxW=lim?lim.maxW:cols;
    const minH=lim?lim.minH:1,maxH=lim?lim.maxH:rows;
    const widthEnabled=!lim||lim.resizeH!==false;
    const heightEnabled=!lim||lim.resizeV!==false;
    host.append(E('p','sheet-help',
      'Choose the exact width and height in Home grid cells. Use ↔ for width, ↕ for height, or ⤡ for both. Widgets snap to cells, not fixed aspect ratios.'));
    const sizeLabel=E('div','grid-summary','CURRENT SIZE  '+item.w+' × '+item.h);
    host.append(sizeLabel);
    if(item.type==='android-widget'){
      if(item.needsRebind){
        primary(host,'RECONNECT RESTORED ANDROID WIDGET',()=>this.beginWidgetRebind(item.id));
      }else{
        primary(host,'REFRESH BLANK ANDROID WIDGET',()=>{
          this.closeSheet();
          this.retryNativeWidget(item.nativeId);
        });
        help(host,'Recreates the on-screen view without removing its provider binding or your widget position.');
      }
    }
    if(lim)host.append(E('p','sheet-help',
      'ANDROID PROVIDER: WIDTH '+(widthEnabled?minW+'–'+maxW:'FIXED AT '+item.w)+
      ' CELLS · HEIGHT '+(heightEnabled?minH+'–'+maxH:'FIXED AT '+item.h)+
      ' CELLS. A provider may prohibit smaller dimensions.'));
    const apply=(w,h)=>{
      const ok=this.mutate(model=>C.resizeSmart(model,item.id,w,h));
      if(ok===false)this.toast('CANNOT RESIZE: PROVIDER LIMIT OR NO FREE CELLS');
      this.renderSheet();
    };
    stepper(host,'WIDTH','Grid columns',item.w,
      widthEnabled?minW:item.w,widthEnabled?maxW:item.w,
      value=>apply(value,item.h));
    stepper(host,'HEIGHT','Grid rows',item.h,
      heightEnabled?minH:item.h,heightEnabled?maxH:item.h,
      value=>apply(item.w,value));
    host.append(E('div','picker-section-label','QUICK SIZES · WIDTH × HEIGHT'));
    const presetGrid=E('div','picker-grid');
    const presets=[[1,1],[1,2],[1,3],[1,4],[2,1],[2,2],[2,3],[2,4],
      [3,1],[3,2],[3,3],[3,4],[4,1],[4,2],[4,3],[4,4],[cols,rows]];
    const seen=new Set();
    for(const [w,h] of presets){
      if(seen.has(w+'x'+h)||w>cols||h>rows)continue;
      seen.add(w+'x'+h);
      if((widthEnabled?(w<minW||w>maxW):(w!==item.w))||
         (heightEnabled?(h<minH||h>maxH):(h!==item.h)))continue;
      const button=E('button',null,w+' × '+h);button.type='button';
      button.style.minHeight='42px';button.disabled=w===item.w&&h===item.h;
      button.onclick=()=>apply(w,h);
      presetGrid.append(button);
    }
    host.append(presetGrid);
    const editWidget=E('button','sheet-primary','◈ WIDGET APPEARANCE');
    editWidget.onclick=()=>this.openSheet('widget-config',{id:item.id});
    host.append(editWidget);
    if(item.type==='widget'||item.type==='stack'){
      const stack=E('button','option-button',item.type==='stack'?'EDIT WIDGET STACK':'＋ CREATE WIDGET STACK');
      stack.onclick=()=>this.openSheet(item.type==='stack'?'stack-edit':'stack-add',{id:item.id});
      host.append(stack);
    }
    return;
  }

  if(kind==='notes-edit'){
    help(host,'Your memo stays on this phone until you back it up or clear the launcher data.');
    const input=E('textarea','sheet-textarea');input.maxLength=500;input.value=this.model.notes;
    host.append(input);
    primary(host,'SAVE WORKSHOP NOTE',()=>{
      this.mutate(model=>{model.notes=input.value.slice(0,500);});
      this.closeSheet();this.toast('NOTE SAVED');
    });
    return;
  }

  if(kind==='tasks-edit'){
    help(host,'A simple on-device checklist. These tasks do not create Android notifications or alarms.');
    this.model.tasks.forEach((task,i)=>{
      const actions=E('div','stepper');
      const check=E('button',null,task.done?'✓':'□'),del=E('button',null,'×');
      check.onclick=()=>{this.mutate(model=>{model.tasks[i].done=!model.tasks[i].done;});this.renderSheet();};
      del.onclick=()=>{this.mutate(model=>{model.tasks.splice(i,1);});this.renderSheet();};
      actions.append(check,del);
      row(host,task.text,task.done?'COMPLETE':'TO DO',actions);
    });
    const field=E('input','picker-search');field.maxLength=140;field.placeholder='New task…';host.append(field);
    primary(host,'＋ ADD TASK',()=>{
      const value=field.value.trim();if(!value)return;
      this.mutate(model=>{model.tasks.push({text:value.slice(0,140),done:false});});this.renderSheet();
    });
    return;
  }

  if(kind==='backup'){
    help(host,'Export your layout before reinstalling debug builds. The backup includes pages, dock, folders, theme, tasks and notes. Your installed apps must still be present for their shortcuts to launch.');
    primary(host,'EXPORT JSON BACKUP FILE',()=>this.exportBackup());
    primary(host,'IMPORT JSON BACKUP FILE',()=>this.importBackup());
    host.append(E('div','picker-section-label','MANUAL BACKUP / PASTE'));
    const input=E('textarea','sheet-textarea');input.value=JSON.stringify(this.model);input.style.minHeight='85px';host.append(input);
    primary(host,'COPY BACKUP TEXT',()=>{
      try{const native=this.native();if(native?.copyText)native.copyText(input.value);
      else if(navigator.clipboard?.writeText)navigator.clipboard.writeText(input.value);
      else this.toast('COPY UNAVAILABLE ON THIS BROWSER');this.toast('BACKUP COPIED');}catch(e){this.toast('COPY FAILED');}
    });
    primary(host,'RESTORE PASTED JSON',()=>this.backupImported(input.value));
    return;
  }

  if(kind==='reset'){
    help(host,'Reset the launcher desktop to its original MEK-AI design. You can keep your checklist and notes.');
    const keep=E('input');keep.type='checkbox';keep.checked=true;
    row(host,'KEEP TASKS & NOTES','Preserve your on-device personal content',keep);
    primary(host,'RESET HOME, DOCK & SETTINGS',()=>{
      const old=this.model;const fresh=C.defaultState();
      if(keep.checked){fresh.tasks=old.tasks;fresh.notes=old.notes;}
      this.mutate(model=>{Object.keys(model).forEach(k=>delete model[k]);Object.assign(model,fresh);});
      this.closeSheet();this.setView('home');this.toast('ORIGINAL LAYOUT RESTORED');
    },true);
    return;
  }

  if(kind==='folder-color'){
    const folder=this.findFolder(this.activeFolder);
    if(!folder){this.closeSheet();return;}
    help(host,'Choose a background for this folder without changing its apps.');
    for(const color of ['olive','amber','rust','charcoal']){
      opt(host,color.toUpperCase(),null,()=>{
        this.mutate(()=>{folder.color=color;});this.renderSheet();
      },folder.color===color);
    }
    return;
  }

  if(kind==='folder-create'){
    help(host,'Create an empty folder. Open it to add installed applications.');
    const name=E('input','picker-search');name.value='New Folder';name.maxLength=35;host.append(name);
    opt(host,'PLACE ON HOME',null,()=>{
      const folder={id:C.uid('folder'),type:'folder',name:name.value.trim()||'Folder',apps:[],color:'olive',x:0,y:0,w:1,h:1};
      const added=this.mutate(model=>C.addHome(model,folder,model.current));
      this.closeSheet();if(added)this.openFolder(added.id);
    });
    opt(host,'PLACE IN APP DRAWER',null,()=>{
      const folder=C.cleanItem({id:C.uid('folder'),type:'folder',name:name.value.trim()||'Folder',apps:[]},1,1,true);
      this.mutate(model=>{model.drawerFolders.push(folder);});
      this.closeSheet();this.openFolder(folder.id);
    });
    return;
  }

  if(kind==='app-actions'){this.renderAppActions(host,opts);return;}
  if(kind==='folder-app-actions'){this.renderFolderAppActions(host,opts);return;}
};
const WIDGET_DEFAULTS={mek:[4,2],clock:[2,2],battery:[2,1],tasks:[4,2],notes:[4,2],weather:[2,1],music:[4,1],house:[4,1],calendar:[2,1]};
M.addWidget=function(kind){
  if(!C.WIDGETS.has(kind))return;
  const pair=WIDGET_DEFAULTS[kind]||[2,1];
  const item={id:C.uid('widget'),type:'widget',kind,x:0,y:0,
    w:Math.min(pair[0],this.model.settings.homeCols),h:Math.min(pair[1],this.model.settings.homeRows)};
  const result=this.mutate(model=>C.addHome(model,item,model.current));
  this.closeSheet();
  if(result){this.goPage(this.model.current);this.enterEdit();this.toast('WIDGET ADDED TO HOME');}
  else this.toast('NO ROOM FOR WIDGET');
};
M.pickApp=function(item){
  const context=this.picking||{type:'home'};
  if(item.type==='folder'){this.toast('SELECT AN APPLICATION');return;}
  let result;
  if(context.type==='dock'){
    const choice={...item,id:C.uid('favorite')};
    result=this.mutate(model=>C.addDock(model,choice,context.slot));
    if(result!==false)this.toast('ADDED TO DOCK');
  }else if(context.type==='folder'){
    const f=this.findFolder(context.folderId);
    if(f&&item.type==='app'){
      if(f.apps.some(a=>a.pkg===item.pkg)){this.toast('ALREADY IN FOLDER');return;}
      this.mutate(model=>{f.apps.push({pkg:item.pkg,label:item.label});});
      this.toast('ADDED TO FOLDER');
      result=true;
    }
  }else if(context.type==='drawer-folder'){
    if(item.type!=='app'){this.toast('CHOOSE AN INSTALLED APP');return;}
    const folder=this.findFolder(context.folderId);
    if(folder&&!folder.apps.some(a=>a.pkg===item.pkg)){
      this.mutate(model=>{folder.apps.push({pkg:item.pkg,label:item.label});});
      result=true;
    }
  }else{
    const choice={...item,id:C.uid('home-icon'),x:0,y:0,w:1,h:1};
    result=this.mutate(model=>C.addHome(model,choice,model.current));
    if(result){this.goPage(this.model.current);this.toast((item.label||'APP')+' ADDED TO HOME');}
  }
  this.picking=null;
  this.closeSheet();
  if(this.activeFolder)this.renderFolder();
  if(context.type==='home')this.enterEdit();
  if(result===false||result===null||result===undefined)this.toast('COULD NOT ADD APPLICATION');
};
M.addToHomeFromDrawer=function(item){
  const choice={...item,id:C.uid('app'),x:0,y:0,w:1,h:1};
  const added=this.mutate(model=>C.addHome(model,choice,model.current));
  if(added){this.setView('home');this.goPage(this.model.current);this.enterEdit();this.toast('ADDED TO HOME');}
  else this.toast('UNABLE TO ADD APP');
};
M.renderAppActions=function(host,opts){
  const item=opts.item;if(!item)return;
  help(host,'APP LIBRARY / '+(item.label||item.name||'APPLICATION'));
  if(item.type==='app'){
    opt(host,'☑ SELECT MULTIPLE APPS','Choose several apps before making a folder or adding them to Home.',()=>{
      this.closeSheet();this.enableLibrarySelection(item.pkg);
    });
  }
  opt(host,'OPEN '+(item.type==='folder'?'FOLDER':'APPLICATION'),null,()=>{
    this.closeSheet();this.openItem(item);
  });
  opt(host,'＋ ADD TO HOME','Pin this shortcut without removing it from your library.',()=>{
    this.closeSheet();this.addToHomeFromDrawer(item);
  });
  opt(host,'↓ ADD TO THE DOCK',null,()=>{
    const slot=this.model.dock.findIndex(x=>x===null);
    if(slot<0){
      this.toast('DOCK FULL · CHANGE A SLOT IN SETTINGS');
      this.openSheet('dock');return;
    }
    const entry={...item,id:C.uid('favorite')};
    const added=this.mutate(model=>C.addDock(model,entry,slot));
    this.closeSheet();
    if(added)this.toast('ADDED TO FAVORITES');
    else this.toast('COULD NOT ADD TO DOCK');
  });
  if(item.type==='app'){
    opt(host,'＋ NEW FOLDER WITH THIS APP','Create a folder inside your app library.',()=>{
      const folder=C.cleanItem({id:C.uid('drawer-folder'),type:'folder',
        name:'New Folder',color:'olive',apps:[{pkg:item.pkg,label:item.label}]},1,1,true);
      this.mutate(model=>{model.drawerFolders.push(folder);});
      this.closeSheet();this.openFolder(folder.id);
    });
    if(this.model.drawerFolders.length){
      opt(host,'＋ ADD TO AN EXISTING FOLDER',null,()=>{
        this.closeSheet();this.enableLibrarySelection(item.pkg);
        this.openSheet('library-target');
      });
    }
    if(this.model.settings.appSort==='custom'){
      opt(host,'MOVE TO FIRST APP PAGE',null,()=>{
        const key=item.pkg;
        this.mutate(model=>{
          model.drawerOrder=model.drawerOrder.filter(k=>k!==key);
          model.drawerOrder.unshift(key);
        });this.closeSheet();this.renderDrawer();this.toast('APP MOVED TO FRONT');
      });
    }
    opt(host,'⚙ APP SETTINGS / INFO','Android permissions, notifications, storage and uninstall settings.',()=>{
      this.closeSheet();try{this.native()?.showAppInfo(item.pkg);}
      catch(e){this.toast('APP INFO UNAVAILABLE');}
    });
  }
  if(item.type==='folder'){
    opt(host,'✎ RENAME / ORGANIZE FOLDER',null,()=>{
      this.closeSheet();this.openFolder(item.id);
    });
    opt(host,'＋ ADD MORE APPS TO FOLDER',null,()=>{
      this.closeSheet();this.openFolder(item.id);
      this.picking={type:'folder',folderId:item.id};
      this.openSheet('apps-picker');
    });
    opt(host,'× DISSOLVE FOLDER','Apps return to the normal app-library pages.',()=>{
      this.mutate(model=>C.removeLocation(model,item.id));
      this.closeSheet();this.toast('FOLDER REMOVED · APPS ARE SAFE');
    });
  }
};
M.renderFolderAppActions=function(host,opts){
  const app=opts.app,folder=this.findFolder(this.activeFolder);
  if(!app||!folder)return;
  help(host,'FOLDER / '+(app.label||'APPLICATION'));
  opt(host,'OPEN APP',null,()=>{this.closeSheet();this.launchApp(app.pkg);});
  opt(host,'MOVE APP TO HOME',null,()=>{
    const added=this.mutate(model=>C.addHome(model,{id:C.uid('app'),type:'app',pkg:app.pkg,label:app.label,x:0,y:0,w:1,h:1},model.current));
    if(added){
      this.mutate(model=>{folder.apps=folder.apps.filter(a=>a.pkg!==app.pkg);});
      this.closeSheet();this.closeFolder();this.setView('home');this.enterEdit();this.toast('MOVED OUT OF FOLDER');
    }else this.toast('NO SPACE ON HOME');
  });
  opt(host,'REMOVE FROM FOLDER',null,()=>{
    this.mutate(model=>{folder.apps=folder.apps.filter(a=>a.pkg!==app.pkg);});
    this.closeSheet();this.renderFolder();this.toast('REMOVED FROM FOLDER');
  });
};
})();
