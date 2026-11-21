// The AI assistant (Quidey Max, backend ai.js POST /api/ai/assistant): the request, and the chat
// kept for this run of the app.
//
// sendAssistant(messages, language, { signal }) → { message, actions, quota }. The server reads
// only the last 10 turns, so only those are sent. Throws the API's error (status, code, data):
// 403 MAX_REQUIRED, 429 QUOTA_REACHED { resetsAt, max }, 502 AI_FAILED | AI_TIMEOUT | AI_TOO_LONG,
// 503 AI_UNAVAILABLE, 422 AI_REFUSED; an abort (closed sheet, Stop, the time limit) throws too.
//
// The chat lives here, in memory, until the app is closed (never stored): it belongs to the
// account that wrote it, so another account signed in on this device starts empty.
//   messages: [{ id, role: 'user' | 'assistant' | 'note', content, unanswered?, cards? }]
//   readAloud: the sheet's "read answers aloud" toggle (getReadAloud() = its value right now: an
//   answer is spoken by the toggle as it is when it arrives, not as it was when the message was sent)

import { createExternalStore } from '../externalStore';
import { apiFetch } from '../api/api';

const HISTORY_TURNS = 10;
// a request can take up to about 4 minutes on the server (6 model calls, each with a retry)
export const ASSISTANT_TIMEOUT_MS = 5 * 60 * 1000;
export const MESSAGE_MAX = 2000;

function historyOf(messages) {
    return messages
        .filter(m => (m.role === 'user' || m.role === 'assistant') && !m.unanswered && m.content.trim())
        .map(m => ({ role: m.role, content: m.content.slice(0, MESSAGE_MAX) }))
        .slice(-HISTORY_TURNS);
}

export async function sendAssistant(messages, language, { signal } = {}) {
    const answer = await apiFetch('/api/ai/assistant', {
        method: 'POST',
        body: JSON.stringify({ messages: historyOf(messages), language: language === 'en' ? 'en' : 'de' }),
        signal,
    });
    return { message: String(answer?.message ?? ''), actions: Array.isArray(answer?.actions) ? answer.actions : [], quota: answer?.quota ?? null };
}

// ---------- the chat of this app run ----------

const EMPTY = { owner: null, messages: [], readAloud: false };
const store = createExternalStore(EMPTY);
let nextId = 1;

const forOwner = (owner) => {
    const chat = store.get();
    return chat.owner === owner ? chat : { ...EMPTY, owner, readAloud: chat.readAloud };
};

export const newMessageId = () => nextId++;

// fn(messages) → the new messages, for this account
export function updateChat(owner, fn) {
    const current = forOwner(owner);
    store.set({ ...current, messages: fn(current.messages) });
}

export function setReadAloud(on) {
    store.set(chat => ({ ...chat, readAloud: Boolean(on) }));
}

export const getReadAloud = () => store.get().readAloud;

export function resetAssistantChat() {
    store.set(EMPTY);
}

// { messages, readAloud } of this account
export function useAssistantChat(owner) {
    const snapshot = store.use();
    return snapshot.owner === owner ? snapshot : { ...EMPTY, owner, readAloud: snapshot.readAloud };
}
