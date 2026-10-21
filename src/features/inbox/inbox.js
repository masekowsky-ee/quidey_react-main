import { apiFetch, displayName, fill } from '../helperFunction';

// The inbox: direct messages between friends, notifications (e.g. an admin's broadcast),
// requests (friendships, session and task invites, kept in their own slices) and reminders
// (worked out from the tasks). Only the unread counts live in the store, for the menu badge;
// the lists are loaded by the inbox page. New messages and notices arrive live over the socket
// (see ../realtime/socket.js and useInboxRealtime.js).

const SET_INBOX_UNREAD = 'SET_INBOX_UNREAD';
const initialState = { messages: 0, notifications: 0 };

export default function inboxReducer(state = initialState, action) {
    if (action.type === SET_INBOX_UNREAD) return { ...state, ...action.payload };
    return state;
}

export const setInboxUnread = (counts) => ({ type: SET_INBOX_UNREAD, payload: counts });

// { messages, notifications } not read yet
export const fetchInboxUnread = () => async (dispatch) => {
    const counts = await apiFetch('/api/inbox/unread');
    dispatch(setInboxUnread(counts));
    return counts;
};

// Everything in the inbox that waits for me: unread messages and notifications, and open
// requests (friendship, session invite, shared task)
export const selectInboxCount = (state) =>
    state.inbox.messages + state.inbox.notifications
    + state.friends.incoming.length + state.together.invites.length + state.task.invites.length;

// Everything any menu entry has a badge for (the inbox, and for admins the open beta requests):
// shown on the menu button, so it's visible with the menu closed
export const selectMenuBadgeCount = (state) =>
    selectInboxCount(state) + (state.auth.access.isAdmin ? state.auth.access.adminPendingCount ?? 0 : 0);

// ---------- messages ----------

// [{ user, lastMessage: { body, fromMe, createdAt, readAt }, unread }], newest first
export const fetchConversations = () => apiFetch('/api/messages');

// { user, canWrite, messages: [{ id, fromMe, body, createdAt, readAt }] }; marks them read
export const fetchConversation = (userId) => apiFetch(`/api/messages/${userId}`);

// The conversation is open and a message came in live: mark it read
export const markConversationRead = (userId) => apiFetch(`/api/messages/${userId}/read`, { method: 'POST' });

// Rejects with the API error (error.code: NOT_FRIENDS, INVALID_MESSAGE, RATE_LIMITED)
export const sendMessage = (userId, body) =>
    apiFetch(`/api/messages/${userId}`, { method: 'POST', body: JSON.stringify({ body }) });

// ---------- notifications ----------

export const fetchNotifications = () => apiFetch('/api/notifications');

// How a notice reads and where it leads: { title, body, to? }. An admin's broadcast brings its
// own words; for a task given to me in a session (kind task_assigned, title = task, body =
// session) the words are made here, in my language, and it leads to the session.
export function noticeView(t, notice) {
    if (notice.kind === 'task_assigned' && notice.data) {
        return {
            title: fill(t('noticeTaskAssigned'), { name: displayName(notice.data.by), task: notice.title }),
            body: fill(t('noticeTaskAssignedIn'), { session: notice.body }),
            to: `/together/${notice.data.sessionId}`,
        };
    }
    return { title: notice.title, body: notice.body };
}
export const markNotificationsRead = () => apiFetch('/api/notifications/read', { method: 'POST' });
export const deleteNotification = (id) => apiFetch(`/api/notifications/${id}`, { method: 'DELETE' });

// ---------- feedback ----------

export const FEEDBACK_CATEGORIES = ['idea', 'bug', 'praise', 'other'];

// Mailed to the operator. Rejects with the API error (error.code: INVALID_MESSAGE, RATE_LIMITED, SEND_FAILED)
export const sendFeedback = (category, message) =>
    apiFetch('/api/feedback', { method: 'POST', body: JSON.stringify({ category, message }) });

// ---------- admin ----------

export const fetchBroadcasts = () => apiFetch('/api/admin/broadcasts');

// A notice to every account; { id, recipientCount, createdAt }
export const sendBroadcast = (title, body) =>
    apiFetch('/api/admin/broadcasts', { method: 'POST', body: JSON.stringify({ title, body }) });
