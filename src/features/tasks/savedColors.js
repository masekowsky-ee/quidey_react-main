// My own colours for the colour pickers: "#rrggbb" picked on the colour wheel and kept with the
// account (users.saved_colors, `savedColors` from /api/me, PUT /api/users/colors), so every picker
// (tasks, groups, event types, subjects, collections, notes) on every device offers them beside the
// eight named ones. Newest first, each once, at most SAVED_COLORS_MAX.
import { useSelector } from 'react-redux';
import { apiFetch } from '../helperFunction';
import { SAVED_COLORS_SET } from '../auth/authActionTypes';
import { isOwnColor } from './taskColors';

export const SAVED_COLORS_MAX = 16;

export const selectSavedColors = (state) => state.auth.access.savedColors ?? [];
export const useSavedColors = () => useSelector(selectSavedColors);

// shown at once; the server's answer is the list that counts (it is put back on a failure)
const save = (next) => async (dispatch, getState) => {
    const before = selectSavedColors(getState());
    dispatch({ type: SAVED_COLORS_SET, payload: next });
    try {
        const { savedColors } = await apiFetch('/api/users/colors', { method: 'PUT', body: JSON.stringify({ colors: next }) });
        dispatch({ type: SAVED_COLORS_SET, payload: savedColors });
        return savedColors;
    } catch (err) {
        dispatch({ type: SAVED_COLORS_SET, payload: before });
        throw err;
    }
};

// a new one goes first; one already there moves first; past the limit the oldest goes
export const addSavedColor = (hex) => (dispatch, getState) => {
    const color = String(hex).toLowerCase();
    if (!isOwnColor(color)) return Promise.resolve(selectSavedColors(getState()));
    const next = [color, ...selectSavedColors(getState()).filter(c => c !== color)].slice(0, SAVED_COLORS_MAX);
    return dispatch(save(next));
};

export const removeSavedColor = (hex) => (dispatch, getState) =>
    dispatch(save(selectSavedColors(getState()).filter(c => c !== String(hex).toLowerCase())));
