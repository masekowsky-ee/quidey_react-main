import { read, write } from '../storedSetting';

// Home page layout: 'solo' (own tasks and timer) or 'team' (a workspace for shared sessions).
// Remembered in localStorage like the theme; storage can throw, so this never assumes it works.

export const HOME_LAYOUTS = ['solo', 'team'];
const STORAGE_KEY = 'homeLayout';

export const readStoredHomeLayout = () => read(STORAGE_KEY, { allowed: HOME_LAYOUTS, fallback: 'solo' });
export const storeHomeLayout = (layout) => write(STORAGE_KEY, layout);
