import { useEffect, useRef, useState } from 'react';

// The dialogs that are open, the last one on top: Escape only answers the top one.
const open = [];

// What every modal does besides looking like one: focus goes to `initialFocus` once it is
// there and back to where it was when it goes; Escape asks it to close, but only the topmost open
// dialog answers (one Escape closes one dialog) and only once per press.
// Default: caught first (capture) so nothing behind reacts, e.g. an editor under a question.
// `nested`: for a dialog with fields or popovers of its own that close on Escape first: it
// listens last (bubble) and leaves an Escape that something inside already took (defaultPrevented).
export function useModal(onClose, { initialFocus, nested = false } = {}) {
    const closeRef = useRef(onClose);
    useEffect(() => { closeRef.current = onClose; });
    // read while rendering: before any child's effect moves the focus
    const [previous] = useState(() => (typeof document === 'undefined' ? null : document.activeElement));

    useEffect(() => {
        (typeof initialFocus === 'function' ? initialFocus() : initialFocus?.current)?.focus();
        return () => previous?.focus?.();
    // the first render's focus only
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const token = {};
        open.push(token);
        const onKey = (e) => {
            if (e.key !== 'Escape' || open.at(-1) !== token) return;
            if (nested && e.defaultPrevented) return;
            e.preventDefault();
            if (!nested) e.stopPropagation();
            closeRef.current();
        };
        window.addEventListener('keydown', onKey, !nested);
        return () => {
            window.removeEventListener('keydown', onKey, !nested);
            open.splice(open.indexOf(token), 1);
        };
    }, [nested]);
}
