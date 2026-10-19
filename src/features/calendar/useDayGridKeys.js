import { useEffect, useRef } from 'react';
import { addDays, addMonths, startOfWeek, dateKey, fromKey } from './calendar';

// Keyboard for a grid of days (month and week view), like a date picker:
// arrows move a day / a week, Home and End go to the week's first and last day,
// Page Up / Page Down a month (with Shift a year), Enter or Space opens the day.
// Only one day is in the tab order (the focused one); focus follows the keys.
export function useDayGridKeys({ focusedDate, onFocusDate, onOpenDate }) {
    const gridRef = useRef(null);
    const movedByKey = useRef(false);
    const focusedKey = dateKey(focusedDate);

    // after a key moved the day, focus goes to the new day once it is rendered
    useEffect(() => {
        if (!movedByKey.current) return;
        movedByKey.current = false;
        gridRef.current?.querySelector(`[data-date="${focusedKey}"]`)?.focus();
    }, [focusedKey]);

    const onKeyDown = (e) => {
        // keys on a task inside a day are left to the task
        if (e.target.getAttribute?.('role') !== 'gridcell' || e.altKey || e.ctrlKey || e.metaKey) return;
        // the day that has focus (a click can focus a day without making it the focused date)
        const current = fromKey(e.target.dataset?.date) ?? focusedDate;
        const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
        let next = null;
        if (e.key in steps) next = addDays(current, steps[e.key]);
        else if (e.key === 'Home') next = startOfWeek(current);
        else if (e.key === 'End') next = addDays(startOfWeek(current), 6);
        else if (e.key === 'PageUp') next = addMonths(current, e.shiftKey ? -12 : -1);
        else if (e.key === 'PageDown') next = addMonths(current, e.shiftKey ? 12 : 1);
        else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenDate(current);
            return;
        }
        if (!next) return;
        e.preventDefault();
        if (dateKey(next) === focusedKey) {
            // already the focused date (the clicked day was another one): no re-render comes
            gridRef.current?.querySelector(`[data-date="${focusedKey}"]`)?.focus();
            return;
        }
        movedByKey.current = true;
        onFocusDate(next);
    };

    return { gridRef, onKeyDown, focusedKey };
}
