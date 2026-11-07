import styles from '../CalendarDay.module.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { displayName, fill, isOverdue, mondayIndex, sameDay } from '../../features/helperFunction';
import { addDays, dateKey, formatFocus, minutesOfDay, prioLevel, timeText } from '../../features/calendar/calendar';
import { snapMinutes, useTimelineDrag } from '../../features/calendar/useTimelineDrag';
import TaskLabels from '../TaskLabels.jsx';
import GroupPicker from '../GroupPicker.jsx';
import TaskEditor from './TaskEditor.jsx';
import DayTimeline from './DayTimeline.jsx';
import TaskMeta from '../task/TaskMeta.jsx';
import Icon from './icons.jsx';
import SheetGrabber from '../SheetGrabber.jsx';
import { useSheet } from '../../features/layout/dragDismiss';
import { taskColorAttr } from '../../features/tasks/taskColors';
import { isEvent } from '../../features/tasks/kinds';
import { useIsTester } from '../../features/auth/tester';

const PRIO_CLASS = { high: styles.prioHigh, medium: styles.prioMedium, low: styles.prioLow };
const PRIO_TEXT = { high: 'prioHigh', medium: 'prioMedium', low: 'prioLow' };

const isTyping = (el) => el?.closest?.('input, textarea, select, [contenteditable="true"]');

function TaskRow({ task, today, personal, allowEvents, remindsAll, editing, onEdit, onCloseEdit, onToggleDone, onSave, onDelete, onLeave, onPickGroups, onOpenGroup }) {
    const { t } = useTranslation();
    const event = isEvent(task);
    const level = event ? null : prioLevel(task.prio);
    const classes = [styles.row, PRIO_CLASS[level], event && styles.rowEvent, task.done && styles.rowDone, editing && styles.rowEditing].filter(Boolean).join(' ');
    return (
        <li className={classes} data-task-color={taskColorAttr(task)}>
            <div className={styles.rowMain}>
                {/* an event isn't ticked off: it's done once it's over */}
                {event
                    ? <span className={styles.eventMark} title={t(task.done ? 'eventOver' : 'kind_event')}>
                        <Icon name="calendar" size={16} />
                    </span>
                    : <button type="button" className={styles.check} aria-pressed={Boolean(task.done)} onClick={() => onToggleDone(task)}
                        aria-label={`${t(task.done ? 'reopen' : 'markDone')}: ${task.name}`} title={t(task.done ? 'reopen' : 'markDone')}>
                        <Icon name="check" size={16} />
                    </button>}
                <div className={styles.rowText}>
                    <button type="button" className={styles.rowName} onClick={editing ? onCloseEdit : onEdit} aria-expanded={editing}>
                        {task.name}
                    </button>
                    {!editing && <TaskMeta task={task} />}
                    {!editing && task.description && <p className={styles.rowDesc}>{task.description}</p>}
                    {personal
                        ? <TaskLabels task={task} onOpenGroup={onOpenGroup} />
                        : task.addedBy && <span className={styles.addedBy}>{fill(t('addedByName'), { name: displayName(task.addedBy) })}</span>}
                </div>
                <div className={styles.rowMeta}>
                    {isOverdue(task, today) && <span className={styles.overduePill}>{t('overdue')}</span>}
                    {level && <span className={styles.prioPill} title={t(PRIO_TEXT[level])}>{task.prio}</span>}
                    {!editing &&
                        <button type="button" className={styles.editBtn} onClick={onEdit} aria-label={`${t('editTask')}: ${task.name}`} title={t('editTask')}>
                            <Icon name="edit" size={18} />
                        </button>}
                </div>
            </div>
            {editing && (personal
                ? <TaskEditor task={task} onSave={onSave} onCancel={onCloseEdit} onDelete={onDelete} onLeave={onLeave} onPickGroups={onPickGroups} />
                : <TaskEditor task={task} personal={false} allowEvents={allowEvents} remindsAll={remindsAll} onSave={onSave} onCancel={onCloseEdit} onDelete={task.canRemove ? onDelete : undefined} />)}
        </li>
    );
}

// A coming repeat of a repeating task (only a preview, see projectRepeats): it can't be ticked
// off or edited on its own, but deleted on its own (or with the following); "edit series" opens
// the real task on its day.
function PreviewRow({ task, onOpenSeries, onDelete }) {
    const { t } = useTranslation();
    const event = isEvent(task);
    return (
        <li className={`${styles.row} ${styles.rowPreview} ${event ? styles.rowEvent : ''}`} data-task-color={taskColorAttr(task)}>
            <div className={styles.rowMain}>
                <span className={styles.eventMark} title={t('repeatPreview')}>
                    <Icon name="repeat" size={16} />
                </span>
                <div className={styles.rowText}>
                    <span className={styles.rowNameStatic}>{task.name}</span>
                    <TaskMeta task={task} />
                    <span className={styles.previewNote}>{t('repeatPreview')}</span>
                </div>
                <div className={styles.rowMeta}>
                    {onOpenSeries &&
                        <button type="button" className={styles.editBtn} onClick={() => onOpenSeries(task.repeatOf)}
                            aria-label={`${t('editSeries')}: ${task.name}`} title={t('editSeries')}>
                            <Icon name="edit" size={18} />
                        </button>}
                    <button type="button" className={styles.editBtn} onClick={() => onDelete(task)}
                        aria-label={`${t(event ? 'deleteEvent' : 'deleteTask')}: ${task.name}`} title={t(event ? 'deleteEvent' : 'deleteTask')}>
                        <Icon name="delete" size={18} />
                    </button>
                </div>
            </div>
        </li>
    );
}

