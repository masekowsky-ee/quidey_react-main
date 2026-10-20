import styles from './Calendar.module.css';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../i18n/useTranslation';
import { addTask, deleteTask, leaveTask, updateTaskProps } from '../features/tasks/taskAction';
import TaskInvites from './task/TaskInvites.jsx';
import { fetchSharedHistory } from '../features/together/togetherAction';
import { showToast } from '../features/toast/toast';
import { downloadFile, fill, isOverdue, sameDay, toDateOnly } from '../features/helperFunction';
import {
    CALENDAR_VIEWS, addDays, addMonths, dateKey, filterTasks, focusByDay as toFocusByDay, fromKey,
    groupByDay, projectRepeats, isoWeek, readStoredCalendarView, startOfWeek, storeCalendarView, toIcs,
} from '../features/calendar/calendar';
import { useTaskDrag } from '../features/calendar/useTaskDrag';
import MonthView from './calendar/MonthView.jsx';
import WeekView from './calendar/WeekView.jsx';
import AgendaView from './calendar/AgendaView.jsx';
import DayPanel from './calendar/DayPanel.jsx';
import Icon from './calendar/icons.jsx';

const VIEW_LABELS = { month: 'calendarViewMonth', week: 'calendarViewWeek', agenda: 'calendarViewAgenda' };
const VIEW_KEYS = { m: 'month', w: 'week', a: 'agenda' };
const NEW_TASK_PRIO = 50; // the middle of the slider, like the task form

const isTyping = (el) => el?.closest?.('input, textarea, select, [contenteditable="true"]');

