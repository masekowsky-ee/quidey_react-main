// Builds the Android app: the web build (vite --mode android), copied into android/ (cap sync),
// then Gradle.
//   node scripts/apk.mjs           debug APK     (npm run apk)
//   node scripts/apk.mjs release   release APK   (npm run apk:release), signed with android/keystore.properties
//   node scripts/apk.mjs bundle    release AAB for Google Play (npm run bundle)
//   node scripts/apk.mjs sync      only the web build + cap sync, for Android Studio (npm run build:android)
// Push notifications are built in only when android/app/google-services.json (the Firebase
// config) is there: without it, registering with Firebase would crash the app.
// The Android Gradle plugin needs JDK 21+: JAVA_HOME is used when it is new enough, else the JDK
// that comes with Android Studio.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const androidDir = join(root, 'android');
const what = process.argv[2] ?? 'debug';
const TASKS = { debug: 'assembleDebug', release: 'assembleRelease', bundle: 'bundleRelease', sync: null };
if (!(what in TASKS)) {
    console.error(`Unknown: ${what} (debug | release | bundle | sync)`);
    process.exit(1);
}

// runs a command line (through the shell: a .bat only runs through cmd); stops when it fails
const run = (line, options = {}) => {
    const result = spawnSync(line, { stdio: 'inherit', shell: true, cwd: root, ...options });
    if (result.status !== 0) process.exit(result.status ?? 1);
};

const firebase = existsSync(join(androidDir, 'app', 'google-services.json'));
if (!firebase) console.warn('\n! android/app/google-services.json is missing: built without push notifications (see README-android.md).\n');
if (what !== 'debug' && what !== 'sync' && !existsSync(join(androidDir, 'keystore.properties'))) {
    console.warn('\n! android/keystore.properties is missing: the release build stays unsigned (see README-android.md).\n');
}

run('npx vite build --mode android', { env: { ...process.env, VITE_NATIVE_PUSH: firebase ? 'on' : 'off' } });
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
console.log(`\nDone: ${outputs[what]}`);
