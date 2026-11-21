import { apiFetch } from './api';

// A thunk that loads `url` and puts the answer into the store as { type, payload }.
// `pick` shapes the answer first; the answer is also returned.
// (Its own file, so tests that replace apiFetch in api.js replace it here too.)
export const loadInto = (type, url, options, pick = (data) => data) => async (dispatch) => {
    const data = options === undefined ? await apiFetch(url) : await apiFetch(url, options);
    dispatch({ type, payload: pick(data) });
    return data;
};
