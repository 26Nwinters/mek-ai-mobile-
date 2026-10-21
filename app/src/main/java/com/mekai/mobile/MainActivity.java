package com.mekai.mobile;

import android.app.Activity;
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
        setContentView(web);
        web.loadUrl(HOME);
    }

    @Override protected void onResume() {
        super.onResume();
        if (web != null) web.evaluateJavascript("window.refreshNative && window.refreshNative()", null);
    }

    @Override public void onBackPressed() {
        if (web != null) web.evaluateJavascript("window.goBackInLauncher && window.goBackInLauncher()", null);
        else super.onBackPressed();
    }

    private void safeStart(Intent intent) {
        try { startActivity(intent); }
        catch (Exception e) { Log.w(TAG, "Could not open activity", e); }
    }

    public class PhoneBridge {
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
                    try { item.put("icon", iconData(info.loadIcon(pm))); }
                    catch (Exception ignored) { item.put("icon", ""); }
                    result.put(item);
                }
            } catch (Exception e) { Log.w(TAG, "App listing failed", e); }
            return result.toString();
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
