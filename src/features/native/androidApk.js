// The Android app as a file to download (Settings → App), for Android phones in the browser.
// vite.config.js reads public/download/quidey-android.json at build time (written with the APK by
// the Android repo's `npm run apk:web`): { version, versionCode, size (bytes), sha256 }. No APK in
// the build, no row.
import { isNativeApp } from './native';

export const APK_URL = '/download/quidey.apk';

const parse = (text) => {
    try {
        const info = JSON.parse(text);
        return info && typeof info.version === 'string' && Number.isFinite(info.size) ? info : null;
    } catch {
        return null;
    }
};

export const androidApk = () => (import.meta.env.VITE_ANDROID_APK ? parse(import.meta.env.VITE_ANDROID_APK) : null);

// an Android phone or tablet, in the browser (the app itself has nothing to download)
export const onAndroidBrowser = () => !isNativeApp() && /Android/i.test(window.navigator.userAgent);

// what the settings offer: the APK's details, or null where there is none to offer
export const apkOffer = () => (onAndroidBrowser() ? androidApk() : null);

// "6,2 MB"
export const formatSize = (bytes, language) =>
    `${new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'de-DE', { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`;
