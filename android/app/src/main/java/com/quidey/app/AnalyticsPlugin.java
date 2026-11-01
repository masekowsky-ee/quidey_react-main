package com.quidey.app;

import android.os.Bundle;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.FirebaseApp;
import com.google.firebase.analytics.FirebaseAnalytics;

import java.util.EnumMap;
import java.util.Iterator;
import java.util.Map;

/**
 * "QuideyAnalytics": Google Analytics for Firebase, only with the person's consent
 * (src/features/native/analytics.js asks and remembers it).
 *
 * Off until then: the manifest switches collection off by default (firebase_analytics_collection_enabled
 * false, no advertising id, no Android id, no ad signals), so nothing is collected before the answer.
 * setEnabled({ enabled }) turns it on or off (Firebase remembers that across starts); off also deletes
 * what was collected on the device and gives the installation a new id. Ads are never allowed: only
 * analytics_storage follows the answer. Without the Firebase config (google-services.json) every
 * method does nothing and isAvailable() answers false.
 */
@CapacitorPlugin(name = "QuideyAnalytics")
public class AnalyticsPlugin extends Plugin {

    private boolean available() {
        return !FirebaseApp.getApps(getContext()).isEmpty();
    }

    private FirebaseAnalytics analytics() {
        return FirebaseAnalytics.getInstance(getContext());
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", available());
        call.resolve(result);
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        if (available()) {
            FirebaseAnalytics analytics = analytics();
            Map<FirebaseAnalytics.ConsentType, FirebaseAnalytics.ConsentStatus> consent = new EnumMap<>(FirebaseAnalytics.ConsentType.class);
            consent.put(FirebaseAnalytics.ConsentType.ANALYTICS_STORAGE,
                    enabled ? FirebaseAnalytics.ConsentStatus.GRANTED : FirebaseAnalytics.ConsentStatus.DENIED);
            consent.put(FirebaseAnalytics.ConsentType.AD_STORAGE, FirebaseAnalytics.ConsentStatus.DENIED);
            consent.put(FirebaseAnalytics.ConsentType.AD_USER_DATA, FirebaseAnalytics.ConsentStatus.DENIED);
            consent.put(FirebaseAnalytics.ConsentType.AD_PERSONALIZATION, FirebaseAnalytics.ConsentStatus.DENIED);
            analytics.setConsent(consent);
            analytics.setAnalyticsCollectionEnabled(enabled);
            if (!enabled) analytics.resetAnalyticsData();
        }
        call.resolve();
    }

    // { name }: a page of the app (a name without ids or user names, made by the web code)
    @PluginMethod
    public void logScreen(PluginCall call) {
        String name = call.getString("name");
        if (available() && name != null) {
            Bundle params = new Bundle();
            params.putString(FirebaseAnalytics.Param.SCREEN_NAME, name);
            params.putString(FirebaseAnalytics.Param.SCREEN_CLASS, "Quidey");
            analytics().logEvent(FirebaseAnalytics.Event.SCREEN_VIEW, params);
        }
        call.resolve();
    }

    // { name, params? }: params with text, number or true/false values
    @PluginMethod
    public void logEvent(PluginCall call) {
        String name = call.getString("name");
        if (available() && name != null) {
            Bundle params = new Bundle();
            JSObject given = call.getObject("params", new JSObject());
            for (Iterator<String> keys = given.keys(); keys.hasNext(); ) {
                String key = keys.next();
                Object value = given.opt(key);
                if (value instanceof String) params.putString(key, (String) value);
                else if (value instanceof Integer) params.putLong(key, (Integer) value);
                else if (value instanceof Long) params.putLong(key, (Long) value);
                else if (value instanceof Number) params.putDouble(key, ((Number) value).doubleValue());
                else if (value instanceof Boolean) params.putString(key, value.toString());
            }
            analytics().logEvent(name, params);
        }
        call.resolve();
    }
}
