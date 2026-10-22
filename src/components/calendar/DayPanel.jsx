import styles from '../CalendarDay.module.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { displayName, fill, isOverdue, mondayIndex, sameDay } from '../../features/helperFunction';
import { dateKey, formatFocus, prioLevel } from '../../features/calendar/calendar';
import TaskLabels from '../TaskLabels.jsx';
import GroupPicker from '../GroupPicker.jsx';
import TaskEditor from './TaskEditor.jsx';
import TaskMeta from '../task/TaskMeta.jsx';
import Icon from './icons.jsx';
import { taskColorAttr } from '../../features/tasks/taskColors';
import { isEvent } from '../../features/tasks/kinds';

const PRIO_CLASS = { high: styles.prioHigh, medium: styles.prioMedium, low: styles.prioLow };
const PRIO_TEXT = { high: 'prioHigh', medium: 'prioMedium', low: 'prioLow' };

const isTyping = (el) => el?.closest?.('input, textarea, select, [contenteditable="true"]');

function TaskRow({ task, today, personal, editing, onEdit, onCloseEdit, onToggleDone, onSave, onDelete, onLeave, onPickGroups, onOpenGroup }) {
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
                : <TaskEditor task={task} personal={false} onSave={onSave} onCancel={onCloseEdit} onDelete={task.canRemove ? onDelete : undefined} />)}
        </li>
    );
}

