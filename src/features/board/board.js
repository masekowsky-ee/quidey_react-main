// Boards: notes pinned in a family or a shared session. A member pins one of their own notes
// (from the board's "Notiz anheften" or the note's "An Board heften"); the others read it as it is
// now and can't change it; the note's owner and the family's / session's owner take it off.
// API: /api/families/:id/board, /api/shared-sessions/:id/board (+ /:pinId), and
// GET /api/notebook/:id/boards (where a note of mine is pinned). Live: board:changed { kind, id }.
// kind: 'family' | 'session'. A pin: { id, noteId, title, body, color, attachments, updatedAt,
// pinnedAt, owner, mine, canRemove } (pictures with their data only from fetchBoardNote).

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../helperFunction';
import { useRealtime } from '../realtime/socket';

export const BOARD_NOTES_MAX = 30;
const BASES = { family: '/api/families', session: '/api/shared-sessions' };
const boardUrl = (kind, id) => `${BASES[kind]}/${id}/board`;

export const fetchBoard = (kind, id) => apiFetch(boardUrl(kind, id));
export const fetchBoardNote = (kind, id, pinId) => apiFetch(`${boardUrl(kind, id)}/${pinId}`);
export const pinToBoard = (kind, id, noteId) => apiFetch(boardUrl(kind, id), { method: 'POST', body: JSON.stringify({ noteId }) });
export const unpinFromBoard = (kind, id, pinId) => apiFetch(`${boardUrl(kind, id)}/${pinId}`, { method: 'DELETE' });
// [{ kind, id, pinId }]
export const fetchNoteBoards = (noteId) => apiFetch(`/api/notebook/${noteId}/boards`);

// The pins of one board (null while loading), loaded again when it changes live
export function useBoard(kind, id) {
    const [pins, setPins] = useState(null);
    // a server without boards yet answers something else: an empty board then
    const load = useCallback(() => fetchBoard(kind, id)
        .then(list => setPins(Array.isArray(list) ? list : []))
        .catch(() => setPins(prev => prev ?? [])), [kind, id]);
    useEffect(() => { load(); }, [load]);
    useRealtime('board:changed', (change) => { if (change?.kind === kind && change?.id === id) load(); });
    return { pins, setPins, reload: load };
}

// Which boards I can pin to: my families and my open sessions, [{ kind, id, name, emoji? }]
export const pinnableBoards = (families, sessions) => [
    ...(families ?? []).map(family => ({ kind: 'family', id: family.id, name: family.name, emoji: family.emoji ?? null })),
    ...(sessions ?? []).filter(session => !session.endedAt).map(session => ({ kind: 'session', id: session.id, name: session.name, emoji: null })),
];

export function boardErrorText(t, err) {
    if (err?.code === 'BOARD_FULL') return t('noteBoardFull');
    if (err?.code === 'SESSION_ENDED') return t('noteBoardSessionEnded');
    return t('noteBoardFailed');
}
