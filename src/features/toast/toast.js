// Short messages that appear at the bottom and go away by themselves ("Invite sent").
// For things worth knowing but not worth stopping for; real problems still use CustomError.

export const SHOW_TOAST = "SHOW_TOAST";
export const HIDE_TOAST = "HIDE_TOAST";

export const TOAST_MS = 4000;
const MAX_TOASTS = 3;

let nextId = 1;

// tone: 'info' | 'success' | 'error'
export const showToast = (text, tone = 'info') => (dispatch) => {
    const id = nextId++;
    dispatch({ type: SHOW_TOAST, payload: { id, text, tone } });
    setTimeout(() => dispatch(hideToast(id)), TOAST_MS);
    return id;
};

export const hideToast = (id) => ({ type: HIDE_TOAST, payload: id });

export default function toastReducer(state = [], action) {
    switch (action.type) {
        case SHOW_TOAST:
            // the same text twice in a row (double click) is shown once
            if (state.some(toast => toast.text === action.payload.text)) return state;
            return [...state, action.payload].slice(-MAX_TOASTS);
        case HIDE_TOAST:
            return state.filter(toast => toast.id !== action.payload);
        default:
            return state;
    }
}
