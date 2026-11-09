// Press and drag, for the calendar's tasks: the month and week grid (onto another day) and the day's
// timeline (onto another time). One gesture for every pointer:
// - mouse and pen: a drag once the pointer has moved a few pixels (a shorter move is a click);
// - touch: a drag once the finger has rested on the item for a moment (a swipe before that is the
//   page scrolling, as always). From then on the page holds still and the item follows the finger.
// Near the edge of the scrolling area it scrolls along. Escape or a cancelled pointer ends it
// without a drop, and the click that ends a drag doesn't reach the item.

const DRAG_THRESHOLD_PX = 6;
// how long a finger rests before the item lifts, and how far it may wander meanwhile
export const HOLD_MS = 280;
const HOLD_SLOP_PX = 10;
// the band at a scroller's edge that scrolls along, and the fastest step per frame
const EDGE_PX = 56;
const MAX_STEP_PX = 16;

const scrollBox = (scroller) => {
    if (!scroller || scroller === window) {
        // leave room for the header on top and the tab bar below
        return { top: 64, bottom: window.innerHeight - 88 };
    }
    const rect = scroller.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom };
};

// scrolls by dy; false when it couldn't (already at the end)
const scrollBy = (scroller, dy) => {
    if (!scroller || scroller === window) {
        const before = window.scrollY;
        window.scrollBy?.(0, dy);
        return window.scrollY !== before;
    }
    const before = scroller.scrollTop;
    scroller.scrollTop += dy;
    return scroller.scrollTop !== before;
};

// e: the pointerdown. handlers:
//   onStart(point)   the drag begins (point: { x, y })
//   onMove(point)    the pointer moved, or the area scrolled under it
//   onDrop(point)    released
//   onCancel()       ended without a drop (Escape, the browser took the pointer)
//   scroller()       the element (or window) to scroll at the edges; none: no scrolling along
// Returns false when the press can't become a drag (another button).
export function pressDrag(e, { onStart, onMove, onDrop, onCancel, scroller } = {}) {
    if (e.button !== 0) return false;
    const touch = e.pointerType === 'touch';
    const origin = { x: e.clientX, y: e.clientY };
    let point = origin;
    let active = false;
    let holdTimer = null;
    let frame = 0;
    const scrollEl = () => scroller?.() ?? null;

    const edgeScroll = () => {
        frame = 0;
        if (!active || !scroller) return;
        const el = scrollEl();
        const { top, bottom } = scrollBox(el);
        let dy = 0;
        if (point.y < top + EDGE_PX) dy = -Math.ceil(((top + EDGE_PX - point.y) / EDGE_PX) * MAX_STEP_PX);
        else if (point.y > bottom - EDGE_PX) dy = Math.ceil(((point.y - (bottom - EDGE_PX)) / EDGE_PX) * MAX_STEP_PX);
        // outside the band, or at the end of what scrolls: wait for the pointer to move again
        if (dy === 0 || !scrollBy(el, Math.max(-MAX_STEP_PX, Math.min(MAX_STEP_PX, dy)))) return;
        // what lies under the pointer changed with the scroll
        onMove?.(point);
        frame = requestAnimationFrame(edgeScroll);
    };
    const keepScrolling = () => {
        if (!frame && typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(edgeScroll);
    };

    const activate = () => {
        holdTimer = null;
        active = true;
        // no text gets selected while dragging
        window.getSelection?.()?.removeAllRanges?.();
        // the finger covers the item: a short tick says it's lifted (where the device can)
        if (touch) {
            try { navigator.vibrate?.(8); } catch { /* not allowed */ }
        }
        onStart?.(point);
        onMove?.(point);
    };

    const move = (ev) => {
        point = { x: ev.clientX, y: ev.clientY };
        if (!active) {
            const distance = Math.hypot(point.x - origin.x, point.y - origin.y);
            if (touch) {
                // moved before the hold was up: that's a scroll, not a drag
                if (distance > HOLD_SLOP_PX) finish(true);
                return;
            }
            if (distance < DRAG_THRESHOLD_PX) return;
            activate();
            return;
        }
        ev.preventDefault();
        onMove?.(point);
        keepScrolling();
    };

    // while a finger drags, the page doesn't scroll under it (needs a listener that isn't passive)
    const touchMove = (ev) => { if (active) ev.preventDefault(); };
    // a long press would open the browser's menu for the item
    const contextMenu = (ev) => { if (touch) ev.preventDefault(); };
    const up = () => finish(false);
    const cancel = () => finish(true);
    const key = (ev) => {
        if (ev.key !== 'Escape' || !active) return;
        // the Escape only ends the drag, it doesn't close a dialog as well
        ev.stopImmediatePropagation();
        ev.preventDefault();
        finish(true);
    };

    // the click that follows a drag (on the item or whatever is under the pointer) is swallowed
    const swallowClick = () => {
        const swallow = (ev) => {
            ev.stopPropagation();
            ev.preventDefault();
            stop();
        };
        const stop = () => window.removeEventListener('click', swallow, true);
        window.addEventListener('click', swallow, true);
        // a mouse's click comes right after its pointerup; a finger's may lag a little
        setTimeout(stop, touch ? 350 : 0);
    };

    const cleanup = () => {
        if (holdTimer) clearTimeout(holdTimer);
        holdTimer = null;
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', cancel);
        window.removeEventListener('keydown', key, true);
        window.removeEventListener('touchmove', touchMove);
        window.removeEventListener('contextmenu', contextMenu, true);
    };

    function finish(cancelled) {
        const wasActive = active;
        active = false;
        cleanup();
        if (!wasActive) return;
        swallowClick();
        if (cancelled) onCancel?.();
        else onDrop?.(point);
    }

    if (touch) holdTimer = setTimeout(activate, HOLD_MS);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', key, true);
    window.addEventListener('touchmove', touchMove, { passive: false });
    window.addEventListener('contextmenu', contextMenu, true);

    // to end it from outside (the page goes away mid-drag)
    return () => finish(true);
}
