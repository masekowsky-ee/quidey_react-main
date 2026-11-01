package com.quidey.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // the app's own plugins (before the bridge starts): sign in with Google, Quidey Pro via Google Play
        registerPlugin(GoogleSignInPlugin.class);
        registerPlugin(BillingPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
