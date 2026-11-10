// Builds the Android app: the web build (vite --mode android), copied into android/ (cap sync),
// then Gradle.
//   node scripts/apk.mjs           debug APK     (npm run apk)
//   node scripts/apk.mjs release   release APK   (npm run apk:release), signed with android/keystore.properties
//   node scripts/apk.mjs bundle    release AAB for Google Play (npm run bundle)
//   node scripts/apk.mjs sync      only the web build + cap sync, for Android Studio (npm run build:android)
//   node scripts/apk.mjs web       release APK, then put it into the web app's public/download/ (npm run apk:web):
//                                  quidey.apk + quidey-android.json { version, versionCode, size, sha256 }, which
//                                  Settings → App offers on Android phones after the next web deploy. The web repo
//                                  is ../quidey_react-main (or WEB_REPO); the folder is git-ignored there.
// Push notifications are built in only when android/app/google-services.json (the Firebase
// config) is there: without it, registering with Firebase would crash the app.
// The Android Gradle plugin needs JDK 21+: JAVA_HOME is used when it is new enough, else the JDK
// that comes with Android Studio.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const androidDir = join(root, 'android');
const what = process.argv[2] ?? 'debug';
const TASKS = { debug: 'assembleDebug', release: 'assembleRelease', bundle: 'bundleRelease', sync: null, web: 'assembleRelease' };
if (!(what in TASKS)) {
    console.error(`Unknown: ${what} (debug | release | bundle | sync | web)`);
    process.exit(1);
}

// runs a command line (through the shell: a .bat only runs through cmd); stops when it fails
const run = (line, options = {}) => {
    const result = spawnSync(line, { stdio: 'inherit', shell: true, cwd: root, ...options });
    if (result.status !== 0) process.exit(result.status ?? 1);
};

const firebase = existsSync(join(androidDir, 'app', 'google-services.json'));
if (!firebase) console.warn('\n! android/app/google-services.json is missing: built without push notifications and analytics (see README-android.md).\n');
if (what === 'web' && !existsSync(join(androidDir, 'keystore.properties'))) {
    console.error("android/keystore.properties is missing: an unsigned APK can't be installed (see README-android.md).");
    process.exit(1);
}
if (what !== 'debug' && what !== 'sync' && !existsSync(join(androidDir, 'keystore.properties'))) {
    console.warn('\n! android/keystore.properties is missing: the release build stays unsigned (see README-android.md).\n');
}

// push and Google Analytics for Firebase both need the Firebase config
run('npx vite build --mode android', { env: { ...process.env, VITE_NATIVE_PUSH: firebase ? 'on' : 'off', VITE_NATIVE_ANALYTICS: firebase ? 'on' : 'off' } });
run('npx cap sync android');
if (!TASKS[what]) process.exit(0);

// the major version of the JDK in `home` (java -version writes to stderr), 0 if none runs
const major = (home) => {
    const result = spawnSync(join(home, 'bin', 'java'), ['-version'], { encoding: 'utf8' });
    const match = /version "(\d+)/.exec(`${result.stderr}${result.stdout}`);
    return match ? Number(match[1]) : 0;
};
const javaHome = [
    process.env.JAVA_HOME,
    'C:\\Program Files\\Android\\Android Studio\\jbr',
    '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
    '/opt/android-studio/jbr',
].filter(Boolean).find((home) => existsSync(home) && major(home) >= 21);
if (!javaHome) {
    console.error('No JDK 21+ found: set JAVA_HOME to one (Android Studio brings one in its "jbr" folder).');
    process.exit(1);
}

// by full path: Windows may not look in the current folder (NoDefaultCurrentDirectoryInExePath)
const gradlew = join(androidDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
console.log(`Gradle ${TASKS[what]} with JDK ${javaHome}`);
run(`"${gradlew}" ${TASKS[what]}`, { cwd: androidDir, env: { ...process.env, JAVA_HOME: javaHome } });

const outputs = {
    debug: join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug'),
    release: join(androidDir, 'app', 'build', 'outputs', 'apk', 'release'),
    bundle: join(androidDir, 'app', 'build', 'outputs', 'bundle', 'release'),
};
if (what !== 'web') {
    console.log(`\nDone: ${outputs[what]}`);
    process.exit(0);
}

// web: the signed APK for the download in the web app's settings
const apk = join(outputs.release, 'app-release.apk');
const gradle = readFileSync(join(androidDir, 'app', 'build.gradle'), 'utf8');
const version = /versionName\s+"([^"]+)"/.exec(gradle)?.[1];
const versionCode = Number(/versionCode\s+(\d+)/.exec(gradle)?.[1]);
const webRepo = resolve(process.env.WEB_REPO ?? join(root, '..', 'quidey_react-main'));
if (!existsSync(apk) || !version || !existsSync(join(webRepo, 'package.json'))) {
    console.error(`Can't publish: ${!existsSync(apk) ? 'no APK built' : !version ? 'no versionName in app/build.gradle' : `no web repo at ${webRepo}`}`);
    process.exit(1);
}
const file = readFileSync(apk);
const target = join(webRepo, 'public', 'download');
mkdirSync(target, { recursive: true });
copyFileSync(apk, join(target, 'quidey.apk'));
const info = { version, versionCode, size: file.length, sha256: createHash('sha256').update(file).digest('hex') };
writeFileSync(join(target, 'quidey-android.json'), `${JSON.stringify(info, null, 2)}\n`);
console.log(`\nDone: Quidey ${version} (${(file.length / 1024 / 1024).toFixed(1)} MB) in ${target}`);
console.log('It goes online with the next web deploy (npm run build, then npx wrangler deploy, in the web repo).');
