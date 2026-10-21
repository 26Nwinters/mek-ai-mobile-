package com.mekai.mobile;

import android.app.Activity;
import android.content.ComponentName;
import android.os.UserHandle;
import android.graphics.Insets;
import android.view.WindowInsets;
import android.window.OnBackInvokedDispatcher;
import android.window.OnBackInvokedCallback;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebResourceResponse;
import java.io.ByteArrayInputStream;
import java.util.Map;
import android.appwidget.AppWidgetHost;
import android.appwidget.AppWidgetHostView;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.widget.FrameLayout;
import android.view.View;
import android.content.Context;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.BroadcastReceiver;
import android.content.ContentResolver;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.HashSet;
import org.json.JSONException;
import android.app.role.RoleManager;
import android.os.Bundle;
import android.util.SizeF;
import java.util.Arrays;
import android.os.BatteryManager;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.content.pm.ApplicationInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.provider.MediaStore;
import android.provider.Settings;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebChromeClient;
import android.util.Base64;
import android.util.Log;
import java.util.List;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.io.ByteArrayOutputStream;
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private WebView web;
    private FrameLayout stage;
    private AppWidgetHost widgetHost;
    private final HashMap<Integer,AppWidgetHostView> widgetViews = new HashMap<>();
    private final HashMap<Integer,String> lastWidgetSizes=new HashMap<>();
    private static final int REQUEST_EXPORT=930;
    private static final int REQUEST_IMPORT=931;
    private static final int REQUEST_PICK_WIDGET=932;
    private static final int REQUEST_CONFIG_WIDGET=933;
    private static final int REQUEST_BIND_WIDGET=934;
    private int pendingWidgetId=-1;
    private final Handler widgetCleanupHandler = new Handler(Looper.getMainLooper());
    private final HashMap<Integer,Runnable> widgetCleanupTasks = new HashMap<>();
    private final HashSet<Integer> widgetLayoutIds = new HashSet<>();
    private static final long WIDGET_UNDO_GRACE_MS = 20_000L;
    private boolean widgetInventoryReceived=false;
    private String pendingExport;
    private BroadcastReceiver packageReceiver;
    private boolean receiverRegistered=false;

    private final java.util.concurrent.ExecutorService appExecutor =
        java.util.concurrent.Executors.newSingleThreadExecutor();
    private final android.util.LruCache<String,String> iconCache =
        new android.util.LruCache<>(260);
    private static final String TAG = "MEKMobile";
    private static final String HOME = "file:///android_asset/index.html";

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(android.graphics.Color.rgb(8, 12, 10));
        getWindow().setNavigationBarColor(android.graphics.Color.rgb(8, 12, 10));
        getWindow().getDecorView().setSystemUiVisibility(0);
        web = new WebView(this);
        web.setBackgroundColor(android.graphics.Color.rgb(8, 12, 10));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.addJavascriptInterface(new PhoneBridge(), "MEK");
        web.setWebChromeClient(new WebChromeClient());
        // Keep the existing localStorage origin during this security update.
        // Disabling file access does NOT block packaged android_asset content,
        // and no remote page may access the JavaScript bridge.
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                String url=req.getUrl().toString();
                if (url.startsWith("file:///android_asset/")) return null;
                return new WebResourceResponse("text/plain","UTF-8",
                    new ByteArrayInputStream(new byte[0]));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return !HOME.equals(req.getUrl().toString());
            }
        });
        stage = new FrameLayout(this);
        stage.addView(web, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(stage);
        if (Build.VERSION.SDK_INT >= 35) {
            // Target API 36 mandates edge-to-edge on modern Android.
            getWindow().setDecorFitsSystemWindows(false);
            stage.setOnApplyWindowInsetsListener((view,insets)->{
                Insets safe=insets.getInsets(
                    WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());
                stage.setPadding(safe.left,safe.top,safe.right,safe.bottom);
                return insets;
            });
        }
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                ()->{
                    if(web!=null)web.evaluateJavascript(
                        "window.goBackInLauncher && window.goBackInLauncher()",null);
                }
            );
        }
        widgetHost = new AppWidgetHost(this, 4721);
        pendingWidgetId=state==null?-1:state.getInt("mekPendingWidgetId",-1);
        int staleId=getPreferences(MODE_PRIVATE).getInt("pendingWidgetId",-1);
        if(staleId>0 && staleId!=pendingWidgetId){
            releaseWidgetId(staleId);
            getPreferences(MODE_PRIVATE).edit().remove("pendingWidgetId").apply();
        }
        try { widgetHost.startListening(); }
        catch (Exception e) { Log.w(TAG,"Widget host start failed",e); }
        registerAppChanges();
        web.loadUrl(HOME);
    }

    @Override protected void onSaveInstanceState(Bundle outState) {
        outState.putInt("mekPendingWidgetId",pendingWidgetId);
        super.onSaveInstanceState(outState);
    }

    @Override protected void onDestroy() {
        if (receiverRegistered) {
            try { unregisterReceiver(packageReceiver); } catch(Exception ignored){}
        }
        if (widgetHost != null) try { widgetHost.stopListening(); } catch(Exception ignored){}
        for (Runnable task : widgetCleanupTasks.values()) widgetCleanupHandler.removeCallbacks(task);
        widgetCleanupTasks.clear();
        for (AppWidgetHostView view : widgetViews.values()) {
            if (stage != null) stage.removeView(view);
        }
        widgetViews.clear();lastWidgetSizes.clear();
        appExecutor.shutdownNow();
        if (web != null) {
            web.removeJavascriptInterface("MEK");
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    @Override protected void onResume() {
        super.onResume();
        if (web != null) web.evaluateJavascript("window.refreshNative && window.refreshNative()", null);
    }

    @Override public void onBackPressed() {
        if (web != null) web.evaluateJavascript("window.goBackInLauncher && window.goBackInLauncher()", null);
        else super.onBackPressed();
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent != null && Intent.ACTION_MAIN.equals(intent.getAction()) &&
                intent.hasCategory(Intent.CATEGORY_HOME) && web != null) {
            web.evaluateJavascript("window.mekNativeHome && window.mekNativeHome()",null);
        }
    }

    private void registerAppChanges() {
        packageReceiver = new BroadcastReceiver() {
            @Override public void onReceive(Context context, Intent intent) {
                synchronized(iconCache){iconCache.evictAll();}
                if (web != null) {
                    web.evaluateJavascript("window.mekAppsChanged && window.mekAppsChanged()",null);
                }
            }
        };
        IntentFilter filter = new IntentFilter();
        filter.addAction(Intent.ACTION_PACKAGE_ADDED);
        filter.addAction(Intent.ACTION_PACKAGE_REMOVED);
        filter.addAction(Intent.ACTION_PACKAGE_CHANGED);
        filter.addDataScheme("package");
        try {
            if (Build.VERSION.SDK_INT >= 33)
                registerReceiver(packageReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            else registerReceiver(packageReceiver, filter);
            receiverRegistered=true;
        }
        catch(Exception e){Log.w(TAG,"Package change broadcast unavailable",e);}
    }

    private void callback(String statement) {
        if(web!=null)web.evaluateJavascript(statement,null);
    }

    private void safeStart(Intent intent) {
        try { startActivity(intent); }
        catch (Exception e) { Log.w(TAG, "Could not open activity", e); }
    }

    private boolean isSelectedHome() {
        try {
            RoleManager manager = (RoleManager) getSystemService(ROLE_SERVICE);
            if (manager != null && manager.isRoleAvailable(RoleManager.ROLE_HOME))
                return manager.isRoleHeld(RoleManager.ROLE_HOME);
            Intent query = new Intent(Intent.ACTION_MAIN);
            query.addCategory(Intent.CATEGORY_HOME);
            ResolveInfo resolved = getPackageManager().resolveActivity(query, PackageManager.MATCH_DEFAULT_ONLY);
            return resolved != null && resolved.activityInfo != null &&
                    getPackageName().equals(resolved.activityInfo.packageName);
        } catch (Exception e) {
            Log.w(TAG, "Could not check default Home app", e);
            return false;
        }
    }

    private void requestHome() {
        try {
            RoleManager manager = (RoleManager) getSystemService(ROLE_SERVICE);
            if (manager != null && manager.isRoleAvailable(RoleManager.ROLE_HOME)
                    && !manager.isRoleHeld(RoleManager.ROLE_HOME)) {
                startActivityForResult(manager.createRequestRoleIntent(RoleManager.ROLE_HOME), 700);
            } else if (!isSelectedHome()) {
                safeStart(new Intent(Settings.ACTION_HOME_SETTINGS));
            }
        } catch (Exception e) {
            safeStart(new Intent(Settings.ACTION_HOME_SETTINGS));
        }
    }

    private void releaseWidgetId(int id) {
        if(id<=0 || widgetHost==null) return;
        Runnable task=widgetCleanupTasks.remove(id);
        if(task!=null)widgetCleanupHandler.removeCallbacks(task);
        lastWidgetSizes.remove(id);
        AppWidgetHostView view=widgetViews.remove(id);
        if(view!=null && stage!=null)stage.removeView(view);
        widgetLayoutIds.remove(id);
        try {widgetHost.deleteAppWidgetId(id);}
        catch(Exception e){Log.w(TAG,"Could not release widget id "+id,e);}
    }

    /* Inventory reflects ALL Home pages, not just currently visible widgets.
       Missing IDs receive an undo grace period. The same cleanup happens
       after an app restart if a widget was removed while the process died. */
    private void reconcileWidgetInventory(String json) {
        if(widgetHost==null || json==null || json.length()>12000)return;
        final HashSet<Integer> retained=new HashSet<>();
        try {
            JSONArray arr=new JSONArray(json);
            if(arr.length()>256)return;
            for(int i=0;i<arr.length();i++){
                int id=arr.optInt(i,-1);
                if(id>0)retained.add(id);
            }
        }catch(Exception e){Log.w(TAG,"Invalid widget inventory",e);return;}
        widgetInventoryReceived=true;
        widgetLayoutIds.clear();
        widgetLayoutIds.addAll(retained);
        for(Integer id:retained){
            Runnable task=widgetCleanupTasks.remove(id);
            if(task!=null)widgetCleanupHandler.removeCallbacks(task);
        }
        HashSet<Integer> known=new HashSet<>(widgetViews.keySet());
        for(int id:widgetHost.getAppWidgetIds())known.add(id);
        for(Integer id:known){
            if(id==pendingWidgetId || retained.contains(id) || widgetCleanupTasks.containsKey(id))
                continue;
            Runnable pending=new Runnable() {
                @Override public void run() {
                    widgetCleanupTasks.remove(id);
                    if(widgetInventoryReceived && !widgetLayoutIds.contains(id) &&
                       pendingWidgetId!=id)releaseWidgetId(id);
                }
            };
            widgetCleanupTasks.put(id,pending);
            widgetCleanupHandler.postDelayed(pending,WIDGET_UNDO_GRACE_MS);
        }
    }

    private void cancelPendingWidget(){
        int orphan=pendingWidgetId;
        pendingWidgetId=-1;
        getPreferences(MODE_PRIVATE).edit().remove("pendingWidgetId").apply();
        if(orphan>0)releaseWidgetId(orphan);
        notifyWidgetError();
    }

    private void configureOrFinishWidget(int widgetId){
        AppWidgetProviderInfo info=AppWidgetManager.getInstance(this).getAppWidgetInfo(widgetId);
        if(info==null){cancelPendingWidget();return;}
        if(info.configure!=null){
            try {
                // Provider configuration is part of the AppWidgetHost contract.
                widgetHost.startAppWidgetConfigureActivityForResult(
                    this,widgetId,0,REQUEST_CONFIG_WIDGET,null);
                return;
            }catch(Exception e){
                Log.w(TAG,"Widget configuration unavailable",e);
                // Do not pretend the widget is functional without its setup.
                cancelPendingWidget();return;
            }
        }
        finishWidgetPicker(widgetId);
    }

    private void bindChosenWidget(int widgetId,Intent data){
        try {
            AppWidgetManager manager=AppWidgetManager.getInstance(this);
            if(manager.getAppWidgetInfo(widgetId)!=null){
                configureOrFinishWidget(widgetId);return;
            }
            ComponentName provider=data==null?null:
                data.getParcelableExtra(AppWidgetManager.EXTRA_APPWIDGET_PROVIDER);
            UserHandle profile=data==null?null:
                data.getParcelableExtra(AppWidgetManager.EXTRA_APPWIDGET_PROVIDER_PROFILE);
            if(provider==null)throw new IllegalStateException("Picker did not return a provider");
            boolean allowed=profile!=null ?
                manager.bindAppWidgetIdIfAllowed(widgetId,profile,provider,null) :
                manager.bindAppWidgetIdIfAllowed(widgetId,provider);
            if(allowed){configureOrFinishWidget(widgetId);return;}
            Intent bind=new Intent(AppWidgetManager.ACTION_APPWIDGET_BIND);
            bind.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,widgetId);
            bind.putExtra(AppWidgetManager.EXTRA_APPWIDGET_PROVIDER,provider);
            if(profile!=null)bind.putExtra(AppWidgetManager.EXTRA_APPWIDGET_PROVIDER_PROFILE,profile);
            startActivityForResult(bind,REQUEST_BIND_WIDGET);
        }catch(Exception e){
            Log.w(TAG,"Widget bind permission unavailable",e);
            cancelPendingWidget();
        }
    }

    private JSONObject widgetInfoJson(AppWidgetProviderInfo info) throws Exception {
        float density=getResources().getDisplayMetrics().density;
        JSONObject obj=new JSONObject();
        obj.put("provider",info.provider.flattenToString());
        obj.put("package",info.provider.getPackageName());
        obj.put("name",String.valueOf(info.loadLabel(getPackageManager())));
        obj.put("minWidth",Math.max(1,Math.round(info.minWidth/density)));
        obj.put("minHeight",Math.max(1,Math.round(info.minHeight/density)));
        obj.put("minResizeWidth",Math.max(1,Math.round(
            (info.minResizeWidth>0?info.minResizeWidth:info.minWidth)/density)));
        obj.put("minResizeHeight",Math.max(1,Math.round(
            (info.minResizeHeight>0?info.minResizeHeight:info.minHeight)/density)));
        obj.put("maxResizeWidth",info.maxResizeWidth>0?Math.round(info.maxResizeWidth/density):0);
        obj.put("maxResizeHeight",info.maxResizeHeight>0?Math.round(info.maxResizeHeight/density):0);
        obj.put("resizeMode",info.resizeMode);
        obj.put("configure",info.configure!=null);
        return obj;
    }

    private void requestWidgetCatalog(){
        appExecutor.execute(()->{
            JSONArray catalog=new JSONArray();
            try{
                List<AppWidgetProviderInfo> providers=AppWidgetManager.getInstance(this).getInstalledProviders();
                Collections.sort(providers,(a,b)->
                    String.valueOf(a.loadLabel(getPackageManager())).compareToIgnoreCase(
                    String.valueOf(b.loadLabel(getPackageManager()))));
                for(AppWidgetProviderInfo provider:providers){
                    try{catalog.put(widgetInfoJson(provider));}catch(Exception ignored){}
                }
            }catch(Exception e){Log.w(TAG,"Widget provider discovery failed",e);}
            final String json=catalog.toString();
            runOnUiThread(()->callback("window.mekNativeWidgetCatalog && window.mekNativeWidgetCatalog("+
                JSONObject.quote(json)+")"));
        });
    }

    private void requestWidgetPreview(String flattened){
        if(flattened==null||flattened.length()>240)return;
        appExecutor.execute(()->{
            ComponentName component=ComponentName.unflattenFromString(flattened);
            if(component==null)return;
            String image="";
            try{
                List<AppWidgetProviderInfo> providers=AppWidgetManager.getInstance(this)
                    .getInstalledProvidersForPackage(component.getPackageName(),null);
                for(AppWidgetProviderInfo info:providers)if(component.equals(info.provider)){
                    Drawable preview=info.loadPreviewImage(this,getResources().getDisplayMetrics().densityDpi);
                    if(preview!=null)image=iconData(preview);
                    break;
                }
            }catch(Exception e){Log.w(TAG,"Widget preview unavailable",e);}
            String encoded=image;
            runOnUiThread(()->callback("window.mekNativeWidgetPreview && window.mekNativeWidgetPreview("+
                JSONObject.quote(flattened)+","+JSONObject.quote(encoded)+")"));
        });
    }

    private void chooseWidgetProvider(String flattened){
        if(widgetHost==null||pendingWidgetId>0)return;
        ComponentName provider=ComponentName.unflattenFromString(flattened);
        if(provider==null)return;
        try{
            pendingWidgetId=widgetHost.allocateAppWidgetId();
            getPreferences(MODE_PRIVATE).edit().putInt("pendingWidgetId",pendingWidgetId).apply();
            Intent data=new Intent();
            data.putExtra(AppWidgetManager.EXTRA_APPWIDGET_PROVIDER,provider);
            bindChosenWidget(pendingWidgetId,data);
        }catch(Exception e){Log.w(TAG,"Widget provider could not be selected",e);cancelPendingWidget();}
    }

    private void startWidgetPicker() {
        if(widgetHost==null)return;
        try {
            pendingWidgetId=widgetHost.allocateAppWidgetId();
            getPreferences(MODE_PRIVATE).edit().putInt("pendingWidgetId",pendingWidgetId).apply();
            Intent pick=new Intent(AppWidgetManager.ACTION_APPWIDGET_PICK);
            pick.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,pendingWidgetId);
            startActivityForResult(pick,REQUEST_PICK_WIDGET);
        } catch(Exception e) {
            Log.w(TAG,"Cannot open Android widget picker",e);
            cancelPendingWidget();
        }
    }

    private void notifyWidgetError(){
        callback("window.mekNativeWidgetError && window.mekNativeWidgetError()");
    }

    private void finishWidgetPicker(int widgetId){
        try {
            AppWidgetProviderInfo info=AppWidgetManager.getInstance(this).getAppWidgetInfo(widgetId);
            if(info==null)throw new IllegalStateException("Widget provider not bound");
            String label=String.valueOf(info.loadLabel(getPackageManager()));
            JSONObject metadata=widgetInfoJson(info);
            callback("window.mekNativeWidgetChosen && window.mekNativeWidgetChosen("+
                widgetId+","+JSONObject.quote(label)+","+
                metadata.optInt("minWidth",80)+","+metadata.optInt("minHeight",80)+","+
                JSONObject.quote(metadata.toString())+")");
        } catch(Exception e){
            Log.w(TAG,"Unable to register chosen widget",e);
            try{widgetHost.deleteAppWidgetId(widgetId);}catch(Exception ignored){}
            notifyWidgetError();
        }finally{
            pendingWidgetId=-1;
            getPreferences(MODE_PRIVATE).edit().remove("pendingWidgetId").apply();
        }
    }

    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){
        super.onActivityResult(requestCode,resultCode,data);
        if(requestCode==REQUEST_EXPORT){
            try {
                if(resultCode!=RESULT_OK||data==null||data.getData()==null||pendingExport==null)
                    throw new IllegalStateException("Backup export cancelled");
                try(OutputStream out=getContentResolver().openOutputStream(data.getData())){
                    if(out==null)throw new IllegalStateException("Cannot open document output");
                    byte[] bytes=pendingExport.getBytes(StandardCharsets.UTF_8);
                    if(bytes.length>1500000)throw new IllegalArgumentException("Backup too large");
                    out.write(bytes);
                }
                callback("window.mekBackupResult && window.mekBackupResult('saved')");
            }catch(Exception e){
                Log.w(TAG,"Backup save failed or cancelled",e);
                callback("window.mekBackupResult && window.mekBackupResult('failed')");
            }finally{pendingExport=null;}
            return;
        }
        if(requestCode==REQUEST_IMPORT){
            try{
                if(resultCode!=RESULT_OK||data==null||data.getData()==null)
                    throw new IllegalStateException("No backup selected");
                ByteArrayOutputStream out=new ByteArrayOutputStream();
                try(InputStream input=getContentResolver().openInputStream(data.getData())){
                    if(input==null)throw new IllegalStateException("Cannot open document input");
                    byte[] buf=new byte[8192];int count;
                    while((count=input.read(buf))!=-1){
                        if(out.size()+count>1500000)throw new IllegalArgumentException("Backup too large");
                        out.write(buf,0,count);
                    }
                }
                String json=out.toString(StandardCharsets.UTF_8.name());
                callback("window.mekBackupImported && window.mekBackupImported("+JSONObject.quote(json)+")");
            }catch(Exception e){
                Log.w(TAG,"Backup import failed",e);
                callback("window.mekBackupResult && window.mekBackupResult('failed')");
            }
            return;
        }
        if(requestCode==REQUEST_PICK_WIDGET || requestCode==REQUEST_CONFIG_WIDGET
                || requestCode==REQUEST_BIND_WIDGET){
            final int id=pendingWidgetId;
            if(resultCode!=RESULT_OK || id<=0){
                cancelPendingWidget();return;
            }
            if(requestCode==REQUEST_PICK_WIDGET){
                bindChosenWidget(id,data);return;
            }
            if(requestCode==REQUEST_BIND_WIDGET){
                configureOrFinishWidget(id);return;
            }
            finishWidgetPicker(id);
        }
    }

    /* Native widget surfaces sit above the local WebView at CSS-pixel-derived
       coordinates. The UI hides them during editing, sheet dialogs and paging.
       This uses the real Android AppWidgetHost / RemoteViews system. */
    private void layoutNativeWidgets(String payload){
        if(stage==null||web==null||widgetHost==null)return;
        try{
            if(payload==null||payload.length()>90000)return;
            JSONObject input=new JSONObject(payload);
            double viewport=input.optDouble("viewportWidth",0);
            if(!Double.isFinite(viewport)||viewport<100)return;
            double scale=web.getWidth()/viewport;
            if(!Double.isFinite(scale)||scale<=0)return;
            JSONArray items=input.optJSONArray("widgets");
            HashSet<Integer> visible=new HashSet<>();
            if(items!=null){
                for(int i=0;i<Math.min(40,items.length());i++){
                    JSONObject item=items.optJSONObject(i);
                    if(item==null)continue;
                    int id=item.optInt("id",-1);
                    if(id<=0||!item.optBoolean("visible",false))continue;
                    double x=item.optDouble("x",-1),y=item.optDouble("y",-1),
                           w=item.optDouble("w",-1),h=item.optDouble("h",-1);
                    if(!Double.isFinite(x)||!Double.isFinite(y)||!Double.isFinite(w)||!Double.isFinite(h)
                        ||w<40||h<40||w>3000||h>3000)continue;
                    AppWidgetHostView hostView=widgetViews.get(id);
                    if(hostView==null){
                        AppWidgetProviderInfo info=AppWidgetManager.getInstance(this).getAppWidgetInfo(id);
                        if(info==null)continue;
                        try{
                            hostView=widgetHost.createView(this,id,info);
                            widgetViews.put(id,hostView);
                            stage.addView(hostView);
                        }catch(Exception e){
                            Log.w(TAG,"Could not create native widget view",e);continue;
                        }
                    }
                    visible.add(id);
                    FrameLayout.LayoutParams params=new FrameLayout.LayoutParams(
                        Math.max(1,(int)Math.round(w*scale)),
                        Math.max(1,(int)Math.round(h*scale)));
                    params.leftMargin=(int)Math.round(x*scale);
                    params.topMargin=(int)Math.round(y*scale);
                    hostView.setLayoutParams(params);
                    hostView.setVisibility(View.VISIBLE);
                    float density=getResources().getDisplayMetrics().density;
                    float widthDp=(float)(w*scale/density);
                    float heightDp=(float)(h*scale/density);
                    String signature=((int)widthDp)+"x"+((int)heightDp);
                    if(!signature.equals(lastWidgetSizes.get(id))){
                        try{
                            hostView.updateAppWidgetSize(new Bundle(),Arrays.asList(
                                new SizeF(Math.max(1f,widthDp),Math.max(1f,heightDp))));
                            lastWidgetSizes.put(id,signature);
                        }catch(Exception e){Log.w(TAG,"Widget provider size update failed",e);}
                    }
                    hostView.bringToFront();
                }
            }
            for(java.util.Map.Entry<Integer,AppWidgetHostView> entry:widgetViews.entrySet()){
                if(!visible.contains(entry.getKey()))entry.getValue().setVisibility(View.GONE);
            }
        }catch(Exception e){Log.w(TAG,"Native widget layout ignored",e);}
    }

    public class PhoneBridge {
        @JavascriptInterface public boolean isDefaultHome() {
            return isSelectedHome();
        }

        @JavascriptInterface public void requestHomeRole() {
            runOnUiThread(() -> requestHome());
        }
        @JavascriptInterface public void showAppInfo(String pkg) {
            if(pkg==null||!pkg.matches("[a-zA-Z0-9_.]{3,180}"))return;
            runOnUiThread(()->safeStart(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:"+pkg))));
        }

        @JavascriptInterface public void copyText(String value) {
            if(value==null||value.length()>1500000)return;
            runOnUiThread(()->{
                ClipboardManager clip=(ClipboardManager)getSystemService(CLIPBOARD_SERVICE);
                if(clip!=null)clip.setPrimaryClip(ClipData.newPlainText("MEK-AI Backup",value));
            });
        }

        @JavascriptInterface public void exportLayout(String json) {
            if(json==null||json.length()>1500000)return;
            runOnUiThread(()->{
                try{
                    pendingExport=json;
                    Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("application/json");
                    intent.putExtra(Intent.EXTRA_TITLE,"mek-ai-layout-"+
                        new java.text.SimpleDateFormat("yyyy-MM-dd",java.util.Locale.US)
                        .format(new java.util.Date())+".json");
                    startActivityForResult(intent,REQUEST_EXPORT);
                }catch(Exception e){pendingExport=null;Log.w(TAG,"Backup export unavailable",e);}
            });
        }

        @JavascriptInterface public void importLayout() {
            runOnUiThread(()->{
                try{
                    Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("*/*");
                    startActivityForResult(intent,REQUEST_IMPORT);
                }catch(Exception e){Log.w(TAG,"Backup import unavailable",e);}
            });
        }

        @JavascriptInterface public void requestWidgetCatalog(){
            MainActivity.this.requestWidgetCatalog();
        }
        @JavascriptInterface public void requestWidgetPreview(String provider){
            MainActivity.this.requestWidgetPreview(provider);
        }
        @JavascriptInterface public void selectWidgetProvider(String provider){
            if(provider==null||provider.length()>240)return;
            runOnUiThread(()->chooseWidgetProvider(provider));
        }

        @JavascriptInterface public void pickAndroidWidget() {
            runOnUiThread(()->startWidgetPicker());
        }

        @JavascriptInterface public void syncWidgetInventory(String json) {
            if(json==null || json.length()>12000)return;
            runOnUiThread(()->reconcileWidgetInventory(json));
        }

        @JavascriptInterface public void syncWidgetRects(String json) {
            if(json==null||json.length()>90000)return;
            runOnUiThread(()->layoutNativeWidgets(json));
        }

        @JavascriptInterface public void requestNativeHome() {
            runOnUiThread(()->{
                if(web!=null)web.evaluateJavascript(
                    "window.mekNativeHome && window.mekNativeHome()",null);
            });
        }


        /* The app drawer must not block JavaScript while converting every icon.
           Only package names and labels travel in the first async callback. */
        @JavascriptInterface public void requestApps() {
            appExecutor.execute(() -> {
                String payload = getApps();
                runOnUiThread(() -> {
                    if (web != null) {
                        web.evaluateJavascript(
                            "window.mekAppsReady && window.mekAppsReady(" +
                            JSONObject.quote(payload) + ")", null
                        );
                    }
                });
            });
        }

        @JavascriptInterface public String getApps() {
            JSONArray result = new JSONArray();
            try {
                PackageManager pm = getPackageManager();
                Intent query = new Intent(Intent.ACTION_MAIN);
                query.addCategory(Intent.CATEGORY_LAUNCHER);
                List<ResolveInfo> infos = pm.queryIntentActivities(query, 0);
                Collections.sort(infos, Comparator.comparing(item ->
                    item.loadLabel(pm).toString().toLowerCase()));
                java.util.HashSet<String> seen = new java.util.HashSet<>();
                for (ResolveInfo info: infos) {
                    if (info.activityInfo == null) continue;
                    String pkg = info.activityInfo.packageName;
                    if (pkg.equals(getPackageName()) || !seen.add(pkg)) continue;
                    JSONObject item = new JSONObject();
                    item.put("name", info.loadLabel(pm).toString());
                    item.put("pkg", pkg);
                    result.put(item);
                }
            } catch (Exception e) { Log.w(TAG, "App listing failed", e); }
            return result.toString();
        }

        /* Icon decoding stays off the WebView bridge's synchronous call path.
           A single worker processes requests, then notifies JavaScript on the UI thread. */
        /* Batch small groups of installed app icons in one background task.
           This avoids a UI-thread bridge roundtrip for every icon and allows
           the app drawer to feel responsive with 100+ installed packages. */
        @JavascriptInterface public void requestAppIcons(String json) {
            if(json==null || json.length()>5000)return;
            final ArrayList<String> packages=new ArrayList<>();
            try {
                JSONArray requested=new JSONArray(json);
                HashSet<String> unique=new HashSet<>();
                for(int i=0;i<Math.min(16,requested.length());i++){
                    String pkg=requested.optString(i,"");
                    if(pkg.matches("[a-zA-Z0-9_.]{3,180}") && unique.add(pkg))
                        packages.add(pkg);
                }
            }catch(Exception e){return;}
            if(packages.isEmpty())return;
            appExecutor.execute(()->{
                JSONArray results=new JSONArray();
                for(String pkg:packages){
                    try {
                        JSONObject item=new JSONObject();
                        item.put("pkg",pkg);
                        item.put("icon",getAppIcon(pkg));
                        results.put(item);
                    }catch(Exception ignored){}
                }
                String payload=results.toString();
                runOnUiThread(()->{
                    if(web!=null){
                        web.evaluateJavascript(
                            "window.mekIconsReady && window.mekIconsReady("+
                            JSONObject.quote(payload)+")",null);
                    }
                });
            });
        }

        @JavascriptInterface public void requestAppIcon(String pkg) {
            if (pkg == null || !pkg.matches("[a-zA-Z0-9_.]{3,180}")) return;
            appExecutor.execute(() -> {
                String encoded = getAppIcon(pkg);
                runOnUiThread(() -> {
                    if (web != null) {
                        web.evaluateJavascript(
                            "window.mekIconReady && window.mekIconReady(" +
                            JSONObject.quote(pkg) + "," +
                            JSONObject.quote(encoded) + ")", null
                        );
                    }
                });
            });
        }

        @JavascriptInterface public String getAppIcon(String pkg) {
            if (pkg == null || !pkg.matches("[a-zA-Z0-9_.]{3,180}")) return "";
            synchronized (iconCache) {
                String cached = iconCache.get(pkg);
                if (cached != null) return cached;
            }
            try {
                Drawable drawable = getPackageManager().getApplicationIcon(pkg);
                String encoded = iconData(drawable);
                synchronized (iconCache) { iconCache.put(pkg, encoded); }
                return encoded;
            } catch (Exception e) {
                return "";
            }
        }

        private String iconData(Drawable drawable) {
            // Smaller WebP icons transfer ~3–8× less data than the old 84px
            // PNG assets, with more than enough detail for a phone dock.
            final int side=68;
            Bitmap bitmap=Bitmap.createBitmap(side,side,Bitmap.Config.ARGB_8888);
            ByteArrayOutputStream output=new ByteArrayOutputStream();
            try {
                Canvas canvas=new Canvas(bitmap);
                drawable.setBounds(0,0,side,side);
                drawable.draw(canvas);
                bitmap.compress(Bitmap.CompressFormat.WEBP_LOSSY,82,output);
                return "data:image/webp;base64,"+
                    Base64.encodeToString(output.toByteArray(),Base64.NO_WRAP);
            } finally {
                bitmap.recycle();
            }
        }

        @JavascriptInterface public void launchApp(String pkg) {
            if (pkg == null || pkg.isEmpty()) return;
            // Only packages with an exposed launch intent can be started.
            Intent intent = getPackageManager().getLaunchIntentForPackage(pkg);
            if (intent != null) runOnUiThread(() -> safeStart(intent));
        }

        @JavascriptInterface public void openDefault(String kind) {
            runOnUiThread(() -> {
                switch (kind) {
                    case "phone": safeStart(new Intent(Intent.ACTION_DIAL)); break;
                    case "camera": safeStart(new Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA)); break;
                    case "messages":
                        Intent msg = new Intent(Intent.ACTION_MAIN);
                        msg.addCategory(Intent.CATEGORY_APP_MESSAGING);
                        safeStart(msg); break;
                    case "browser": safeStart(new Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com"))); break;
                    case "calendar":
                        Intent cal=new Intent(Intent.ACTION_MAIN);
                        cal.addCategory(Intent.CATEGORY_APP_CALENDAR);
                        safeStart(cal);break;
                    case "files":
                        Intent files=new Intent(Intent.ACTION_OPEN_DOCUMENT);
                        files.setType("*/*");files.addCategory(Intent.CATEGORY_OPENABLE);
                        safeStart(files);break;
                    case "weather": safeStart(new Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/search?q=weather"))); break;
                    case "music":
                        Intent app = getPackageManager().getLaunchIntentForPackage("com.spotify.music");
                        if (app != null) safeStart(app);
                        else safeStart(new Intent(Intent.ACTION_VIEW, Uri.parse("https://open.spotify.com")));
                        break;
                    case "assistant":
                        safeStart(new Intent(Intent.ACTION_VIEW, Uri.parse("https://26nwinters.github.io/mek-ai/")));
                        break;
                    case "settings": safeStart(new Intent(Settings.ACTION_SETTINGS)); break;
                    case "wifi": safeStart(new Intent(Settings.ACTION_WIFI_SETTINGS)); break;
                    case "bluetooth": safeStart(new Intent(Settings.ACTION_BLUETOOTH_SETTINGS)); break;
                    case "display": safeStart(new Intent(Settings.ACTION_DISPLAY_SETTINGS)); break;
                    case "battery": safeStart(new Intent(Settings.ACTION_BATTERY_SAVER_SETTINGS)); break;
                    case "home": safeStart(new Intent(Settings.ACTION_HOME_SETTINGS)); break;
                    default: break;
                }
            });
        }

        @JavascriptInterface public String battery() {
            JSONObject value = new JSONObject();
            try {
                BatteryManager manager = (BatteryManager) getSystemService(BATTERY_SERVICE);
                int percent = manager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
                Intent status = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
                int plugged = status == null ? 0 : status.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0);
                value.put("percent", Math.max(0, percent));
                value.put("charging", plugged != 0);
            } catch (Exception ignored) { }
            return value.toString();
        }
    }
}