// Everything about one day: its tasks (done, edit, delete, groups), a field to add one,
// and the focus sessions of that day. Arrows (outside a field) or the buttons go to the
// day before/after; Escape or a click next to it closes.
// personal: false in a shared calendar (session or family): no groups, reminders or sharing,
// each task says who added it, and only who added it (or the owner) can delete it (canRemove).
export default function DayPanel({
    date, today, tasks, focus, sharedEntries, initialTaskId, newTaskGroup, locale, longDate, personal = true,
    onClose, onShiftDay, onAddTask, onToggleDone, onSaveTask, onDeleteTask, onLeaveTask, onOpenGroup,
}) {
    const { t } = useTranslation();
    const key = dateKey(date);
    const panelRef = useRef(null);
    const addRef = useRef(null);
    const [draft, setDraft] = useState('');
    // optional time for the new task; empty: the whole day
    const [draftTime, setDraftTime] = useState('');
    // what the field adds: a task or an event (only in my own calendar)
    const [draftKind, setDraftKind] = useState('task');
    const [busy, setBusy] = useState(false);
    // the task being edited, remembered with its day so changing the day closes the editor
    const [editing, setEditing] = useState({ day: key, id: initialTaskId === 'new' ? null : initialTaskId });
    const editingId = editing.day === key ? editing.id : null;
    const [pickerTask, setPickerTask] = useState(null);
    // stable, so the picker doesn't move the focus again each time the tasks change
    const closePicker = useCallback(() => setPickerTask(null), []);
    const isToday = sameDay(date, today);

    // focus starts in the panel (in the add field when adding was asked for) and goes back afterwards
    useEffect(() => {
        const previous = document.activeElement;
        const finePointer = window.matchMedia?.('(pointer: fine)')?.matches;
        if (initialTaskId === 'new' || (finePointer && !initialTaskId && tasks.length === 0)) addRef.current?.focus();
        else if (!initialTaskId) panelRef.current?.focus();
        return () => previous?.focus?.();
        // only when the panel opens
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const onKey = (e) => {
            if (pickerTask || e.defaultPrevented) return;
            if (e.key === 'Escape') onClose();
            else if (!isTyping(e.target) && !e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                e.preventDefault();
                onShiftDay(e.key === 'ArrowLeft' ? -1 : 1);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [pickerTask, onClose, onShiftDay]);

    const add = async (e) => {
        e.preventDefault();
        const name = draft.trim();
        if (!name || busy) return;
        setBusy(true);
        const ok = await onAddTask(name, key, draftTime || null, personal ? draftKind : 'task');
        setBusy(false);
        if (ok) {
            setDraft('');
            setDraftTime('');
        }
        addRef.current?.focus();
    };

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

    const sessions = focus?.sessions ?? [];
    const timeText = (value) => new Date(value).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

    return createPortal(
        <div className={styles.backdrop} onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className={`${styles.panel} ${editingId !== null ? styles.panelWide : ''}`} role="dialog" aria-modal="true" aria-labelledby="dayPanelTitle" ref={panelRef} tabIndex={-1}>
                <div className={styles.head}>
                    <button type="button" className={styles.navBtn} onClick={() => onShiftDay(-1)} aria-label={t('previousDay')} title={t('previousDay')}>
                        <Icon name="prev" />
                    </button>
                    <div className={styles.titles}>
                        <span className={styles.weekday}>
                            {t('weekDaysFull', mondayIndex(date))}
                            {isToday && <span className={styles.todayTag}>{t('today')}</span>}
                        </span>
                        <h2 id="dayPanelTitle" className={styles.title}>{longDate(date)}</h2>
                    </div>
                    <button type="button" className={styles.navBtn} onClick={() => onShiftDay(1)} aria-label={t('nextDay')} title={t('nextDay')}>
                        <Icon name="next" />
                    </button>
                    <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={t('close')} title={`${t('close')} (Esc)`}>
                        <Icon name="close" size={22} />
                    </button>
                </div>

                {personal &&
                    <div className={styles.quickKind} role="radiogroup" aria-label={t('kindLegend')}>
                        {['task', 'event'].map(kind => (
                            <button key={kind} type="button" role="radio" aria-checked={draftKind === kind}
                                className={draftKind === kind ? styles.quickKindOn : undefined}
                                onClick={() => { setDraftKind(kind); addRef.current?.focus(); }}>
                                {t(`kind_${kind}`)}
                            </button>
                        ))}
                    </div>}
                <form className={styles.quickAdd} onSubmit={add}>
                    <input ref={addRef} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={200}
                        placeholder={t(draftKind === 'event' && personal ? 'addEventForDay' : 'addTaskForDay')}
                        aria-label={t(draftKind === 'event' && personal ? 'addEventForDay' : 'addTaskForDay')} />
                    <input type="time" className={styles.quickTime} value={draftTime} onChange={(e) => setDraftTime(e.target.value)}
                        aria-label={`${t('taskTime')} (${t('allDay')}: –)`} title={t('taskTime')} />
                    <button type="submit" className={styles.addBtn} disabled={!draft.trim() || busy}>{t('add')}</button>
                </form>
                {newTaskGroup && <p className={styles.addHint}>→ {newTaskGroup.name}</p>}

                {tasks.length > 0
                    ? <ul className={styles.list}>
                        {tasks.map(task => (
                            <TaskRow
                                key={task.id}
                                task={task}
                                today={today}
                                personal={personal}
                                editing={editingId === task.id}
                                onEdit={() => setEditing({ day: key, id: task.id })}
                                onCloseEdit={() => setEditing({ day: key, id: null })}
                                onToggleDone={onToggleDone}
                                onSave={(changes) => save(task, changes)}
                                onDelete={remove}
                                onLeave={leave}
                                onPickGroups={setPickerTask}
                                onOpenGroup={onOpenGroup}
                            />
                        ))}
                    </ul>
                    : <p className={styles.empty}>{t('noTasks')}</p>
                }

                {(sessions.length > 0 || sharedEntries.length > 0) &&
                    <section className={styles.focus}>
                        <h3 className={styles.sectionTitle}>
                            {t('focusOnDay')}
                            {focus?.seconds >= 60 && <span className={styles.focusTotal}>{formatFocus(focus.seconds)}</span>}
                        </h3>
                        <ul className={styles.focusList}>
                            {sessions.map(session => (
                                <li key={`solo-${session.id}`}>
                                    <span className={styles.focusTime}>{timeText(session.date)}</span>
                                    <span className={styles.focusWhat}>
                                        {(session.workedTasks ?? []).map(task => task.name).join(', ') || t('sessions')}
                                        {session.group && session.group !== 'all' && <span className={styles.focusGroup}> · {session.group}</span>}
                                    </span>
                                    <span className={styles.focusDuration}>{formatFocus(session.totalTime ?? 0)}</span>
                                </li>
                            ))}
                            {sharedEntries.map(entry => (
                                <li key={`shared-${entry.id}`} className={styles.focusShared}>
                                    <span className={styles.focusTime}>{timeText(entry.lastWorkedAt)}</span>
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
            </div>
            {pickerTask && <GroupPicker task={pickerTask} onClose={closePicker} />}
        </div>,
        document.body
    );
}
