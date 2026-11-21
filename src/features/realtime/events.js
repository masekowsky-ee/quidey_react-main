// Names of what travels between the server, the socket and the window: one list, so a typo is a
// ReferenceError instead of a signal nobody hears. The server's side is realtime.js in the backend.
// (The API layer's own window events, SIGNED_OUT / PRO_REQUIRED / LIMIT, are in features/api/events.js.)

// ---------- Socket.IO: server to app ----------
export const MESSAGE_NEW = 'message:new';
export const INBOX_READ = 'inbox:read';
export const NOTIFICATION_NEW = 'notification:new';
export const SESSION_EVENT = 'session:event';        // chat of a shared session, with data
export const PRESENCE_CHANGED = 'presence:changed';
export const PRO_CHANGED = 'pro:changed';
export const FEED_CHEERED = 'feed:cheered';

// the data-less "load it again" signals
export const SESSION_CHANGED = 'session:changed';
export const INVITES_CHANGED = 'invites:changed';
export const FRIENDS_CHANGED = 'friends:changed';
export const TASKS_CHANGED = 'tasks:changed';
export const FAMILY_CHANGED = 'family:changed';      // { familyId }
export const FAMILY_MESSAGE = 'family:message';      // { familyId, message }
export const FEED_CHANGED = 'feed:changed';
export const AVATARS_CHANGED = 'avatars:changed';    // { userId }
export const BOARD_CHANGED = 'board:changed';        // { kind, id }
export const REMINDERS_CHANGED = 'reminders:changed';

// ---------- Socket.IO: app to server ----------
export const SESSION_JOIN = 'session:join';
export const SESSION_LEAVE = 'session:leave';

// ---------- raised by socket.js itself (to the same listeners) ----------
// fires after the connection came back, so pages load what they missed
export const REALTIME_RECONNECT = 'realtime:reconnect';
// the server turned the connection down (login no longer valid, or no access any more)
export const REALTIME_REJECTED = 'realtime:rejected';

// ---------- window events ----------
// the offline layer's state changed / the outbox was sent (features/offline/offline.js)
export const CONNECTION_EVENT = 'quidey:connection';
export const SYNCED_EVENT = 'quidey:synced';
// the service worker's message when a notification was clicked: { type, url }
export const PUSH_OPEN_MESSAGE = 'quidey:open';
