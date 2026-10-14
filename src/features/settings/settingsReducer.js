import { SET_SHOW_MENU, SET_SHOW_DONE_TASKS, SET_CUSTOM_ERROR, SET_LANGUAGE, SET_SHOW_FORMS } from "./settingsActionTypes";

const intitialState = {
    showMenu: false,
    showDoneTasks: false,
    showForms: false,
    customError: { bool: false, message: '' },
    language: 'de',
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
        default:
            return state;
    }
}

export default settingsReducer;