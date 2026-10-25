import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { showForms } from '../settings/settingsAction';
import { COMMUNITY_PATHS } from '../community/paths';
import { openCommands } from '../tester/commands';

// Keyboard shortcuts, everywhere in the app while nothing is being typed: N a new task or
// event, / the command bar (as Ctrl/⌘ K), ? their overview (components/ShortcutsDialog.jsx), and
// G followed by a letter to go somewhere. Single keys only, never with Ctrl/Alt/⌘, so the
// browser's own shortcuts stay as they are.

export const OPEN_SHORTCUTS_EVENT = 'quidey:open-shortcuts';
export const openShortcuts = () => window.dispatchEvent(new Event(OPEN_SHORTCUTS_EVENT));

// G, then one of these within GO_WINDOW_MS
export const GO_KEYS = {
    h: { to: '/', label: 'shortcut_goHome' },
    k: { to: '/calendar', label: 'shortcut_goCalendar' },
    g: { to: COMMUNITY_PATHS.feed, label: 'shortcut_goCommunity' },
    p: { to: '/inbox', label: 'shortcut_goInbox' },
    s: { to: '/stats', label: 'shortcut_goStats' },
};
const GO_WINDOW_MS = 1200;

// what the overview lists: keys (a list means "one after the other") and the text
export const SHORTCUTS = [
    { keys: ['N'], label: 'shortcut_new' },
    { keys: ['/'], label: 'shortcut_search' },
    { keys: ['?'], label: 'shortcut_help' },
    ...Object.entries(GO_KEYS).map(([key, { label }]) => ({ keys: ['G', key.toUpperCase()], label })),
];

// typing somewhere (a field, an editor, a dialog's input) or a key with a modifier: not for us
function ignored(e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return true;
    const target = e.target;
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
}

// a dialog is open (an editor, the command bar, the form): the keys are its own
const dialogOpen = () => Boolean(document.querySelector('[aria-modal="true"]'));

export function useKeyboardShortcuts() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const goPressedAt = useRef(0);

    useEffect(() => {
        const onKey = (e) => {
            if (ignored(e) || dialogOpen()) return;
            const key = e.key;
            if (key === '?') {
                e.preventDefault();
                openShortcuts();
                return;
            }
            const lower = key.toLowerCase();
            if (Date.now() - goPressedAt.current < GO_WINDOW_MS && GO_KEYS[lower]) {
                e.preventDefault();
                goPressedAt.current = 0;
                navigate(GO_KEYS[lower].to);
                return;
            }
            if (lower === 'g' && !e.shiftKey) {
                goPressedAt.current = Date.now();
                return;
            }
            goPressedAt.current = 0;
            if (lower === 'n' && !e.shiftKey) {
                e.preventDefault();
                dispatch(showForms(true));
            } else if (key === '/') {
                e.preventDefault();
                openCommands();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [dispatch, navigate]);
}