// The calendar: month, week and agenda view of my tasks by their day. Tasks can be added,
// edited, done and moved (drag them onto another day) right here. View, day and open day
// are in the address (?view=week&date=2026-10-20&day=2026-10-20), so links and reloads keep them.
export default function Calendar() {
    const { t, language } = useTranslation();
    const locale = language === 'de' ? 'de-DE' : 'en-GB';
    const dispatch = useDispatch();

    const tasks = useSelector(state => state.task.tasks);
    const allGroups = useSelector(state => state.task.groups);
    const sessions = useSelector(state => state.session.workedSessionData);
    const sharedHistory = useSelector(state => state.together.history);

    const [params, setParams] = useSearchParams();
    const [storedView] = useState(readStoredCalendarView);
    const view = CALENDAR_VIEWS.includes(params.get('view')) ? params.get('view') : storedView;
    const today = toDateOnly(new Date());
    const focusedDate = fromKey(params.get('date')) ?? today;
    const openDay = fromKey(params.get('day'));
    // the task to open in the day panel ('new': start in the add field); a link can name one
    // with ?task=<id>, e.g. "open in calendar" from the task list
    const [openTaskId, setOpenTaskId] = useState(() => (openDay && Number(params.get('task'))) || null);

    // filters
    const groups = allGroups.filter(group => group.name !== 'all');
    const [groupFilter, setGroupFilter] = useState('all');
    const groupId = groups.some(group => group.id === groupFilter) ? groupFilter : 'all';
    const [showDone, setShowDone] = useState(true);
    const [query, setQuery] = useState('');
    const filtersActive = groupId !== 'all' || !showDone || query.trim() !== '';
    const clearFilters = () => { setGroupFilter('all'); setShowDone(true); setQuery(''); };

    const shown = useMemo(() => filterTasks(tasks, { groupId, showDone, query }), [tasks, groupId, showDone, query]);
    const tasksByDay = useMemo(() => groupByDay(shown), [shown]);
    // the month and week grids also show the coming repeats of repeating tasks (a year ahead of
    // the shown day), as previews; the agenda and the day panel list only real tasks
    const gridTasksByDay = useMemo(
        () => groupByDay([...shown, ...projectRepeats(shown, addDays(focusedDate, 400))]),
        [shown, focusedDate]
    );
    // the day panel shows every task of its day in the chosen group, done ones too
    const panelTasksByDay = useMemo(() => groupByDay(filterTasks(tasks, { groupId })), [tasks, groupId]);
    const focusByDay = useMemo(() => toFocusByDay(sessions), [sessions]);
    const overdueCount = shown.filter(task => isOverdue(task, today)).length;

    // my work in shared sessions, listed on the day I last worked on them
    useEffect(() => {
        dispatch(fetchSharedHistory()).catch(() => {});
    }, [dispatch]);

    // ---------- address ----------

    const update = (changes) => setParams(prev => {
        const next = new URLSearchParams(prev);
        for (const [name, value] of Object.entries(changes)) {
            if (value === null || value === undefined) next.delete(name);
            else next.set(name, value);
        }
        return next;
    }, { replace: true });

    const setView = (next, date) => {
        storeCalendarView(next);
        update({ view: next, ...(date ? { date: dateKey(date) } : {}) });
    };
    const focusDate = (date) => update({ date: dateKey(date) });
    const goToday = () => focusDate(today);
    const shift = (direction) => focusDate(view === 'week' ? addDays(focusedDate, 7 * direction) : addMonths(focusedDate, direction));

    const openDate = (date, taskId = null) => {
        setOpenTaskId(taskId);
        update({ date: dateKey(date), day: dateKey(date) });
    };
    const closeDay = () => update({ day: null, task: null });
    const shiftDay = (direction) => {
        const next = addDays(openDay, direction);
        update({ date: dateKey(next), day: dateKey(next) });
    };

    // ---------- texts ----------

    const longDate = (date, withWeekday = false) => date.toLocaleDateString(locale, withWeekday
        ? { weekday: 'long', day: 'numeric', month: 'long' }
        : { day: 'numeric', month: 'long', year: 'numeric' });
    const dayLabel = (date, count) => `${t('weekDaysFull', (date.getDay() + 6) % 7)}, ${longDate(date)}: ${
        count === 0 ? t('noTasks') : count === 1 ? t('taskCountOne') : fill(t('taskCountMany'), { count })}`;

    let title = `${t('months', focusedDate.getMonth())} ${focusedDate.getFullYear()}`;
    if (view === 'week') {
        const start = startOfWeek(focusedDate);
        const format = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' });
        title = format.formatRange ? format.formatRange(start, addDays(start, 6)) : `${format.format(start)} – ${format.format(addDays(start, 6))}`;
    }
    const isCurrentPeriod = view === 'week'
        ? sameDay(startOfWeek(focusedDate), startOfWeek(today))
        : focusedDate.getFullYear() === today.getFullYear() && focusedDate.getMonth() === today.getMonth();
    const prevLabel = t(view === 'week' ? 'previousWeek' : 'previousMonth');
    const nextLabel = t(view === 'week' ? 'nextWeek' : 'nextMonth');

    // ---------- changing tasks ----------

    const toast = (text, tone = 'success') => dispatch(showToast(text, tone));
    const reportError = () => toast(t('friendError_generic'), 'error');
    const movedText = (key) => fill(t('taskMovedTo'), { date: longDate(fromKey(key), true) });
    const newTaskGroup = groupId === 'all' ? null : groups.find(group => group.id === groupId);

    const addTaskOn = async (name, key, time = null) => {
        try {
            await dispatch(addTask(name, key, '', NEW_TASK_PRIO, newTaskGroup?.id ?? null, undefined, time ? { due_time: time } : {}));
            return true;
        } catch {
            reportError();
            return false;
        }
    };

    const toggleDone = (task) => {
        dispatch(updateTaskProps({ done: !task.done }, task)).catch(reportError);
    };

    const moveTask = (task, key) => {
        if (!fromKey(key) || dateKey(task.due) === key) return;
        dispatch(updateTaskProps({ due: key }, task))
            .then(() => toast(movedText(key)))
            .catch(reportError);
    };

    const saveTask = async (task, changes) => {
        try {
            await dispatch(updateTaskProps(changes, task));
            if (changes.due && changes.due !== dateKey(task.due)) toast(movedText(changes.due));
            return true;
        } catch {
            reportError();
            return false;
        }
    };

    const removeTask = async (task) => {
        try {
            await dispatch(deleteTask(task.id));
            toast(t('taskDeleted'), 'info');
            return true;
        } catch {
            reportError();
            return false;
        }
    };

    // a task a friend shared with me: out of my list, it stays theirs
    const leaveSharedTask = async (task) => {
        try {
            await dispatch(leaveTask(task));
            toast(t('taskLeft'), 'info');
            return true;
        } catch {
            reportError();
            return false;
        }
    };

    // a group label filters the calendar by that group
    const openGroup = (group) => { if (!group.shared && group.id) setGroupFilter(group.id); };

    const exportIcs = () => {
        const withDay = shown.filter(task => task.due);
        if (withDay.length === 0) { toast(t('nothingToExport'), 'info'); return; }
        const groupName = (task) => (task.group_ids ?? [])
            .map(id => groups.find(group => group.id === id)?.name)
            .filter(Boolean)
            .join(', ');
        downloadFile('quidey-tasks.ics', toIcs(withDay, { groupName }), 'text/calendar');
    };

    const { drag, startDrag, onClickCapture } = useTaskDrag(moveTask);

    // T: today, M / W / A: view (not while typing or with the day open)
    useEffect(() => {
        if (openDay) return;
        const onKey = (e) => {
            if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || isTyping(e.target)) return;
            const key = e.key.toLowerCase();
            if (key === 't') goToday();
            else if (VIEW_KEYS[key]) setView(VIEW_KEYS[key]);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    const openKey = openDay ? dateKey(openDay) : null;
    const viewProps = { focusedDate, today, tasksByDay, focusByDay, onFocusDate: focusDate, onOpenDate: openDate, dayLabel, longDate };

    return (
        <div className={styles.page} onClickCapture={onClickCapture}>
            <header className={styles.toolbar}>
                <div className={styles.titleRow}>
                    <h1 className={styles.title} aria-live="polite">
                        {title}
                        {view === 'week' && <span className={styles.weekBadge}>{fill(t('weekNumber'), { week: isoWeek(focusedDate) })}</span>}
                    </h1>
                    <div className={styles.nav}>
                        {overdueCount > 0 &&
                            <button type="button" className={styles.overdueBtn} onClick={() => setView('agenda', today)}>
                                {fill(t('overdueCount'), { count: overdueCount })}
                            </button>}
                        <button type="button" className={`${styles.todayBtn} ${isCurrentPeriod ? styles.todayBtnQuiet : ''}`} onClick={goToday} title={`${t('today')} (T)`}>
                            {t('today')}
                        </button>
                        <button type="button" className={styles.navBtn} onClick={() => shift(-1)} aria-label={prevLabel} title={prevLabel}><Icon name="prev" /></button>
                        <button type="button" className={styles.navBtn} onClick={() => shift(1)} aria-label={nextLabel} title={nextLabel}><Icon name="next" /></button>
                    </div>
                </div>

                <div className={styles.controls}>
                    <div className={styles.segmented} role="group" aria-label={t('calendarViews')}>
                        {CALENDAR_VIEWS.map(name => (
                            <button key={name} type="button" aria-pressed={view === name}
                                className={view === name ? styles.segmentActive : undefined}
                                onClick={() => setView(name)} title={`${t(VIEW_LABELS[name])} (${name[0].toUpperCase()})`}>
                                {t(VIEW_LABELS[name])}
                            </button>
                        ))}
                    </div>
                    <div className={styles.filters}>
                        <label className={styles.search}>
                            <Icon name="search" size={18} />
                            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                                placeholder={t('searchTasks')} aria-label={t('searchTasks')} />
                        </label>
                        {groups.length > 0 &&
                            <select className={styles.groupSelect} value={String(groupId)} aria-label={t('filterGroup')}
                                onChange={(e) => setGroupFilter(e.target.value === 'all' ? 'all' : groups.find(group => String(group.id) === e.target.value)?.id ?? 'all')}>
                                <option value="all">{t('allGroups')}</option>
                                {groups.map(group => <option key={group.id} value={String(group.id)}>{group.name}</option>)}
                            </select>}
                        <button type="button" className={`${styles.doneToggle} ${showDone ? styles.doneToggleOn : ''}`}
                            aria-pressed={showDone} onClick={() => setShowDone(!showDone)}>
                            <span className={styles.doneBox} aria-hidden="true" />
                            {t('showDoneTasks')}
                        </button>
                        <button type="button" className={styles.exportBtn} onClick={exportIcs} title={t('exportIcsHint')}>
                            <Icon name="download" size={18} />
                            <span>{t('exportIcs')}</span>
                        </button>
                    </div>
                </div>
            </header>

            <div className={styles.invites}><TaskInvites /></div>

            {view === 'month' && <MonthView {...viewProps} tasksByDay={gridTasksByDay} drag={drag} startDrag={startDrag} onOpenWeek={(date) => setView('week', date)} />}
            {view === 'week' && <WeekView {...viewProps} tasksByDay={gridTasksByDay} drag={drag} startDrag={startDrag} />}
            {view === 'agenda' &&
                <AgendaView {...viewProps} tasks={shown} onToggleDone={toggleDone} onSchedule={moveTask}
                    onOpenGroup={openGroup} filtersActive={filtersActive} onClearFilters={clearFilters} />}

            {view !== 'agenda' && <p className={styles.hint}>{t('calendarDragHint')} {t('calendarKeyHint')}</p>}

            {openDay &&
                <DayPanel
                    date={openDay}
                    today={today}
                    tasks={panelTasksByDay[openKey] ?? []}
                    focus={focusByDay[openKey]}
                    sharedEntries={(sharedHistory ?? []).filter(entry => entry.lastWorkedAt && sameDay(new Date(entry.lastWorkedAt), openDay))}
                    initialTaskId={openTaskId}
                    newTaskGroup={newTaskGroup}
                    locale={locale}
                    longDate={longDate}
                    onClose={closeDay}
                    onShiftDay={shiftDay}
                    onAddTask={addTaskOn}
                    onToggleDone={toggleDone}
                    onSaveTask={saveTask}
                    onDeleteTask={removeTask}
                    onLeaveTask={leaveSharedTask}
                    onOpenGroup={openGroup}
                />}

            {drag && createPortal(
                <div className={styles.dragGhost} style={{ left: drag.x, top: drag.y }} aria-hidden="true">{drag.task.name}</div>,
                document.body
            )}
        </div>
    );
}
