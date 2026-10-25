import { SET_SHOW_MENU, SET_SHOW_DONE_TASKS, SET_CUSTOM_ERROR, SET_LANGUAGE, SET_SHOW_FORMS, SET_THEME, SET_HOME_LAYOUT, SET_ACCENT, SET_DEFAULT_SESSION_MINUTES, SET_SHOW_TUTORIAL, SET_MOTION, SET_SHOW_SHARED_TASKS, SET_PALETTE, SET_UI_VARIANT } from "./settingsActionTypes";
import { UI_VARIANT_IDS, readStoredUiVariant } from "../tester/variants";
import { THEMES, readStoredTheme } from "./theme";
import { HOME_LAYOUTS, readStoredHomeLayout } from "./homeLayout";
import { MOTION_LEVELS, readStoredMotion } from "./motion";
import { LANGUAGES, readStoredLanguage, ACCENTS, readStoredAccent, SESSION_LENGTHS, readStoredSessionMinutes, readStoredShowSharedTasks, PALETTE_NAMES, readStoredPalette } from "./preferences";

const intitialState = {
    showMenu: false,
    showDoneTasks: false,
    showForms: false,
    showTutorial: false, // the intro tour, opened for new users and from the menu
    customError: { bool: false, message: '' },
    language: readStoredLanguage(), // 'de' | 'en', remembered in localStorage
    theme: readStoredTheme(), // 'dark' | 'light' | 'system', remembered in localStorage
    homeLayout: readStoredHomeLayout(), // 'solo' | 'team', remembered in localStorage
    accent: readStoredAccent(), // accent color palette, remembered in localStorage
    palette: readStoredPalette(), // colour palette of the ground (warm, graphite, ...), remembered in localStorage
    defaultSessionMinutes: readStoredSessionMinutes(), // length of new sessions, remembered in localStorage
    motion: readStoredMotion(), // 'minimal' | 'normal' | 'extreme', remembered in localStorage
    showSharedTasks: readStoredShowSharedTasks(), // shared sessions' tasks in Home's list, remembered in localStorage
    uiVariant: readStoredUiVariant(), // testers: the interface variant (features/tester/variants.js), remembered in localStorage
}

const settingsReducer = (state = intitialState, action) => {
    switch(action.type){
        case SET_SHOW_MENU:
            return { ...state, showMenu: typeof action.payload === 'boolean' ? action.payload : !state.showMenu };
        case SET_SHOW_DONE_TASKS:
            return { ...state, showDoneTasks: !state.showDoneTasks };
        case SET_LANGUAGE:
            return LANGUAGES.includes(action.payload) ? { ...state, language: action.payload } : state;
        case SET_CUSTOM_ERROR:
            return { ...state, customError: action.payload };
        case SET_SHOW_FORMS:
            return { ...state, showForms: typeof action.payload === 'boolean' ? action.payload : !state.showForms };
        case SET_THEME:
            return THEMES.includes(action.payload) ? { ...state, theme: action.payload } : state;
        case SET_SHOW_SHARED_TASKS:
            return { ...state, showSharedTasks: action.payload };
        case SET_HOME_LAYOUT:
            return HOME_LAYOUTS.includes(action.payload) ? { ...state, homeLayout: action.payload } : state;
        case SET_ACCENT:
            return ACCENTS.includes(action.payload) ? { ...state, accent: action.payload } : state;
        case SET_PALETTE:
            return PALETTE_NAMES.includes(action.payload) ? { ...state, palette: action.payload } : state;
        case SET_DEFAULT_SESSION_MINUTES:
            return SESSION_LENGTHS.includes(action.payload) ? { ...state, defaultSessionMinutes: action.payload } : state;
        case SET_MOTION:
            return MOTION_LEVELS.includes(action.payload) ? { ...state, motion: action.payload } : state;
        case SET_UI_VARIANT:
            return UI_VARIANT_IDS.includes(action.payload) ? { ...state, uiVariant: action.payload } : state;
        case SET_SHOW_TUTORIAL:
            return { ...state, showTutorial: Boolean(action.payload) };
        default:
            return state;
    }
}

export default settingsReducer;