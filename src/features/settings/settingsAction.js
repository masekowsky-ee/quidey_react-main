import { SET_SHOW_MENU, SET_MENU_SIDE, SET_SHOW_DONE_TASKS, SET_CUSTOM_ERROR, SET_LANGUAGE, SET_SHOW_FORMS, SET_THEME, SET_HOME_LAYOUT, SET_ACCENT, SET_DEFAULT_SESSION_MINUTES, SET_SHOW_TUTORIAL, SET_MOTION, SET_SHOW_SHARED_TASKS, SET_PALETTE, SET_SOUND } from "./settingsActionTypes";
import { HOME_LAYOUTS, storeHomeLayout } from "./homeLayout";
import { MOTION_LEVELS, storeMotion } from "./motion";
import { SOUND_LEVELS, storeSound } from "./sound";
import { LANGUAGES, storeLanguage, ACCENTS, storeAccent, SESSION_LENGTHS, storeSessionMinutes, storeShowSharedTasks, PALETTE_NAMES, storePalette } from "./preferences";

// open: true / false; without it the menu toggles
export const setShowMenu = (open) => ({
    type: SET_SHOW_MENU,
    payload: open,
});

// the side the drawer comes in from on phones: 'left' (the usual one) or 'right' (swiped past
// the last tab, features/layout/tabSwipe.js). Menu.jsx moves it there while it is closed.
export const setMenuSide = (side) => ({
    type: SET_MENU_SIDE,
    payload: side === 'right' ? 'right' : 'left',
});

// open the drawer from one side: a side it isn't on yet is taken first (unseen, while closed),
// the drawer slides in a frame later
export const openMenu = (side = 'left') => (dispatch, getState) => {
    if (getState().settings.menuSide === side) { dispatch(setShowMenu(true)); return; }
    dispatch(setMenuSide(side));
    requestAnimationFrame(() => requestAnimationFrame(() => dispatch(setShowMenu(true))));
};

export const setShowDoneTasks = () => ({
    type: SET_SHOW_DONE_TASKS,
});

export const setCustomError = (customError) => ({
    type: SET_CUSTOM_ERROR,
    payload: customError
});

// 'de' | 'en'; remembered for the next visit
export const setLanguage = (language) => {
    if (LANGUAGES.includes(language)) storeLanguage(language);
    return {
        type: SET_LANGUAGE,
        payload: language
    };
};

// The new-task form, open from anywhere (header, Home): true / false / 'reminder' (opened on the
// testers' reminder form); without it it toggles
export const showForms = (open) => ({
    type: SET_SHOW_FORMS,
    payload: open,
});

// 'dark' | 'light' | 'system'
export const setTheme = (theme) => ({
    type: SET_THEME,
    payload: theme
});

// 'solo' | 'team'; remembered for the next visit
export const setHomeLayout = (layout) => {
    if (HOME_LAYOUTS.includes(layout)) storeHomeLayout(layout);
    return {
        type: SET_HOME_LAYOUT,
        payload: layout
    };
};

// One of ACCENTS ('green', 'ocean', ...); remembered for the next visit
export const setAccent = (accent) => {
    if (ACCENTS.includes(accent)) storeAccent(accent);
    return {
        type: SET_ACCENT,
        payload: accent
    };
};

// One of PALETTE_NAMES ('warm', 'graphite', ...); remembered for the next visit
export const setPalette = (palette) => {
    if (PALETTE_NAMES.includes(palette)) storePalette(palette);
    return {
        type: SET_PALETTE,
        payload: palette
    };
};

// Length of new sessions in minutes, one of SESSION_LENGTHS; remembered for the next visit
export const setDefaultSessionMinutes = (minutes) => {
    if (SESSION_LENGTHS.includes(minutes)) storeSessionMinutes(minutes);
    return {
        type: SET_DEFAULT_SESSION_MINUTES,
        payload: minutes
    };
};

// Opens (true) or closes (false) the intro tour
export const setShowTutorial = (show) => ({
    type: SET_SHOW_TUTORIAL,
    payload: show
});

// 'minimal' | 'normal' | 'extreme'; remembered for the next visit
export const setMotion = (level) => {
    if (MOTION_LEVELS.includes(level)) storeMotion(level);
    return {
        type: SET_MOTION,
        payload: level
    };
};

// 'off' | 'soft' | 'full'; remembered for the next visit
export const setSound = (level) => {
    if (SOUND_LEVELS.includes(level)) storeSound(level);
    return {
        type: SET_SOUND,
        payload: level
    };
};

// Whether the tasks of my shared sessions are listed among my own on Home; remembered
export const setShowSharedTasks = (show) => {
    storeShowSharedTasks(Boolean(show));
    return { type: SET_SHOW_SHARED_TASKS, payload: Boolean(show) };
};
