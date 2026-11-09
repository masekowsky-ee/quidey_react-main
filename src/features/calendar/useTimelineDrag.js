import { useCallback, useEffect, useRef, useState } from 'react';
import { pressDrag } from './pressDrag';
import { minutesOfDay, timeText } from './calendar';

// the timeline moves in quarter hours
export const SNAP_MINUTES = 15;
const LAST_START = 24 * 60 - SNAP_MINUTES;

export const snapMinutes = (minutes) =>
    Math.max(0, Math.min(LAST_START, Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES));

// Dragging inside the day's timeline (DayPanel): a task or event goes to another time (the hour
// grid), loses its time (the all-day row, [data-drop-allday]) or goes to the day before or after
// (the head's arrows, [data-drop-day="YYYY-MM-DD"]). gridRef: the 24-hour grid, scrollerRef: the
// box it scrolls in (it scrolls along at its edges). onMove(task, changes) saves the change.
// Returns the drag in progress ({ task, x, y, target: 'time' | 'allday' | 'day' | null, minutes,
// day }) and startDrag(e, task) for onPointerDown.
export function useTimelineDrag({ gridRef, scrollerRef, onMove }) {
    const [drag, setDrag] = useState(null);
    const onMoveRef = useRef(onMove);
    const endRef = useRef(null);

    useEffect(() => { onMoveRef.current = onMove; }, [onMove]);
    useEffect(() => () => endRef.current?.(), []);

    const startDrag = useCallback((e, task) => {
        if (!task || task.projected || task.shared) return;
        // where in the block it was grabbed, so it doesn't jump under the finger
        const block = e.currentTarget.closest?.('[data-block]');
        const grabOffset = block ? e.clientY - block.getBoundingClientRect().top : 12;

        const where = ({ x, y }) => {
            const el = document.elementFromPoint?.(x, y);
            const day = el?.closest?.('[data-drop-day]')?.dataset.dropDay;
            if (day) return { target: 'day', day };
            if (el?.closest?.('[data-drop-allday]')) return { target: 'allday' };
            const grid = gridRef.current;
            const scroller = scrollerRef.current;
            if (!grid || !scroller) return { target: null };
            const box = scroller.getBoundingClientRect();
            const rect = grid.getBoundingClientRect();
            if (x < box.left || x > box.right || y < box.top || y > box.bottom) return { target: null };
            const hour = rect.height / 24;
            if (!hour) return { target: null };
            return { target: 'time', minutes: snapMinutes(((y - grabOffset - rect.top) / hour) * 60) };
        };

        endRef.current?.();
        const end = pressDrag(e, {
            onMove: (point) => setDrag({ task, ...point, ...where(point) }),
            onDrop: (point) => {
                setDrag(null);
                const spot = where(point);
                const start = minutesOfDay(task.due_time);
                let changes = null;
                if (spot.target === 'time' && spot.minutes !== start) changes = { due_time: timeText(spot.minutes) };
                else if (spot.target === 'allday' && start !== null) changes = { due_time: null };
                else if (spot.target === 'day') changes = { due: spot.day };
                if (changes) onMoveRef.current?.(task, changes);
            },
            onCancel: () => setDrag(null),
            scroller: () => scrollerRef.current,
        });
        endRef.current = end || null;
    }, [gridRef, scrollerRef]);

    return { drag, startDrag };
}
