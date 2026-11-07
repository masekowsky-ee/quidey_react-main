import { apiFetch } from '../helperFunction';
import { fetchAccess } from '../auth/authAction';

// Admin panel requests. The panel keeps the lists in its own state, so these just
// return what the API answers; anything that changes the open-request count refreshes
// my access (the badge in the menu comes from there).

export const fetchAdminOverview = () => () => apiFetch('/api/admin/overview');

// status: 'pending' | 'all'
export const fetchBetaRequests = (status = 'pending') => () =>
    apiFetch(`/api/admin/requests${status === 'all' ? '?status=all' : ''}`);

export const fetchAdminUsers = (query = '') => () =>
    apiFetch(`/api/admin/users${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`);

// A change that answers with the updated user; afterwards my access (and the badge) is refreshed
const adminChange = (url, options) => async (dispatch) => {
    const user = await apiFetch(url, options);
    dispatch(fetchAccess()).catch(() => {});
    return user;
};

// decision: 'approve' | 'decline'. Resolves to the updated user.
export const decideBetaRequest = (userId, decision) =>
    adminChange(`/api/admin/requests/${userId}/${decision}`, { method: 'POST' });

// Forgets a request so the user can ask again
export const resetBetaRequest = (userId) =>
    adminChange(`/api/admin/requests/${userId}`, { method: 'DELETE' });

// changes: { isPro?, isAdmin?, isTester? }. Not for myself (the server refuses with code SELF),
// and an owner's admin can't be taken away (code OWNER).
export const updateAdminUser = (userId, changes) =>
    adminChange(`/api/admin/users/${userId}`, { method: 'PATCH', body: JSON.stringify(changes) });

// Usage totals. params: { from, to, platform?, language?, plan? } (dates YYYY-MM-DD, local);
// empty filters are left out. The raw hourly rows only for the export (400 USAGE_RANGE_TOO_BIG
// when the range has too many).
export function usageQuery({ from, to, platform, language, plan } = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ from, to, platform, language, plan })) if (value) query.set(key, value);
    return query.toString();
}

export const fetchAdminUsage = (params) => () => apiFetch(`/api/admin/usage?${usageQuery(params)}`);

export const fetchAdminUsageRaw = (params) => () => apiFetch(`/api/admin/usage/raw?${usageQuery(params)}`);

// Translated message for an admin API error (keys adminError_<code>)
export function adminErrorText(t, err) {
    const key = `adminError_${err?.code}`;
    return t(key) === key ? t('friendError_generic') : t(key);
}

export const selectIsAdmin = (state) => state.auth.access.isAdmin;
export const selectAdminPendingCount = (state) => state.auth.access.adminPendingCount;
