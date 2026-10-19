import { SET_SHOW_MENU, SET_SHOW_DONE_TASKS, SET_CUSTOM_ERROR, SET_LANGUAGE, SET_SHOW_FORMS, SET_THEME, SET_HOME_LAYOUT, SET_ACCENT, SET_DEFAULT_SESSION_MINUTES } from "./settingsActionTypes";
import { HOME_LAYOUTS, storeHomeLayout } from "./homeLayout";
import { LANGUAGES, storeLanguage, ACCENTS, storeAccent, SESSION_LENGTHS, storeSessionMinutes } from "./preferences";

export const setShowMenu = () => ({
    type: SET_SHOW_MENU,
});

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

export const showForms = () => ({
    type: SET_SHOW_FORMS
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

// Length of new sessions in minutes, one of SESSION_LENGTHS; remembered for the next visit
export const setDefaultSessionMinutes = (minutes) => {
    if (SESSION_LENGTHS.includes(minutes)) storeSessionMinutes(minutes);
    return {
        type: SET_DEFAULT_SESSION_MINUTES,
        payload: minutes
    };
};
