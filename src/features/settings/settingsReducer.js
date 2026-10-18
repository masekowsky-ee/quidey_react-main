import { SET_SHOW_MENU, SET_SHOW_DONE_TASKS, SET_CUSTOM_ERROR, SET_LANGUAGE, SET_SHOW_FORMS, SET_THEME } from "./settingsActionTypes";
import { THEMES, readStoredTheme } from "./theme";

const intitialState = {
    showMenu: false,
    showDoneTasks: false,
    showForms: false,
    customError: { bool: false, message: '' },
    language: 'de',
    theme: readStoredTheme(), // 'dark' | 'light' | 'system', remembered in localStorage
}

const settingsReducer = (state = intitialState, action) => {
    switch(action.type){
        case SET_SHOW_MENU:
            return { ...state, showMenu: !state.showMenu };
        case SET_SHOW_DONE_TASKS:
            return { ...state, showDoneTasks: !state.showDoneTasks };
        case SET_LANGUAGE:
            return { ...state, language: action.payload };
        case SET_CUSTOM_ERROR:
            return { ...state, customError: action.payload };
        case SET_SHOW_FORMS:
            return { ...state, showForms: !state.showForms };
        case SET_THEME:
            return THEMES.includes(action.payload) ? { ...state, theme: action.payload } : state;
        default:
            return state;
    }
}

export default settingsReducer;