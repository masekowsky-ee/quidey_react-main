// Push notifications in the Android app: Firebase Cloud Messaging instead of the browser's push
// service (the app has no service worker). features/pwa/push.js runs the same flow on both; only
// the device's steps come from here. The device's address is its FCM token, handed to the server
// as the endpoint 'fcm:<token>' (no keys); the server sends through Firebase (backend utils/fcm.js).
//
// Built only when the app has its Firebase config (android/app/google-services.json): the build
// script sets VITE_NATIVE_PUSH=on then. Without it, registering would crash the app.
import { isNativeApp } from './native';

export const nativePushAvailable = () => isNativeApp() && import.meta.env.VITE_NATIVE_PUSH === 'on';

const REGISTER_TIMEOUT_MS = 10 * 1000;
// one Android notification channel per kind (the server sends the kind as channel_id), so each
// can be muted in Android's settings; the names in the app's language
const CHANNELS = {
    plan: { de: 'Aufgaben & Termine', en: 'Tasks & events', importance: 4 },
    digest: { de: 'Tagesüberblick', en: 'Daily overview', importance: 3 },
    messages: { de: 'Nachrichten', en: 'Messages', importance: 4 },
    social: { de: 'Freunde & Einladungen', en: 'Friends & invites', importance: 3 },
};

let plugin;
const load = async () => (plugin ??= (await import('@capacitor/push-notifications')).PushNotifications);

// 'granted' | 'denied' | 'default', like Notification.permission
const permissionOf = (receive) => (receive === 'granted' ? 'granted' : receive === 'denied' ? 'denied' : 'default');

export async function nativePermission() {
    return permissionOf((await (await load()).checkPermissions()).receive);
}

// Asks for it (Android 13+ shows the system's question; before, it is always granted)
export async function requestNativePermission() {
    return permissionOf((await (await load()).requestPermissions()).receive);
}

let channelsMade = false;
async function makeChannels(push, language) {
    if (channelsMade) return;
    channelsMade = true;
    await Promise.all(Object.entries(CHANNELS).map(([id, channel]) => push.createChannel({
        id,
        name: channel[language === 'en' ? 'en' : 'de'],
        importance: channel.importance,
        visibility: 0,
        vibration: true,
        lights: true,
        lightColor: '#FB923C',
    }).catch(() => {})));
}

// Registers with FCM: the device's address for the server, { endpoint, toJSON() } like a
// browser's push subscription
export async function nativeSubscription(language) {
    const push = await load();
    await makeChannels(push, language);
    const token = await new Promise((resolve, reject) => {
        const handles = [];
        const done = (settle, value) => {
            clearTimeout(timer);
            handles.forEach((handle) => handle.then((h) => h.remove()).catch(() => {}));
            settle(value);
        };
        const timer = setTimeout(() => done(reject, new Error('Firebase registration gave no answer')), REGISTER_TIMEOUT_MS);
        handles.push(push.addListener('registration', ({ value }) => done(resolve, value)));
        handles.push(push.addListener('registrationError', ({ error }) => done(reject, new Error(error))));
        push.register().catch((err) => done(reject, err));
    });
    const endpoint = `fcm:${token}`;
    return { endpoint, toJSON: () => ({ endpoint }) };
}

// Off on this device: Firebase forgets the token
export async function unregisterNative() {
    await (await load()).unregister().catch(() => {});
}

// A tapped notification opens the page it is about (data.url from the server). Returns a cleanup.
export function onNativePushOpen(navigate) {
    if (!nativePushAvailable()) return () => {};
    let handle;
    load().then((push) => {
        handle = push.addListener('pushNotificationActionPerformed', ({ notification }) => {
            const url = notification?.data?.url;
            if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')) navigate(url);
        });
    }).catch(() => {});
    return () => { handle?.then((h) => h.remove()).catch(() => {}); };
}
