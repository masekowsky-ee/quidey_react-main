// Short messages that appear at the bottom and go away by themselves ("Invite sent").
// For things worth knowing but not worth stopping for; real problems still use CustomError.

export const SHOW_TOAST = "SHOW_TOAST";
export const HIDE_TOAST = "HIDE_TOAST";

export const TOAST_MS = 4000;
const MAX_TOASTS = 3;

let nextId = 1;

// Something that came in (a message, a notice) stays a little longer and can be opened
export const LINK_TOAST_MS = 7000;

// One that can be undone stays long enough to reach its button
export const ACTION_TOAST_MS = 6000;

// what a toast's button does (functions stay out of the store), by toast id
const actions = new Map();

// tone: 'info' | 'success' | 'error'
// options.to: a route; clicking the toast goes there (e.g. the conversation)
// options.detail: a second line, e.g. the start of the message
// options.action: { label, run } a button on the toast, e.g. "Undo"
export const showToast = (text, tone = 'info', { to, detail, action } = {}) => (dispatch) => {
    const id = nextId++;
    if (action) actions.set(id, action.run);
    dispatch({ type: SHOW_TOAST, payload: { id, text, tone, ...(to && { to }), ...(detail && { detail }), ...(action && { actionLabel: action.label }) } });
    setTimeout(() => {
        actions.delete(id);
        dispatch(hideToast(id));
    }, action ? ACTION_TOAST_MS : to ? LINK_TOAST_MS : TOAST_MS);
    return id;
};

// The toast's button was pressed: its action runs once and the toast goes
export const runToastAction = (id) => (dispatch) => {
    const run = actions.get(id);
    actions.delete(id);
    dispatch(hideToast(id));
    return run?.();
};

export const hideToast = (id) => ({ type: HIDE_TOAST, payload: id });

export default function toastReducer(state = [], action) {
    switch (action.type) {
        case SHOW_TOAST:
            // the same text twice in a row (double click) is shown once
            if (state.some(toast => toast.text === action.payload.text && toast.detail === action.payload.detail)) return state;
            return [...state, action.payload].slice(-MAX_TOASTS);
        case HIDE_TOAST:
            return state.filter(toast => toast.id !== action.payload);
        default:
            return state;
    }
}
