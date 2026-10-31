// Builds the Android APK with Gradle (npm run apk: first the web build + cap sync, then this).
// The Android Gradle plugin needs JDK 21+: JAVA_HOME is used when it is new enough, else the JDK
// that comes with Android Studio. `node scripts/apk.mjs release` builds the release APK instead
// (unsigned unless android/keystore.properties exists, see README-android.md).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

// the major version of the JDK in `home` (java -version writes to stderr), 0 if none runs
const major = (home) => {
    const result = spawnSync(join(home, 'bin', 'java'), ['-version'], { encoding: 'utf8' });
    const match = /version "(\d+)/.exec(`${result.stderr}${result.stdout}`);
    return match ? Number(match[1]) : 0;
};

const candidates = [
    process.env.JAVA_HOME,
    'C:\\Program Files\\Android\\Android Studio\\jbr',
    '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
    '/opt/android-studio/jbr',
].filter(Boolean);
const javaHome = candidates.find((home) => existsSync(home) && major(home) >= 21);
if (!javaHome) {
    console.error('No JDK 21+ found: set JAVA_HOME to one (Android Studio brings one in its "jbr" folder).');
    process.exit(1);
}

const task = process.argv[2] === 'release' ? 'assembleRelease' : 'assembleDebug';
const androidDir = resolve(import.meta.dirname, '..', 'android');
// by full path: Windows may not look in the current folder (NoDefaultCurrentDirectoryInExePath)
const gradlew = join(androidDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
console.log(`Gradle ${task} with JDK ${javaHome}`);
// a .bat only runs through cmd, given as one command line
const run = spawnSync(process.platform === 'win32' ? `"${gradlew}" ${task}` : gradlew, process.platform === 'win32' ? [] : [task], {
    cwd: androidDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, JAVA_HOME: javaHome },
});
if (run.status !== 0) process.exit(run.status ?? 1);

const kind = task === 'assembleRelease' ? 'release' : 'debug';
console.log(`\nAPK: ${join(androidDir, 'app', 'build', 'outputs', 'apk', kind)}`);