// Everything about one day: its tasks and events on a timeline (see DayTimeline: dragged to
// another time, into the all-day row or onto the arrows for the day before/after) and the focus
// sessions of that day. The plus in the head, or a tap on a free spot of the hours, opens the
// new-task form on this day (onCreate(time | null)). An entry opens in its editor in place of the
// timeline (done, edit, delete, groups). Arrows (outside a field) or the buttons go to the day
// before/after; Escape or a click next to it closes. paused: the new-task form lies over it, so
// its keys are the form's.
// personal: false in a shared calendar (session or family): no groups, reminders or sharing,
// each task says who added it, and only who added it (or the owner) can delete it (canRemove).
export default function DayPanel({
    date, today, tasks, focus, sharedEntries, initialTaskId, locale, longDate, personal = true, allowEvents = false, remindsAll = false, paused = false,
    onClose, onShiftDay, onCreate, onToggleDone, onSaveTask, onDeleteTask, onLeaveTask, onOpenGroup, onOpenSeries,
}) {
    const { t } = useTranslation();
    const key = dateKey(date);
    const panelRef = useRef(null);
    // on phones a sheet: pulled down, it closes
    const sheet = useSheet(onClose, panelRef);
    const { dismiss } = sheet;
    // the task being edited, remembered with its day so changing the day closes the editor
    const [editing, setEditing] = useState({ day: key, id: initialTaskId });
    const editingId = editing.day === key ? editing.id : null;
    // "edit series" from a coming repeat names another task (and day) while the panel stays open
    const [lastInitialId, setLastInitialId] = useState(initialTaskId);
    if (initialTaskId !== lastInitialId) {
        setLastInitialId(initialTaskId);
        setEditing({ day: key, id: initialTaskId });
    }
    const [pickerTask, setPickerTask] = useState(null);
    // testers sort tasks into collections (in the editor) instead of groups
    const groupsOn = !useIsTester();
    // stable, so the picker doesn't move the focus again each time the tasks change
    const closePicker = useCallback(() => setPickerTask(null), []);
    const isToday = sameDay(date, today);

    // ---------- the timeline ----------
    const gridRef = useRef(null);
    const scrollerRef = useRef(null);
    // a move being saved: shown at its new place until the list has it (or it failed)
    const [pending, setPending] = useState(null);
    const moveTo = useCallback(async (task, changes) => {
        setPending({ id: task.id, changes });
        await onSaveTask(task, changes);
        setPending(null);
    }, [onSaveTask]);
    const { drag, startDrag } = useTimelineDrag({ gridRef, scrollerRef, onMove: moveTo });
    const shiftTime = (task, delta) => {
        const start = minutesOfDay(task.due_time);
        if (start === null) return;
        const next = snapMinutes(start + delta);
        if (next !== start) moveTo(task, { due_time: timeText(next) });
    };
    const prevKey = dateKey(addDays(date, -1));
    const nextKey = dateKey(addDays(date, 1));
    const dropDay = drag?.target === 'day' ? drag.day : null;

    // focus starts in the panel and goes back afterwards
    useEffect(() => {
        const previous = document.activeElement;
        if (!initialTaskId) panelRef.current?.focus();
        return () => { previous?.focus?.(); };
        // only when the panel opens
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const onKey = (e) => {
            if (pickerTask || paused || e.defaultPrevented) return;
            if (e.key === 'Escape') dismiss();
            else if (!isTyping(e.target) && !e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                e.preventDefault();
                onShiftDay(e.key === 'ArrowLeft' ? -1 : 1);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [pickerTask, paused, dismiss, onShiftDay]);

    const leave = async (task) => {
        const ok = await onLeaveTask(task);
        if (ok) setEditing({ day: key, id: null });
    };

    const save = async (task, changes) => {
        const ok = await onSaveTask(task, changes);
        if (ok) setEditing({ day: key, id: null });
        return ok;
    };

    const remove = async (task) => {
        const ok = await onDeleteTask(task);
        if (ok) setEditing({ day: key, id: null });
    };

    // the entry open in its editor (in place of the timeline); gone from the day (moved, deleted): none
    const editingTask = editingId === null ? null : tasks.find(task => task.id === editingId) ?? null;
    const sessions = focus?.sessions ?? [];
    const clockText = (value) => new Date(value).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

    return createPortal(
        <div className={styles.backdrop} {...sheet.backdrop} onPointerDown={(e) => { if (e.target === e.currentTarget) dismiss(); }}>
            <div className={`${styles.panel} ${editingTask ? styles.panelWide : styles.panelTimeline}`} role="dialog" aria-modal="true" aria-labelledby="dayPanelTitle" {...sheet.panel} tabIndex={-1}>
                <SheetGrabber />
                <div className={styles.head} data-sheet-drag>
                    <button type="button" className={`${styles.navBtn} ${dropDay === prevKey ? styles.dropOn : ''}`} data-drop-day={prevKey}
                        onClick={() => onShiftDay(-1)} aria-label={t('previousDay')} title={t('previousDay')}>
                        <Icon name="prev" />
                    </button>
                    <div className={styles.titles}>
                        <span className={styles.weekday}>
                            {t('weekDaysFull', mondayIndex(date))}
                            {isToday && <span className={styles.todayTag}>{t('today')}</span>}
                        </span>
                        <h2 id="dayPanelTitle" className={styles.title}>{longDate(date)}</h2>
                    </div>
                    <button type="button" className={`${styles.navBtn} ${dropDay === nextKey ? styles.dropOn : ''}`} data-drop-day={nextKey}
                        onClick={() => onShiftDay(1)} aria-label={t('nextDay')} title={t('nextDay')}>
                        <Icon name="next" />
                    </button>
                    <button type="button" className={styles.addDayBtn} onClick={() => onCreate(null)}
                        aria-label={fill(t('addEntryOnDay'), { date: longDate(date) })} title={fill(t('addEntryOnDay'), { date: longDate(date) })}>
                        <Icon name="add" size={22} />
                    </button>
                    <button type="button" className={styles.closeBtn} onClick={() => dismiss()} aria-label={t('close')} title={`${t('close')} (Esc)`}>
                        <Icon name="close" size={22} />
                    </button>
                </div>

                {editingTask
                    ? <ul className={styles.list}>
                        {editingTask.projected
                            ? <PreviewRow task={editingTask} onOpenSeries={onOpenSeries} onDelete={remove} />
                            : (
                            <TaskRow
                                task={editingTask}
                                today={today}
                                personal={personal}
                                allowEvents={allowEvents}
                                remindsAll={remindsAll}
                                editing
                                onEdit={() => setEditing({ day: key, id: editingTask.id })}
                                onCloseEdit={() => setEditing({ day: key, id: null })}
                                onToggleDone={onToggleDone}
                                onSave={(changes) => save(editingTask, changes)}
                                onDelete={remove}
                                onLeave={leave}
                                onPickGroups={groupsOn ? setPickerTask : undefined}
                                onOpenGroup={onOpenGroup}
                            />
                        )}
                    </ul>
                    : <DayTimeline
                        date={date}
                        dayKey={key}
                        today={today}
                        tasks={tasks}
                        personal={personal}
                        drag={drag}
                        startDrag={startDrag}
                        gridRef={gridRef}
                        scrollerRef={scrollerRef}
                        pending={pending}
                        onOpen={(task) => setEditing({ day: key, id: task.id })}
                        onToggleDone={onToggleDone}
                        onShiftTime={shiftTime}
                        onOpenGroup={onOpenGroup}
                        onCreateAt={(minutes) => onCreate(timeText(minutes))}
                    >
                    {(sessions.length > 0 || sharedEntries.length > 0) &&
                        <section className={styles.focus}>
                            <h3 className={styles.sectionTitle}>
                                {t('focusOnDay')}
                                {focus?.seconds >= 60 && <span className={styles.focusTotal}>{formatFocus(focus.seconds)}</span>}
                            </h3>
                            <ul className={styles.focusList}>
                                {sessions.map(session => (
                                    <li key={`solo-${session.id}`}>
                                        <span className={styles.focusTime}>{clockText(session.date)}</span>
                                        <span className={styles.focusWhat}>
                                            {(session.workedTasks ?? []).map(task => task.name).join(', ') || t('sessions')}
                                            {session.group && session.group !== 'all' && <span className={styles.focusGroup}> · {session.group}</span>}
                                        </span>
                                        <span className={styles.focusDuration}>{formatFocus(session.totalTime ?? 0)}</span>
                                    </li>
                                ))}
                                {sharedEntries.map(entry => (
                                    <li key={`shared-${entry.id}`} className={styles.focusShared}>
                                        <span className={styles.focusTime}>{clockText(entry.lastWorkedAt)}</span>
                                        <span className={styles.focusWhat}>
                                            <Link to={`/together/${entry.id}`}>{entry.name}</Link>
                                            <span className={styles.focusGroup}> · {t('sharedSessionLabel')}</span>
                                        </span>
                                        <span className={styles.focusDuration}>{formatFocus(Math.round((entry.myMs ?? 0) / 1000))}</span>
                                    </li>
                                ))}
                            </ul>
                            <Link to="/stats?tab=sessions" className={styles.historyLink}>{t('openHistory')} →</Link>
                        </section>
                    }
                    </DayTimeline>}
            </div>
            {pickerTask && <GroupPicker task={pickerTask} onClose={closePicker} />}
        </div>,
        document.body
    );
}
