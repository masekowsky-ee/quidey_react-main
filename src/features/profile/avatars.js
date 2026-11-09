// Profile pictures, for everybody. One is set in "Profil gestalten" (PUT /api/profile/avatar): placed
// and zoomed in a circle (AvatarCropper), cut to that circle on this device (the corners stay
// transparent) and made small. It is seen by the people who also see the owner's online status.
//
// The app asks which of the people on screen have one, all at once (GET /api/avatars?ids=…,
// collected for a moment), then loads each picture with its version in the address
// (GET /api/avatars/:id?v=…, with the sign-in token, kept as an object URL until it changes).
// avatars:changed { userId } (live) forgets one, so the new picture comes in.

import { useEffect, useSyncExternalStore } from 'react';
import { apiFetch, apiUrl } from '../helperFunction';
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

// The picture of this person as an address for <img>, or null (none, still loading)
export function useAvatarUrl(userId) {
    const id = Number.isInteger(userId) ? userId : null;
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
const SIDES = [320, 256, 200, 160];
const MAX_CHARS = 110 * 1024;
export const ZOOM_MAX = 4;

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

// A picture file → an <img> to place in the circle, or null when it isn't a picture
export async function openPicture(file) {
    if (!file?.type?.startsWith('image/')) return null;
    return loadImage(await readAsDataUrl(file));
}

// Where the picture sits in the circle: zoom 1 = its short side just fills the circle, x / y =
// how far its middle is moved from the circle's middle, in parts of the circle's width
// (kept so that the circle is always covered).
export function clampPlacement(image, { zoom, x, y }) {
    const z = Math.min(ZOOM_MAX, Math.max(1, zoom));
    const short = Math.min(image.width, image.height);
    const w = (image.width / short) * z;   // the picture's size in circle widths
    const h = (image.height / short) * z;
    const maxX = (w - 1) / 2;
    const maxY = (h - 1) / 2;
    return { zoom: z, x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
}

// The square of the source picture (in its pixels) that the circle shows
export function cropSquare(image, placement) {
    const { zoom, x, y } = clampPlacement(image, placement);
    const side = Math.min(image.width, image.height) / zoom;
    return {
        sx: image.width / 2 - side / 2 - x * side,
        sy: image.height / 2 - side / 2 - y * side,
        side,
    };
}

// The circle as a small picture: drawn anew (the photo's metadata, like place and camera, stays
// behind), everything outside the circle transparent. WebP where the browser writes it, else PNG
// (both keep the transparency), smaller until it fits.
export function circlePicture(image, placement) {
    const { sx, sy, side } = cropSquare(image, placement);
    for (const size of SIDES) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = Math.max(1, Math.min(size, Math.round(side)));
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, sx, sy, side, side, 0, 0, canvas.width, canvas.height);
        for (const quality of [0.88, 0.76, 0.6]) {
            const webp = canvas.toDataURL('image/webp', quality);
            if (!webp.startsWith('data:image/webp')) break;
            if (webp.length <= MAX_CHARS) return webp;
        }
        const png = canvas.toDataURL('image/png');
        if (png.startsWith('data:image/png') && png.length <= MAX_CHARS) return png;
    }
    return null;
}

export async function saveAvatar(myId, data) {
    await apiFetch('/api/profile/avatar', { method: 'PUT', body: JSON.stringify({ data }) });
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
