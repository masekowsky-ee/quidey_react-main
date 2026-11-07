import styles from '../CalendarDay.module.css';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { displayName, fill, isOverdue, sameDay } from '../../features/helperFunction';
import { layoutDay, minutesOfDay, prioLevel, taskTimeText, timeText } from '../../features/calendar/calendar';
import { taskColorAttr } from '../../features/tasks/taskColors';
import { isEvent } from '../../features/tasks/kinds';
import TaskMeta from '../task/TaskMeta.jsx';
import TaskLabels from '../TaskLabels.jsx';
import Icon from './icons.jsx';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const PRIO_CLASS = { high: styles.prioHigh, medium: styles.prioMedium, low: styles.prioLow };

// The shortest a block is drawn, in minutes: on a touch screen tall enough to hit with a finger
const coarsePointer = () => Boolean(window.matchMedia?.('(pointer: coarse)')?.matches);
const minLength = () => (coarsePointer() ? 45 : 30);
// a block shorter than this puts time and name on one line and leaves the details out
const SHORT_MINUTES = 45;

const nowMinutes = () => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
};

// The day as a column of hours: entries without a time in a row on top, the timed ones as blocks
// at their time and length. A block opens its editor; dragging it (a finger: hold first) moves it
// to another time, into the top row (no time) or onto the arrows in the head (another day).
// With the keyboard, Alt + arrow up/down moves the focused one by a quarter hour.
// A tap (click) on a free spot of the hours opens the new-task form at that quarter hour
// (onCreateAt(minutes)); with a mouse the spot shows where it would go.
export default function DayTimeline({
    date, dayKey, today, tasks, personal, drag, startDrag, gridRef, scrollerRef, pending,
    onOpen, onToggleDone, onShiftTime, onOpenGroup, onCreateAt, children,
}) {
    const { t } = useTranslation();
    const isToday = sameDay(date, today);
    const [now, setNow] = useState(nowMinutes);
    // the free spot under the mouse (minutes), where a click would add
    const [hoverSlot, setHoverSlot] = useState(null);

    // the quarter hour at a point of the hours, null on an entry (or without a layout)
    const slotAt = (e) => {
        if (e.target.closest?.('[data-block]')) return null;
        const rect = gridRef.current?.getBoundingClientRect();
        const hour = rect ? rect.height / 24 : 0;
        if (!hour) return null;
        const minutes = Math.floor(((e.clientY - rect.top) / hour) * 4) * 15;
        return Math.max(0, Math.min(24 * 60 - 15, minutes));
    };
    const onGridClick = (e) => {
        const minutes = slotAt(e);
        if (minutes !== null) onCreateAt(minutes);
    };
    const onGridHover = (e) => {
        if (e.pointerType !== 'mouse' || drag) return;
        setHoverSlot(slotAt(e));
    };

    // the line for now moves with the clock
    useEffect(() => {
        if (!isToday) return undefined;
        const id = setInterval(() => setNow(nowMinutes()), 30 * 1000);
        return () => clearInterval(id);
    }, [isToday]);

    // a change being saved already shows where it goes
    const shown = useMemo(() => tasks.map(task => (pending?.id === task.id ? { ...task, ...pending.changes } : task)), [tasks, pending]);
    const allDay = shown.filter(task => minutesOfDay(task.due_time) === null);
    const blocks = useMemo(() => {
        const shortest = minLength();
        return layoutDay(shown
            .filter(task => minutesOfDay(task.due_time) !== null)
            .map(task => {
                const start = minutesOfDay(task.due_time);
                const length = Math.max(shortest, Number(task.duration_minutes) || 0);
                return { task, start, end: Math.min(24 * 60, start + length) };
            }));
    }, [shown]);

    // opening a day (or going to another) scrolls to where it starts: now on today, else the first
    // timed entry, else the morning; an hour of context above it
    const firstStart = blocks[0]?.start ?? null;
    useLayoutEffect(() => {
        const scroller = scrollerRef.current;
        const grid = gridRef.current;
        if (!scroller || !grid) return;
        const hour = grid.getBoundingClientRect().height / 24;
        const anchor = isToday ? nowMinutes() : firstStart ?? 8 * 60;
        // from the full hour before it, so no entry starts cut off at the top
        const fromHour = Math.max(0, Math.floor(anchor / 60) - 1);
        scroller.scrollTop = Math.max(0, grid.offsetTop + fromHour * hour);
        // only when the day changes, not with every edit
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dayKey]);

    const onEntryKey = (e, task) => {
        if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || task.projected) return;
        e.preventDefault();
        e.stopPropagation();
        onShiftTime(task, e.key === 'ArrowUp' ? -15 : 15);
    };

    // the press that starts a drag: anywhere on the entry but its own controls (tick, link, label)
    const onEntryPointerDown = (e, task) => {
        if (e.target.closest?.('a, button:not([data-entry-open])')) return;
        startDrag(e, task);
    };

    const hintId = `timelineHint-${dayKey}`;

    // one entry: a block on the hours (timed) or a row on top (all day). The name is the button that
    // opens it; its hit area covers the whole entry, the details and labels sit above it.
    const entry = (task, { timed, short = false, place = null }) => {
        const event = isEvent(task);
        const classes = [
            timed ? styles.block : styles.allDayItem,
            event ? styles.entryEvent : PRIO_CLASS[prioLevel(task.prio)],
            task.done && styles.entryDone,
            task.projected && styles.entryPreview,
            isOverdue(task, today) && styles.entryOverdue,
            drag?.task.id === task.id && styles.entryDragging,
        ].filter(Boolean).join(' ');
        const byWhom = !personal && task.addedBy ? fill(t('addedByName'), { name: displayName(task.addedBy) }) : null;
        return (
            <li key={task.id} className={classes} data-task-color={taskColorAttr(task)} data-block=""
                data-short={short ? '' : undefined} style={place ?? undefined}
                onPointerDown={(e) => onEntryPointerDown(e, task)}>
                {!event && !task.projected &&
                    <button type="button" className={styles.blockCheck} aria-pressed={Boolean(task.done)} onClick={() => onToggleDone(task)}
                        aria-label={`${t(task.done ? 'reopen' : 'markDone')}: ${task.name}`} title={t(task.done ? 'reopen' : 'markDone')}>
                        <span className={styles.checkCircle}><Icon name="check" size={12} /></span>
                    </button>}
                <div className={styles.entryText}>
                    {timed &&
                        <span className={styles.blockTime}>
                            {task.projected && <Icon name="repeat" size={12} />}
                            {taskTimeText(task)}
                        </span>}
                    <button type="button" className={styles.entryOpen} data-entry-open=""
                        aria-label={task.projected ? `${t('repeatPreview')}: ${task.name}` : `${t('editTask')}: ${task.name}`}
                        aria-describedby={task.projected ? undefined : hintId}
                        onClick={() => onOpen(task)} onKeyDown={(e) => onEntryKey(e, task)}>
                        {!timed && task.projected && <Icon name="repeat" size={12} />}
                        <span className={styles.entryName}>{task.name}</span>
                    </button>
                    {!short && <TaskMeta task={task} showTime={false} />}
                    {!short && personal && <TaskLabels task={task} onOpenGroup={onOpenGroup} />}
                    {/* in a shared calendar who added it matters, on a short block too */}
                    {byWhom && <span className={styles.entryMeta}>{byWhom}</span>}
                </div>
            </li>
        );
    };

    const preview = drag?.target === 'time' ? {
        start: drag.minutes,
        length: Math.min(Math.max(minLength(), Number(drag.task.duration_minutes) || 0), 24 * 60 - drag.minutes),
    } : null;

    return (
        <div className={styles.timelineWrap}>
            <span id={hintId} className={styles.srOnly}>{t('timelineMoveHint')}</span>
            <div className={`${styles.allDay} ${drag?.target === 'allday' ? styles.dropOn : ''}`} data-drop-allday="">
                <span className={styles.allDayLabel}>{t('allDay')}</span>
                {allDay.length > 0
                    ? <ul className={styles.allDayList}>{allDay.map(task => entry(task, { timed: false }))}</ul>
                    : <span className={styles.allDayEmpty}>{tasks.length === 0 ? t('noTasks') : ''}</span>}
            </div>

            <div className={styles.timeline} ref={scrollerRef} aria-label={t('timelineLabel')} role="region" tabIndex={-1}>
                <div className={styles.hours} ref={gridRef} onClick={onGridClick}
                    onPointerMove={onGridHover} onPointerLeave={() => setHoverSlot(null)}>
                    {HOURS.map(hour => (
                        <div key={hour} className={styles.hourRow} aria-hidden="true">
                            {hour > 0 && <span className={styles.hourLabel}>{timeText(hour * 60)}</span>}
                        </div>
                    ))}

                    {hoverSlot !== null && !drag &&
                        <div className={styles.slotHover} style={{ '--start': hoverSlot }} aria-hidden="true">
                            <Icon name="add" size={14} />
                            {timeText(hoverSlot)}
                        </div>}

                    <ul className={styles.blocks}>
                        {blocks.map(({ task, start, end, col, cols }) => entry(task, {
                            timed: true,
                            short: end - start < SHORT_MINUTES,
                            place: { '--start': start, '--length': end - start, '--col': col, '--cols': cols },
                        }))}
                    </ul>

                    {preview &&
                        <div className={`${styles.dropPreview} ${isEvent(drag.task) ? styles.entryEvent : ''}`} data-task-color={taskColorAttr(drag.task)}
                            style={{ '--start': preview.start, '--length': preview.length }} aria-hidden="true">
                            <span className={styles.blockTime}>{timeText(preview.start)}</span>
                            <span className={styles.entryName}>{drag.task.name}</span>
                        </div>}

                    {isToday &&
                        <div className={styles.nowLine} style={{ '--start': now }} aria-hidden="true">
                            <span className={styles.nowDot} />
                        </div>}
                </div>
                {children}
            </div>

            {/* off the hour grid (the top row, the arrows) the entry follows the pointer */}
            {drag && drag.target !== 'time' && createPortal(
                <div className={styles.dragChip} style={{ left: drag.x, top: drag.y }} aria-hidden="true">
                    {drag.target === 'allday' ? `${drag.task.name} · ${t('allDay')}` : drag.task.name}
                </div>,
                document.body
            )}
        </div>
    );
}
