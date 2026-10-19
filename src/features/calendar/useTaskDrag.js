import { useCallback, useEffect, useRef, useState } from 'react';

// How far the pointer has to move before a press becomes a drag (a shorter move is a click)
const DRAG_THRESHOLD_PX = 6;

// The day under the pointer: every drop target carries data-date="YYYY-MM-DD"
const dayAt = (x, y) => document.elementFromPoint?.(x, y)?.closest?.('[data-date]')?.dataset.date ?? null;

// Drag a task onto another day with mouse or pen. Touch keeps scrolling the page instead;
// there the day is changed in the task's editor. Escape cancels a drag.
// Returns the drag in progress ({ task, x, y, over }) for the floating chip and the
// highlighted day, startDrag for onPointerDown, and onClickCapture for the calendar's root,
// which swallows the click that ends a drag.
export function useTaskDrag(onDrop) {
    const [drag, setDrag] = useState(null);
    const onDropRef = useRef(onDrop);
    const swallowClick = useRef(false);
    const cleanupRef = useRef(null);

    useEffect(() => { onDropRef.current = onDrop; }, [onDrop]);
    // a drag in progress ends with the page
    useEffect(() => () => cleanupRef.current?.(), []);

    const startDrag = useCallback((e, task) => {
        if (e.button !== 0 || e.pointerType === 'touch' || !task || task.shared) return;
        const origin = { x: e.clientX, y: e.clientY };
        let active = false;

        const move = (ev) => {
            if (!active && Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) < DRAG_THRESHOLD_PX) return;
            if (!active) {
                active = true;
                // no text gets selected while dragging
                window.getSelection?.()?.removeAllRanges?.();
            }
            ev.preventDefault();
            setDrag({ task, x: ev.clientX, y: ev.clientY, over: dayAt(ev.clientX, ev.clientY) });
        };
        const finish = (ev, cancelled) => {
            cleanup();
            if (!active) return;
            swallowClick.current = true;
            setTimeout(() => { swallowClick.current = false; }, 0);
            setDrag(null);
            const over = cancelled ? null : dayAt(ev.clientX, ev.clientY);
            if (over) onDropRef.current?.(task, over);
        };
        const up = (ev) => finish(ev, false);
        const cancel = (ev) => finish(ev, true);
        const key = (ev) => {
            if (ev.key !== 'Escape' || !active) return;
            // the Escape only ends the drag, it doesn't close a dialog as well
            ev.stopImmediatePropagation();
            finish(ev, true);
        };
        const cleanup = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            window.removeEventListener('pointercancel', cancel);
            window.removeEventListener('keydown', key, true);
            cleanupRef.current = null;
        };

        cleanupRef.current?.();
        cleanupRef.current = () => { cleanup(); setDrag(null); };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', cancel);
        window.addEventListener('keydown', key, true);
    }, []);

    const onClickCapture = useCallback((e) => {
        if (!swallowClick.current) return;
        swallowClick.current = false;
        e.stopPropagation();
        e.preventDefault();
    }, []);

    return { drag, startDrag, onClickCapture };
}
