import { createExternalStore } from '../externalStore';
import { read as readSetting, write, remove } from '../storedSetting';

// The note shown in Home's white card instead of the task in focus (no timer, no focus link).
// Only its id is kept, on this device (localStorage `homeCardNote`); the task in focus and the
// timer are not touched by it. A small store, so the list that puts a note there and the card
// that shows it, in different places of the page, agree.
const KEY = 'homeCardNote';

const store = createExternalStore(readSetting(KEY) || null);

function set(id) {
    if (id) write(KEY, id); else remove(KEY);
    store.set(id);
}

export const pinCardNote = (id) => set(String(id));
export const clearCardNote = () => set(null);

export const useCardNote = store.use;
