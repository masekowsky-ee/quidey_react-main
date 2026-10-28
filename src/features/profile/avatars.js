// Profile pictures (testers first). A tester sets one in "Profil gestalten" (PUT /api/tester/avatar);
// it is seen by the people who also see their online status. While in test only testers see
// pictures at all (useAvatarUrl returns null for everybody else, so nothing is loaded for them).
//
// The app asks which of the people on screen have one, all at once (GET /api/avatars?ids=…,
// collected for a moment), then loads each picture with its version in the address
// (GET /api/avatars/:id?v=…, with the sign-in token, kept as an object URL until it changes).
// avatars:changed { userId } (live) forgets one, so the new picture comes in.

import { useEffect, useSyncExternalStore } from 'react';
import { apiFetch, apiUrl } from '../helperFunction';
import { useIsTester } from '../auth/tester';
import { useRealtime } from '../realtime/socket';

const BATCH_MS = 30;
const versions = new Map();   // user id -> version (string) | null (none)
const pictures = new Map();   // user id -> { version, url }
const loading = new Set();
const listeners = new Set();
let wanted = new Set();
let timer = null;

const notify = () => listeners.forEach(listener => listener());
const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };

async function loadPicture(id, version) {
    if (loading.has(id) || pictures.get(id)?.version === version) return;
    loading.add(id);
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(apiUrl(`/api/avatars/${id}?v=${encodeURIComponent(version)}`), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!res.ok) return;
        const url = URL.createObjectURL(await res.blob());
        const old = pictures.get(id);
        if (old) URL.revokeObjectURL(old.url);
        pictures.set(id, { version, url });
        notify();
    } catch { /* no picture then: the initials stay */ } finally {
        loading.delete(id);
    }
}

async function flush() {
    timer = null;
    const ids = [...wanted];
    wanted = new Set();
    if (ids.length === 0) return;
    try {
        const found = await apiFetch(`/api/avatars?ids=${ids.join(',')}`);
        for (const id of ids) versions.set(id, found?.[id] ?? null);
        for (const id of ids) if (found?.[id]) loadPicture(id, found[id]);
        notify();
    } catch {
        for (const id of ids) versions.set(id, null);
    }
}

function want(id) {
    if (!id || versions.has(id) || wanted.has(id)) return;
    wanted.add(id);
    timer ??= setTimeout(flush, BATCH_MS);
}

// a picture changed (or went): it is asked for again the next time it is shown
export function forgetAvatar(id) {
    versions.delete(id);
    const old = pictures.get(id);
    if (old) URL.revokeObjectURL(old.url);
    pictures.delete(id);
    notify();
}

// The picture of this person as an address for <img>, or null (none, still loading, not a tester)
export function useAvatarUrl(userId) {
    const isTester = useIsTester();
    const id = isTester && Number.isInteger(userId) ? userId : null;
    const url = useSyncExternalStore(subscribe, () => (id ? pictures.get(id)?.url ?? null : null));
    const known = useSyncExternalStore(subscribe, () => (id ? versions.has(id) : true));
    useEffect(() => { if (id && !known) want(id); }, [id, known]);
    return url;
}

// App: pictures changed live are loaded again
export function useAvatarRealtime() {
    useRealtime('avatars:changed', ({ userId } = {}) => { if (userId) forgetAvatar(userId); });
}

// ---------- setting one ----------
const SIDE = 320;
const MAX_CHARS = 110 * 1024;

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
});
const loadImage = (src) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
});

// A picture file → a square from its middle, SIDE pixels, as a small WebP (JPEG where the
// browser can't write WebP). Drawing it anew leaves the photo's metadata (place, camera) behind.
export async function squarePicture(file) {
    if (!file?.type?.startsWith('image/')) return null;
    const image = await loadImage(await readAsDataUrl(file));
    const side = Math.min(image.width, image.height);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.min(SIDE, side);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.86, 0.75, 0.6, 0.45]) {
        const webp = canvas.toDataURL('image/webp', quality);
        const data = webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality);
        if (data.length <= MAX_CHARS) return data;
    }
    return null;
}

export async function saveAvatar(myId, data) {
    await apiFetch('/api/tester/avatar', { method: 'PUT', body: JSON.stringify({ data }) });
    forgetAvatar(myId);
}

export async function removeAvatar(myId) {
    await apiFetch('/api/profile/avatar', { method: 'DELETE' });
    forgetAvatar(myId);
}

// admins: takes somebody's picture down
export async function removeAvatarOf(userId) {
    await apiFetch(`/api/admin/users/${userId}/avatar`, { method: 'DELETE' });
    forgetAvatar(userId);
}
