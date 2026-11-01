# Quidey for Android (Capacitor)

This repo is a clone of `quidey_react-main` (the web app) plus a Capacitor shell that packs the
same React app into an Android app. **All app code is written in the web repo first** and comes
here with `git pull web <branch>`; this repo only adds what is truly Android: `android/`,
`capacitor.config.json`, `.env.android`, the build scripts, signing and the store listing
(`STORE.md`, `store/`).

## Build

Needs Node 22+, the Android SDK (Android Studio) and a JDK 21+ (the script finds Android Studio's
own `jbr` when `JAVA_HOME` is older).

```sh
npm ci
npm run apk           # debug APK  → android/app/build/outputs/apk/debug/app-debug.apk
npm run bundle        # release AAB for Google Play → android/app/build/outputs/bundle/release/app-release.aab
npm run apk:release   # signed release APK (to install directly)
npm run build:android # only web build + cap sync (then build in Android Studio: npm run android:open)
```

Every command runs `vite build --mode android` (API `https://api.quidey.com` from `.env.android`)
and `cap sync android` first.

- **Push notifications** are built in only when `android/app/google-services.json` (Firebase) is
  there (`VITE_NATIVE_PUSH=on`); without it the app says notifications aren't available.
- **Sign in with Google** needs `VITE_GOOGLE_CLIENT_ID` in `.env.android` (the web client id).
- **Signing**: `android/keystore.properties` (git-ignored) points to the upload key in
  `C:\Users\eesge\Quidey\quidey-android-keys\` (keystore, password, fingerprints). Back that
  folder up somewhere safe; every update must be signed with the same upload key (with Play App
  Signing, Google can reset a lost upload key).
- Before a release raise `versionCode` / `versionName` in `android/app/build.gradle`.

Install a build: `adb install -r <apk>` or copy the APK to the phone.

## Taking over changes of the web app

```sh
git pull web refactor           # or whichever branch of quidey_react-main
npm install
npm run apk
```

`src/` here is always the web repo's; conflicts can only come up in `package.json`,
`package-lock.json` (run `npm install`) and `CLAUDE.md`.

## What is Android-only

| Where | What |
|---|---|
| `capacitor.config.json` | app id `com.quidey.app`, served as `https://app.quidey.com` (CORS and password autofill like the web), SystemBars insets |
| `android/app/src/main/java/com/quidey/app/` | `MainActivity` registers `GoogleSignInPlugin` ("QuideyGoogle": Credential Manager account picker → ID token with the server's nonce) and `BillingPlugin` ("QuideyBilling": Google Play Billing 8, product `quidey_pro`, base plans `monthly`/`yearly`) |
| `android/app/src/main/AndroidManifest.xml` | no backups (the WebView storage holds the sign-in token), `POST_NOTIFICATIONS`, FCM defaults (icon `ic_stat_quidey`, colour, channel) |
| `android/app/src/main/res/` | launcher icon (vector + monochrome), splash, notification icon |
| `scripts/apk.mjs`, `scripts/store-graphic.mjs` | builds; the Play feature graphic |
| `STORE.md`, `store/` | everything for the Play Console: services setup, listing texts, data safety, content rating |

The JavaScript side of those plugins and the Android branches (`features/native/`,
`features/pro/pro.js`, `features/auth/google.js`, `features/pwa/push.js`) live in the web repo
and do nothing in a browser.

## Services to set up (once)

See `STORE.md` § 0: Firebase (`google-services.json` + server key), Google Cloud OAuth clients
(web + Android with the SHA-1s in `quidey-android-keys/fingerprints.txt` and Play's app signing
key), the Play subscription `quidey_pro`, the Play service account and real-time notifications,
Stripe. Server settings in the backend's `.env.example`; database migrations 034 and 035.
