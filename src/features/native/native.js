// The Android app (Capacitor, see capacitor.config.json) runs this same web app in a WebView.
// Whether this is it: the one low-level question the rest of the app asks. What differs there
// (back button, system bars, update checks) is in setup.js; in the browser that does nothing.
import { Capacitor } from '@capacitor/core';

export const isNativeApp = () => Capacitor.isNativePlatform();
