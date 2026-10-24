import styles from './Calendar.module.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../i18n/useTranslation';
import { addTask, deleteTaskAsking, leaveTask, updateTaskProps } from '../features/tasks/taskAction';
import TaskInvites from './task/TaskInvites.jsx';
import { fetchSharedHistory, togetherErrorText } from '../features/together/togetherAction';
import { familyErrorText, selectFamilies } from '../features/family/family';
import { useIsTester } from '../features/auth/tester';
import { calendarSourceKey, parseCalendarSource, useSharedCalendar } from '../features/calendar/sources';
import { showToast } from '../features/toast/toast';
import { downloadFile, fill, isOverdue, parseDate, sameDay, toDateOnly } from '../features/helperFunction';
import {
    CALENDAR_VIEWS, addDays, addMonths, dateKey, filterTasks, focusByDay as toFocusByDay, fromKey,
    groupByDay, projectRepeats, isoWeek, readStoredCalendarView, startOfWeek, storeCalendarView, toIcs,
} from '../features/calendar/calendar';
import { useTaskDrag } from '../features/calendar/useTaskDrag';
import { matchEventType } from '../features/tasks/kinds';
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
// ?cal=session-5 / ?cal=family-3 shows a shared calendar instead (see features/calendar/sources.js):
// the tasks of a shared session or a family's calendar, which every member plans in.
export default function Calendar() {
    const { t, language } = useTranslation();
    const locale = language === 'de' ? 'de-DE' : 'en-GB';
    const dispatch = useDispatch();

    const ownTasks = useSelector(state => state.task.tasks);
    const allGroups = useSelector(state => state.task.groups);
    const ownSessions = useSelector(state => state.session.workedSessionData);
    const sharedHistory = useSelector(state => state.together.history);
    const sharedSessions = useSelector(state => state.together.sessions);
    const isTester = useIsTester();
    const families = useSelector(selectFamilies);

    const [params, setParams] = useSearchParams();
    // which calendar: mine, a shared session's or a family's (families are for testers only, for now)
    const requestedSource = parseCalendarSource(params.get('cal'));
    const source = requestedSource.kind === 'family' && !isTester ? parseCalendarSource(null) : requestedSource;
    const shared = useSharedCalendar(source);
    const isShared = source.kind !== 'mine';
    // a shared session's calendar holds events too (a family's only tasks)
    const sharedEvents = source.kind === 'session';
    const eventTypes = useSelector(state => state.task.eventTypes);
    const tasks = isShared ? shared.tasks : ownTasks;
    // my focus sessions belong to my own calendar only
    const sessions = isShared ? null : ownSessions;
    const [storedView] = useState(readStoredCalendarView);
    const view = CALENDAR_VIEWS.includes(params.get('view')) ? params.get('view') : storedView;
    const today = toDateOnly(new Date());
    const focusedDate = fromKey(params.get('date')) ?? today;
    const openDay = fromKey(params.get('day'));
    // the task to open in the day panel ('new': start in the add field); a link can name one
    // with ?task=<id>, e.g. "open in calendar" from the task list
    const [openTaskId, setOpenTaskId] = useState(() => (openDay && Number(params.get('task'))) || null);

    // filters
    const groups = isShared ? [] : allGroups.filter(group => group.name !== 'all');
    const [groupFilter, setGroupFilter] = useState('all');
    const groupId = groups.some(group => group.id === groupFilter) ? groupFilter : 'all';
    const [showDone, setShowDone] = useState(true);
    const [query, setQuery] = useState('');
    const filtersActive = groupId !== 'all' || !showDone || query.trim() !== '';
    // the filters behind the "Filters" button: how many differ from showing everything
    const hiddenFilters = (groupId !== 'all' ? 1 : 0) + (showDone ? 0 : 1);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const filterRef = useRef(null);
    // a click elsewhere or Escape closes the filters
    useEffect(() => {
        if (!filtersOpen) return undefined;
        const onDown = (e) => { if (!filterRef.current?.contains(e.target)) setFiltersOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); setFiltersOpen(false); } };
        document.addEventListener('pointerdown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [filtersOpen]);
    const clearFilters = () => { setGroupFilter('all'); setShowDone(true); setQuery(''); };

    const shown = useMemo(() => filterTasks(tasks, { groupId, showDone, query }), [tasks, groupId, showDone, query]);
    const tasksByDay = useMemo(() => groupByDay(shown), [shown]);
    // the month and week grids also show the coming repeats of repeating tasks (a year ahead of
    // the shown day), as previews; the agenda and the day panel list only real tasks
    const gridTasksByDay = useMemo(
        () => groupByDay([...shown, ...projectRepeats(shown, addDays(focusedDate, 400))]),
        [shown, focusedDate]
    );
    // the day panel shows every task of its day in the chosen group, done ones too, and the
    // coming repeats on that day (each can be deleted on its own there)
    const openDayKey = openDay ? dateKey(openDay) : null;
    const panelTasksByDay = useMemo(() => {
        const inGroup = filterTasks(tasks, { groupId });
        const until = openDayKey ? fromKey(openDayKey) : null;
        return groupByDay(isShared || !until ? inGroup : [...inGroup, ...projectRepeats(inGroup, until)]);
    }, [tasks, groupId, isShared, openDayKey]);
    const focusByDay = useMemo(() => toFocusByDay(sessions), [sessions]);
    const overdueCount = shown.filter(task => isOverdue(task, today)).length;

    // my work in shared sessions, listed on the day I last worked on them
    useEffect(() => {
        dispatch(fetchSharedHistory()).catch(() => {});
    }, [dispatch]);

    // not (or no longer) in that session / family: back to my own calendar
    useEffect(() => {
        if (!shared.gone) return;
        dispatch(showToast(t('calendarGone'), 'info'));
        setParams(prev => {
            const next = new URLSearchParams(prev);
            for (const name of ['cal', 'day', 'task']) next.delete(name);
            return next;
        }, { replace: true });
    }, [shared.gone, dispatch, setParams, t]);

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
    const errorText = { session: togetherErrorText, family: familyErrorText }[source.kind];
    const reportError = (err) => toast(errorText ? errorText(t, err) : t('friendError_generic'), 'error');
    const movedText = (key) => fill(t('taskMovedTo'), { date: longDate(fromKey(key), true) });
    const newTaskGroup = groupId === 'all' ? null : groups.find(group => group.id === groupId);

    // a change to a task: in my own list, or in the shared calendar shown
    const changeTask = (task, changes) => (isShared ? shared.update(task.id, changes) : dispatch(updateTaskProps(changes, task)));

    // kind: 'task' or 'event' (only in my own calendar; an event has no priority)
    const addTaskOn = async (name, key, time = null, kind = 'task') => {
        try {
            if (isShared) await shared.add({ name, due: key, ...(time ? { due_time: time } : {}), ...(sharedEvents && kind === 'event' ? { kind } : {}) });
            // a new event of mine takes the type its name points to (a keyword of the type)
            else await dispatch(addTask(name, key, '', kind === 'event' ? null : NEW_TASK_PRIO, newTaskGroup?.id ?? null, undefined,
                { ...(time ? { due_time: time } : {}), ...(kind === 'event' ? { kind, event_type_id: matchEventType(name, eventTypes)?.type.id ?? null } : {}) }));
            return true;
        } catch (err) {
            reportError(err);
            return false;
        }
    };

    // an event is done once it's over, not by hand
    const toggleDone = (task) => {
        if (task.kind === 'event') return;
        changeTask(task, { done: !task.done }).catch(reportError);
    };

    const moveTask = (task, key) => {
        if (!fromKey(key) || dateKey(task.due) === key) return;
        changeTask(task, { due: key })
            .then(() => toast(movedText(key)))
            .catch(reportError);
    };

    const saveTask = async (task, changes) => {
        try {
            await changeTask(task, changes);
            if (changes.due && changes.due !== dateKey(task.due)) toast(movedText(changes.due));
            return true;
        } catch (err) {
            reportError(err);
            return false;
        }
    };

    const removeTask = async (task) => {
        try {
            if (isShared) await shared.remove(task.id);
            // a repeating one asks first what goes (also a coming repeat, by its day)
            else if (!(await dispatch(deleteTaskAsking(task)))) return false;
            toast(t('taskDeleted'), 'info');
            return true;
        } catch (err) {
            reportError(err);
            return false;
        }
    };

    // a task a friend shared with me: out of my list, it stays theirs
    const leaveSharedTask = async (task) => {
        try {
            await dispatch(leaveTask(task));
            toast(t('taskLeft'), 'info');
            return true;
        } catch (err) {
            reportError(err);
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
        downloadFile(isShared ? `quidey-${source.kind}-${source.id}.ics` : 'quidey-tasks.ics', toIcs(withDay, { groupName }), 'text/calendar');
    };

    // ---------- choosing the calendar ----------

    const openSessions = sharedSessions.filter(session => !session.endedAt);
    const sourceValue = calendarSourceKey(source) ?? 'mine';
    // the one shown also when it isn't in the lists (an ended session, lists not loaded yet)
    const sourceListed = sourceValue === 'mine'
        || (source.kind === 'session' && openSessions.some(s => s.id === source.id))
        || (source.kind === 'family' && families.some(f => f.id === source.id));
    const chooseSource = (value) => update({ cal: value === 'mine' ? null : value, day: null, task: null });
    const sharedPage = source.kind === 'session' ? `/together/${source.id}` : `/family/${source.id}`;

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
                {(openSessions.length > 0 || (isTester && families.length > 0) || isShared) &&
                    <div className={styles.sourceRow}>
                        <label className={styles.sourceLabel}>
                            <span>{t('calendarOf')}</span>
                            <select className={styles.sourceSelect} value={sourceValue} onChange={(e) => chooseSource(e.target.value)}>
                                <option value="mine">{t('calendarMine')}</option>
                                {!sourceListed && <option value={sourceValue}>{shared.data?.name ?? '…'}</option>}
                                {openSessions.length > 0 &&
                                    <optgroup label={t('calendarSessions')}>
                                        {openSessions.map(s => <option key={s.id} value={`session-${s.id}`}>{s.name}</option>)}
                                    </optgroup>}
                                {isTester && families.length > 0 &&
                                    <optgroup label={t('calendarFamilies')}>
                                        {families.map(f => <option key={f.id} value={`family-${f.id}`}>{f.name}</option>)}
                                    </optgroup>}
                            </select>
                        </label>
                        {isShared && shared.data &&
                            <Link to={sharedPage} className={styles.sourceLink}>
                                {t(source.kind === 'session' ? 'calendarOpenSession' : 'calendarOpenFamily')} →
                            </Link>}
                        {shared.readOnly && <span className={styles.sourceNote}>{t('calendarSessionEnded')}</span>}
                    </div>}
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
                        {/* the rarer controls wait behind one button: group, done ones, export */}
                        <div className={styles.filterWrap} ref={filterRef}>
                            <button type="button" className={`${styles.filterBtn} ${hiddenFilters > 0 ? styles.filterBtnOn : ''}`}
                                aria-expanded={filtersOpen} aria-controls={filtersOpen ? 'calendarFilters' : undefined}
                                onClick={() => setFiltersOpen(open => !open)}>
                                <Icon name="filter" size={18} />
                                <span>{hiddenFilters > 0 ? fill(t('calendarFiltersActive'), { count: hiddenFilters }) : t('calendarFilters')}</span>
                            </button>
                            {filtersOpen &&
                                <div className={styles.filterMenu} id="calendarFilters" role="group" aria-label={t('calendarFilters')}>
                                    {groups.length > 0 &&
                                        <label className={styles.filterField}>
                                            <span>{t('filterGroup')}</span>
                                            <select className={styles.groupSelect} value={String(groupId)}
                                                onChange={(e) => setGroupFilter(e.target.value === 'all' ? 'all' : groups.find(group => String(group.id) === e.target.value)?.id ?? 'all')}>
                                                <option value="all">{t('allGroups')}</option>
                                                {groups.map(group => <option key={group.id} value={String(group.id)}>{group.name}</option>)}
                                            </select>
                                        </label>}
                                    <button type="button" className={`${styles.doneToggle} ${showDone ? styles.doneToggleOn : ''}`}
                                        aria-pressed={showDone} onClick={() => setShowDone(!showDone)}>
                                        <span className={styles.doneBox} aria-hidden="true" />
                                        {t('showDoneTasks')}
                                    </button>
                                    <div className={styles.filterDivider} role="separator" />
                                    <button type="button" className={styles.exportBtn} onClick={() => { setFiltersOpen(false); exportIcs(); }} title={t('exportIcsHint')}>
                                        <Icon name="download" size={18} />
                                        <span>{t('exportIcs')}</span>
                                    </button>
                                </div>}
                        </div>
                    </div>
                </div>
            </header>

            {!isShared && <div className={styles.invites}><TaskInvites /></div>}

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
                    sharedEntries={isShared ? [] : (sharedHistory ?? []).filter(entry => entry.lastWorkedAt && sameDay(new Date(entry.lastWorkedAt), openDay))}
                    personal={!isShared}
                    allowEvents={sharedEvents}
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
                    onOpenSeries={(task) => openDate(parseDate(dateKey(task.due)), task.id)}
                    onLeaveTask={isShared ? undefined : leaveSharedTask}
                    onOpenGroup={openGroup}
                />}

            {drag && createPortal(
                <div className={styles.dragGhost} style={{ left: drag.x, top: drag.y }} aria-hidden="true">{drag.task.name}</div>,
                document.body
            )}
        </div>
    );
}
