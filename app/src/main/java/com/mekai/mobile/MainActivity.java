package com.mekai.mobile;

import android.app.Activity;
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
    private static final int REQUEST_EXPORT=930;
    private static final int REQUEST_IMPORT=931;
    private static final int REQUEST_PICK_WIDGET=932;
    private static final int REQUEST_CONFIG_WIDGET=933;
    private int pendingWidgetId=-1;
    private String pendingExport;
    private BroadcastReceiver packageReceiver;
    private boolean receiverRegistered=false;

    private final java.util.concurrent.ExecutorService appExecutor =
        java.util.concurrent.Executors.newSingleThreadExecutor();
    private final android.util.LruCache<String,String> iconCache =
        new android.util.LruCache<>(100);
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
        settings.setAllowFileAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.addJavascriptInterface(new PhoneBridge(), "MEK");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                if (HOME.equals(req.getUrl().toString())) return false;
                return true;
            }
        });
        stage = new FrameLayout(this);
        stage.addView(web, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(stage);
        widgetHost = new AppWidgetHost(this, 4721);
        try { widgetHost.startListening(); }
        catch (Exception e) { Log.w(TAG,"Widget host start failed",e); }
        registerAppChanges();
        web.loadUrl(HOME);
    }

    @Override protected void onDestroy() {
        if (receiverRegistered) {
            try { unregisterReceiver(packageReceiver); } catch(Exception ignored){}
        }
        if (widgetHost != null) try { widgetHost.stopListening(); } catch(Exception ignored){}
        widgetViews.clear();
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
        try { registerReceiver(packageReceiver, filter); receiverRegistered=true; }
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

    private void startWidgetPicker() {
        if(widgetHost==null)return;
        try {
            pendingWidgetId=widgetHost.allocateAppWidgetId();
            Intent pick=new Intent(AppWidgetManager.ACTION_APPWIDGET_PICK);
            pick.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,pendingWidgetId);
            startActivityForResult(pick,REQUEST_PICK_WIDGET);
        } catch(Exception e) {
            Log.w(TAG,"Cannot open Android widget picker",e);
            notifyWidgetError();
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
            callback("window.mekNativeWidgetChosen && window.mekNativeWidgetChosen("+
                widgetId+","+JSONObject.quote(label)+","+
                Math.max(info.minWidth,80)+","+Math.max(info.minHeight,80)+")");
        } catch(Exception e){
            Log.w(TAG,"Unable to register chosen widget",e);
            try{widgetHost.deleteAppWidgetId(widgetId);}catch(Exception ignored){}
            notifyWidgetError();
        }finally{
            pendingWidgetId=-1;
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
        if(requestCode==REQUEST_PICK_WIDGET||requestCode==REQUEST_CONFIG_WIDGET){
            int id=data!=null?data.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,pendingWidgetId):pendingWidgetId;
            if(resultCode!=RESULT_OK||id<0){
                try{if(id>=0)widgetHost.deleteAppWidgetId(id);}catch(Exception ignored){}
                pendingWidgetId=-1;notifyWidgetError();return;
            }
            if(requestCode==REQUEST_PICK_WIDGET){
                AppWidgetProviderInfo info=AppWidgetManager.getInstance(this).getAppWidgetInfo(id);
                if(info!=null && info.configure!=null){
                    try{
                        Intent config=new Intent(AppWidgetManager.ACTION_APPWIDGET_CONFIGURE);
                        config.setComponent(info.configure);
                        config.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,id);
                        startActivityForResult(config,REQUEST_CONFIG_WIDGET);
                        return;
                    }catch(Exception e){Log.w(TAG,"Widget configuration unavailable",e);}
                }
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

        @JavascriptInterface public void pickAndroidWidget() {
            runOnUiThread(()->startWidgetPicker());
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
            Bitmap image = Bitmap.createBitmap(84, 84, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(image);
            drawable.setBounds(0, 0, 84, 84);
            drawable.draw(canvas);
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            image.compress(Bitmap.CompressFormat.PNG, 90, bytes);
            image.recycle();
            return "data:image/png;base64," + Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP);
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
