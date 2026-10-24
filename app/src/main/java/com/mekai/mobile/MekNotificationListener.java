package com.mekai.mobile;

import android.app.Notification;
import android.app.PendingIntent;
import android.content.ComponentName;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.os.Bundle;
import org.json.JSONArray;
import org.json.JSONObject;

/** Optional Android notification listener. User must explicitly grant access in
 * system Settings. No notification content leaves the device via this class. */
public class MekNotificationListener extends NotificationListenerService {
    private static volatile MekNotificationListener active;
    @Override public void onListenerConnected(){super.onListenerConnected();active=this;}
    @Override public void onListenerDisconnected(){active=null;super.onListenerDisconnected();}
    @Override public void onDestroy(){active=null;super.onDestroy();}

    static JSONArray snapshot(){
        JSONArray result=new JSONArray();
        MekNotificationListener listener=active;
        if(listener==null)return result;
        try{
            StatusBarNotification[] items=listener.getActiveNotifications();
            if(items==null)return result;
            for(StatusBarNotification entry:items){
                if(result.length()>=40)break;
                Notification n=entry.getNotification();
                if(n==null)continue;
                Bundle extra=n.extras;
                String app=entry.getPackageName();
                try{
                    CharSequence label=listener.getPackageManager()
                        .getApplicationLabel(listener.getPackageManager().getApplicationInfo(app,0));
                    if(label!=null)app=label.toString();
                }catch(Exception ignored){}
                String title=extra==null?"":String.valueOf(extra.getCharSequence(Notification.EXTRA_TITLE,""));
                String detail=extra==null?"":String.valueOf(extra.getCharSequence(Notification.EXTRA_TEXT,""));
                JSONObject item=new JSONObject();
                item.put("key",entry.getKey());
                item.put("app",truncate(app,80));
                item.put("title",truncate(title,150));
                item.put("text",truncate(detail,260));
                item.put("postedAt",entry.getPostTime());
                result.put(item);
            }
        }catch(Exception ignored){}
        return result;
    }
    private static String truncate(String s,int max){return s.length()>max?s.substring(0,max):s;}
    static void open(String key){
        MekNotificationListener listener=active;
        if(listener==null||key==null)return;
        try{
            for(StatusBarNotification entry:listener.getActiveNotifications()){
                if(entry.getKey().equals(key)){
                    PendingIntent intent=entry.getNotification().contentIntent;
                    if(intent!=null)intent.send();
                    return;
                }
            }
        }catch(Exception ignored){}
    }
    static void dismiss(String key){
        MekNotificationListener listener=active;
        if(listener==null||key==null)return;
        try{listener.cancelNotification(key);}catch(Exception ignored){}
    }
}
