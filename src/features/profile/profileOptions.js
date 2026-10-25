import { apiFetch } from '../helperFunction';
import { TASK_COLORS } from '../tasks/taskColors';

// What a profile can be set up with. The api checks the same lists (index.js, "Profiles").
// Colours are the task colours (their tones live in index.css as --task-color); none = the
// viewer's accent colour.
export const PROFILE_COLORS = TASK_COLORS;
// Most of them come with levels (src/features/progress/progress.js): the order here is the order
// they unlock in, so the lists read from "always there" to "rare"
export const PROFILE_BANNERS = ['gradient', 'dots', 'stripes', 'grid', 'aurora', 'glow', 'rings', 'topo', 'sky'];
export const DEFAULT_BANNER = 'gradient';
export const PROFILE_EMOJIS = [
    '📚', '✏️', '🎧', '☕', '🌱', '🔥', '⭐', '🚀', '🧠', '🎯',
    '🌙', '☀️', '🐱', '🐶', '🦊', '🐼', '🐸', '🦉', '🌸', '🍀',
    '🎨', '🎸', '⚽', '💻', '🧪', '📐', '🌍', '🎮', '🍕', '🦄',
    '🪐', '🐉', '🦋', '🌊', '🏔️', '🎻', '🧩', '🪴', '🦕', '👾',
];
// a ring around the avatar; none is always there
export const AVATAR_FRAMES = ['ring', 'double', 'dotted', 'orbit'];

export const BIO_MAX = 280;
export const STATUS_MAX = 80;
export const STUDY_MAX = 60;
export const INTERESTS_MAX = 6;
export const INTEREST_MAX = 24;

// The data-task-color attribute that tints an avatar or banner, or nothing (accent colour)
export const profileColorAttr = (profile) =>
    PROFILE_COLORS.includes(profile?.color) ? profile.color : undefined;

// My own profile, with all my statistics
export function fetchOwnProfile() {
    return apiFetch('/api/profile');
}

// Somebody's profile by username. Friends get everything they may see; everybody else only
// { id, username, displayName, relation }. Rejects with code USER_NOT_FOUND for unknown names.
export function fetchProfile(username) {
    return apiFetch(`/api/profiles/${encodeURIComponent(username)}`);
}

// Saves the given fields of my profile ({ bio, status, study, interests, color, banner, emoji,
// frame, title, showcase, showStats, shareActivity }); answers with my whole profile. A choice
// my level hasn't unlocked is refused with code LEVEL_LOCKED (and the `level` it needs).
export function saveProfile(fields) {
    return apiFetch('/api/profile', { method: 'PUT', body: JSON.stringify(fields) });
}
