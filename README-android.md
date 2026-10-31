# Quidey for Android (Capacitor)

This repo is a clone of `quidey_react-main` (the web app) plus a Capacitor shell that packs the
same React app into an Android APK. The web app keeps living in `../quidey_react-main`; this repo
follows it through the git remote `web`.

## Build the APK

Needs Node 22+, the Android SDK (Android Studio) and a JDK 21+ (the script finds Android Studio's
own `jbr` when `JAVA_HOME` is older).

```sh
npm ci
npm run apk           # vite build --mode android → cap sync android → gradlew assembleDebug
```

The APK lands in `android/app/build/outputs/apk/debug/app-debug.apk`. Install it with
`adb install -r <apk>` or copy it to the phone (allow "install unknown apps").

Other commands:

- `npm run build:android`: only the web build + copy into `android/` (then build in Android Studio)
- `npm run android:open`: opens `android/` in Android Studio
- `npm run apk:release`: release APK, signed when `android/keystore.properties` exists:

  ```properties
  storeFile=quidey-release.jks
  storePassword=…
  keyAlias=quidey
  keyPassword=…
  ```

  (paths relative to `android/`; make a key once with
  `keytool -genkey -v -keystore android/quidey-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias quidey`,
  keep it safe: every update must be signed with the same key). Both files are git-ignored.

Before each release raise `versionCode` / `versionName` in `android/app/build.gradle`.

## Taking over changes of the web app

```sh
git pull web master      # or the web repo's branch you want, e.g. refactor
npm install
npm run apk
```

The Android-only changes are small and harmless in a browser, so merges rarely conflict:

| File | What |
|---|---|
| `capacitor.config.json`, `android/`, `scripts/apk.mjs`, `.env.android` | the Android shell |
| `src/features/native/native.js` | back button, system bar colours, resume |
| `src/main.jsx` | calls `setupNativeApp(store)` |
| `src/features/pwa/registerServiceWorker.js`, `install.js`, `push.js` | no service worker / install row / Web Push in the app |
| `src/components/Settings.jsx`, `src/i18n/translations.js` | `pushUnsupportedApp` hint |

## How it works

- The app is served from the APK at **https://app.quidey.com** (`server.hostname`): the origin the
  API's CORS already allows, and Android's autofill offers the passwords saved for the site.
  Nothing on the server had to change.
- The API is `https://api.quidey.com` (`.env.android`).
- Android back: closes an open dialog / drawer / form (as Escape), else goes back a page, on the
  first page the app goes to the background.
- No cloud backup of the app's data (`allowBackup="false"`, `data_extraction_rules.xml`): the
  WebView's storage holds the sign-in token.
- Not in the app yet: push notifications (Web Push needs a service worker; native push would need
  Firebase Cloud Messaging + a backend change). Reminders still appear while the app is open.
