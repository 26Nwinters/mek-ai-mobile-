const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function read(relative){return fs.readFileSync(path.join(root,relative),'utf8');}
const java=read('app/src/main/java/com/mekai/mobile/MainActivity.java');
const gradle=read('app/build.gradle.kts');
const pkg=JSON.parse(read('package.json'));

test('Android widget host cleans removed views and releases unreferenced IDs',()=>{
  assert.match(java,/void releaseWidgetId\(int id\)/);
  assert.match(java,/widgetViews\.remove\(id\)/);
  assert.match(java,/stage\.removeView\(view\)/);
  assert.match(java,/widgetHost\.deleteAppWidgetId\(id\)/);
  assert.match(java,/getAppWidgetIds\(\)/);
  assert.match(java,/void reconcileWidgetInventory\(String json\)/);
  assert.match(java,/widgetLayoutIds\.contains\(id\)/);
  assert.match(java,/WIDGET_UNDO_GRACE_MS/);
});
test('widget picker has provider binding consent fallback and cancellation cleanup',()=>{
  assert.match(java,/bindAppWidgetIdIfAllowed/);
  assert.match(java,/ACTION_APPWIDGET_BIND/);
  assert.match(java,/REQUEST_BIND_WIDGET/);
  assert.match(java,/REQUEST_CONFIG_WIDGET/);
  assert.match(java,/startAppWidgetConfigureActivityForResult/);
  assert.match(java,/cancelPendingWidget\(\)/);
  assert.match(java,/getPreferences\(MODE_PRIVATE\).*pendingWidgetId/);
});
test('WebView restricts host filesystem and network while preserving older layout storage origin',()=>{
  assert.match(java,/setAllowFileAccess\(false\)/);
  assert.match(java,/setAllowContentAccess\(false\)/);
  assert.match(java,/setAllowFileAccessFromFileURLs\(false\)/);
  assert.match(java,/setAllowUniversalAccessFromFileURLs\(false\)/);
  assert.match(java,/MIXED_CONTENT_NEVER_ALLOW/);
  assert.match(java,/file:\/\/\/android_asset\/index\.html/);
  assert.doesNotMatch(java,/setAllowFileAccess\(true\)/);
});
test('Android build targets API 36 and versions match in build files',()=>{
  assert.match(gradle,/compileSdk\s*=\s*36/);
  assert.match(gradle,/targetSdk\s*=\s*36/);
  assert.ok(gradle.includes('versionName = "'+pkg.version+'"'));
  assert.ok(read('.github/workflows/android.yml').includes('MEK-AI-Mobile-v'+pkg.version));
});
test('approved artwork is directly bundled in this repository and independent of outside sites',()=>{
  for(const name of ['mek.webp','workshop.webp']){
    const bytes=fs.readFileSync(path.join(root,'app/src/main/assets',name));
    assert.ok(bytes.byteLength>10000);
    assert.equal(bytes.subarray(0,4).toString(),'RIFF');
    assert.equal(bytes.subarray(8,12).toString(),'WEBP');
  }
  const prep=read('tools/prepare_art.py');
  assert.doesNotMatch(prep,/urllib|urlopen|raw\.githubusercontent|requests\.get/);
});

test('native host sends modern Android 12+ widget size option updates',()=>{
  assert.match(java,/updateAppWidgetSize\(new Bundle\(\),Arrays\.asList/);
  assert.match(java,/new SizeF\(/);
  assert.match(java,/requestWidgetCatalog\(/);
  assert.match(java,/requestWidgetPreview\(/);
  assert.match(java,/getInstalledProviders\(\)/);
  assert.match(java,/selectWidgetProvider/);
});

test('v0.6.1 hides Android host views above WebView dialogs and edit mode',()=>{
  assert.match(java,/void setNativeWidgetLayerActive\(boolean allowed\)/);
  assert.match(java,/if \(!nativeWidgetsUiAllowed\)/);
  assert.match(java,/setWidgetLayerActive\(boolean allowed\)/);
  assert.match(java,/view\.setVisibility\(View\.GONE\)/);
  assert.match(java,/hostView\.setBackgroundColor\(android\.graphics\.Color\.TRANSPARENT\)/);
  const js=read('app/src/main/assets/launcher-v5.js');
  assert.match(js,/canShowNativeWidgets\(\)/);
  assert.match(js,/setWidgetLayerActive\(allowed\)/);
  const ui=read('app/src/main/assets/launcher-v5-ui.js');
  assert.match(ui,/this\.updateNativeWidgetLayer\(false\)/);
});

test('resizable Android and built-in widgets have three independent handles',()=>{
  const ui=read('app/src/main/assets/launcher-v5-ui.js');
  for(const handle of ['cell-resize','cell-resize-width','cell-resize-height'])
    assert.ok(ui.includes(handle));
  const css=read('app/src/main/assets/launcher-v5.css');
  assert.match(css,/\[data-type="android-widget"\] \.cell-resize/);
  assert.match(css,/native-widget-placeholder\[data-frame="transparent"\]/);
  const core=read('app/src/main/assets/launcher-core.js');
  assert.match(core,/out\.frameStyle/);
  assert.match(core,/\['widget','android-widget','stack'\]\.includes\(item\.type\)\)\?clamp\(item\.h/);
});
