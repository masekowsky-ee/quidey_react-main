import { useCallback, useEffect, useRef, useState } from 'react';
import { pressDrag } from './pressDrag';

// The day under the pointer: every drop target carries data-date="YYYY-MM-DD"
const dayAt = (x, y) => document.elementFromPoint?.(x, y)?.closest?.('[data-date]')?.dataset.date ?? null;

// Drag a task onto another day in the month or week grid: with a mouse or pen right away, with a
// finger after resting on it a moment (see pressDrag). The page scrolls along at its edges, Escape
// cancels. Returns the drag in progress ({ task, x, y, over }) for the floating chip and the
// highlighted day, and startDrag for onPointerDown. The click that ends a drag is swallowed.
export function useTaskDrag(onDrop) {
    const [drag, setDrag] = useState(null);
    const onDropRef = useRef(onDrop);
    const endRef = useRef(null);

    useEffect(() => { onDropRef.current = onDrop; }, [onDrop]);
    // a drag in progress ends with the page
    useEffect(() => () => endRef.current?.(), []);

    const startDrag = useCallback((e, task) => {
        // a task a friend shared with me stays on their day
        if (!task || task.shared) return;
        endRef.current?.();
        const end = pressDrag(e, {
            onMove: ({ x, y }) => setDrag({ task, x, y, over: dayAt(x, y) }),
            onDrop: ({ x, y }) => {
                setDrag(null);
                const over = dayAt(x, y);
                if (over) onDropRef.current?.(task, over);
            },
            onCancel: () => setDrag(null),
            scroller: () => window,
        });
        endRef.current = end || null;
    }, []);

    return { drag, startDrag };
}
