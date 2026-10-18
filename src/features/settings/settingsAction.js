import { SET_SHOW_MENU, SET_SHOW_DONE_TASKS, SET_CUSTOM_ERROR, SET_LANGUAGE, SET_SHOW_FORMS, SET_THEME } from "./settingsActionTypes";

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

export const setLanguage = (language) => ({
    type: SET_LANGUAGE,
    payload: language
});

export const showForms = () => ({
    type: SET_SHOW_FORMS
});

// 'dark' | 'light' | 'system'
export const setTheme = (theme) => ({
    type: SET_THEME,
    payload: theme
});
