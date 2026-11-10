import styles from './Calendar.module.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../i18n/useTranslation';
import { deleteTaskAsking, leaveTask, updateTaskProps } from '../features/tasks/taskAction';
import TaskInvites from './task/TaskInvites.jsx';
import { fetchSharedHistory, togetherErrorText } from '../features/together/togetherAction';
import { familyErrorText, selectFamilies } from '../features/family/family';
import { calendarSourceKey, parseCalendarSource, useSharedCalendar } from '../features/calendar/sources';
import { showToast } from '../features/toast/toast';
import { downloadFile, fill, isOverdue, parseDate, sameDay, toDateOnly } from '../features/helperFunction';
import {
    CALENDAR_VIEWS, addDays, addMonths, dateKey, filterTasks, focusByDay as toFocusByDay, fromKey,
    groupByDay, projectRepeats, isoWeek, readStoredCalendarView, startOfWeek, storeCalendarView, toIcs,
} from '../features/calendar/calendar';
import { useTaskDrag } from '../features/calendar/useTaskDrag';
import { selectAllDayTime } from '../features/tasks/reminders';
import { useTaskGroups } from '../features/collections/collections';
import MonthView from './calendar/MonthView.jsx';
import WeekView from './calendar/WeekView.jsx';
import AgendaView from './calendar/AgendaView.jsx';
import DayPanel from './calendar/DayPanel.jsx';
import TaskForm from './TaskForm.jsx';
import { FormSheet } from './QuickAdd.jsx';
import Icon from './calendar/icons.jsx';
import { useMediaQuery } from '../features/layout/breakpoints';
import { useUntisLessons, useShowLessons, setShowLessons, useUntisStatus } from '../features/untis/untis';

const VIEW_LABELS = { month: 'calendarViewMonth', week: 'calendarViewWeek', agenda: 'calendarViewAgenda' };
const VIEW_KEYS = { m: 'month', w: 'week', a: 'agenda' };

const isTyping = (el) => el?.closest?.('input, textarea, select, [contenteditable="true"]');

// phones: the toolbar folds into one row of icons (the same width as the grid's phone layout)
const COMPACT_QUERY = '(max-width: 640px)';

// A popover that closes on a click elsewhere or Escape
function useDismiss(open, close, ref) {
    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => { if (!ref.current?.contains(e.target)) close(); };
        const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
        document.addEventListener('pointerdown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open, close, ref]);
}

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
    // my groups, or for testers my collections in their place
    const taskGroups = useTaskGroups();
    const ownSessions = useSelector(state => state.session.workedSessionData);
    const sharedHistory = useSelector(state => state.together.history);
    const sharedSessions = useSelector(state => state.together.sessions);
    const families = useSelector(selectFamilies);

    const [params, setParams] = useSearchParams();
    // which calendar: mine, a shared session's or a family's
    const source = parseCalendarSource(params.get('cal'));
    const shared = useSharedCalendar(source);
    const isShared = source.kind !== 'mine';
    // a shared session's and a family's calendar hold events too; a family's entries also
    // have reminders, which reach every member
    const sharedEvents = source.kind === 'session' || source.kind === 'family';
    const remindsAll = source.kind === 'family';
    const allDayTime = useSelector(selectAllDayTime);
    const baseTasks = isShared ? shared.tasks : ownTasks;
    // my focus sessions belong to my own calendar only
    const sessions = isShared ? null : ownSessions;
    const [storedView] = useState(readStoredCalendarView);
    const view = CALENDAR_VIEWS.includes(params.get('view')) ? params.get('view') : storedView;
    const today = toDateOnly(new Date());
    const focusedDate = fromKey(params.get('date')) ?? today;
    // my Untis timetable beside my own entries (read-only, features/untis/untis.js): a month around the shown day
    const untisConnected = useUntisStatus()?.connected;
    const showLessons = useShowLessons();
    const lessons = useUntisLessons(!isShared && showLessons, dateKey(addDays(focusedDate, -31)), dateKey(addDays(focusedDate, 31)));
    const tasks = useMemo(() => (lessons.length ? [...baseTasks, ...lessons] : baseTasks), [baseTasks, lessons]);
    const openDay = fromKey(params.get('day'));
    // the task to open in the day panel; a link can name one
    // with ?task=<id>, e.g. "open in calendar" from the task list
    const [openTaskId, setOpenTaskId] = useState(() => (openDay && Number(params.get('task'))) || null);

    // filters
    const groups = isShared ? [] : taskGroups.groups;
    const { groupsOf } = taskGroups;
    const inGroup = useMemo(() => (task, id) => groupsOf(task).some(group => group.id === id), [groupsOf]);
    const [groupFilter, setGroupFilter] = useState('all');
    const groupId = groups.some(group => group.id === groupFilter) ? groupFilter : 'all';
    const [showDone, setShowDone] = useState(true);
    const [query, setQuery] = useState('');
    const filtersActive = groupId !== 'all' || !showDone || query.trim() !== '';
    // the filters behind the "Filters" button: how many differ from showing everything
    const hiddenFilters = (groupId !== 'all' ? 1 : 0) + (showDone ? 0 : 1);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const filterRef = useRef(null);
    const closeFilters = useCallback(() => setFiltersOpen(false), []);
    useDismiss(filtersOpen, closeFilters, filterRef);

    // phones: views behind a menu button, search behind a magnifier
    const compact = useMediaQuery(COMPACT_QUERY);
    const [viewsOpen, setViewsOpen] = useState(false);
    const viewsRef = useRef(null);
    const closeViews = useCallback(() => setViewsOpen(false), []);
    useDismiss(viewsOpen, closeViews, viewsRef);
    const [searchOpen, setSearchOpen] = useState(false);
    const searchRef = useRef(null);
    // a search typed stays in view until it's cleared
    const searchShown = searchOpen || query !== '';
    useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);
    const closeSearch = () => { setQuery(''); setSearchOpen(false); };
    const clearFilters = () => { setGroupFilter('all'); setShowDone(true); setQuery(''); };

    const shown = useMemo(() => filterTasks(tasks, { groupId, showDone, query, inGroup }), [tasks, groupId, showDone, query, inGroup]);
    const tasksByDay = useMemo(() => groupByDay(shown), [shown]);
    // the agenda lists what I plan: not the timetable's lessons
    const agendaTasks = useMemo(() => shown.filter(task => !task.lesson), [shown]);
    const agendaByDay = useMemo(() => groupByDay(agendaTasks), [agendaTasks]);
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
        const ofGroup = filterTasks(tasks, { groupId, inGroup });
        const until = openDayKey ? fromKey(openDayKey) : null;
        return groupByDay(isShared || !until ? ofGroup : [...ofGroup, ...projectRepeats(ofGroup, until)]);
    }, [tasks, groupId, isShared, openDayKey, inGroup]);
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
    // phones: month and year; the week view adds its number and shortens the month to fit
    const compactTitle = view === 'week'
        ? `${t('weekShort')} ${isoWeek(focusedDate)} · ${focusedDate.toLocaleDateString(locale, { month: 'short', year: 'numeric' })}`
        : `${t('months', focusedDate.getMonth())} ${focusedDate.getFullYear()}`;
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

    // ---------- adding ----------

    // the new-task form, opened on a day (a day's plus, the day's timeline: also at a time).
    // In a shared calendar the entry goes there (target); in mine into the filtered group.
    const [createAt, setCreateAt] = useState(null);
    const openCreate = (date, time = null) => setCreateAt({ due: dateKey(date), time });
    const createTarget = isShared ? {
        kind: source.kind,
        name: shared.data?.name ?? '',
        events: sharedEvents,
        save: (fields) => shared.add(fields),
        errorText: (err) => (errorText ? errorText(t, err) : t('friendError_generic')),
    } : null;

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
        // the timetable isn't mine to export
        const withDay = shown.filter(task => task.due && !task.lesson);
        if (withDay.length === 0) { toast(t('nothingToExport'), 'info'); return; }
        const groupName = (task) => groupsOf(task).map(group => group.name).join(', ');
        downloadFile(isShared ? `quidey-${source.kind}-${source.id}.ics` : 'quidey-tasks.ics', toIcs(withDay, { groupName, allDayTime }), 'text/calendar');
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

    const { drag, startDrag } = useTaskDrag(moveTask);

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
    const viewProps = { focusedDate, today, tasksByDay, focusByDay, onFocusDate: focusDate, onOpenDate: openDate, onCreateOn: openCreate, dayLabel, longDate };

    // which calendar (only when there's a choice): a pill beside the other controls, on phones in the filters
    const sourceChoice = openSessions.length > 0 || families.length > 0 || isShared;
    const sourcePicker = (
        <div className={styles.source}>
            <label className={`${styles.sourcePick} ${isShared ? styles.sourcePickShared : ''}`}>
                <Icon name={isShared ? 'team' : 'calendar'} size={16} />
                <select className={styles.sourceSelect} value={sourceValue} onChange={(e) => chooseSource(e.target.value)} aria-label={t('calendarOf')}>
                    <option value="mine">{t('calendarMine')}</option>
                    {!sourceListed && <option value={sourceValue}>{shared.data?.name ?? '…'}</option>}
                    {openSessions.length > 0 &&
                        <optgroup label={t('calendarSessions')}>
                            {openSessions.map(s => <option key={s.id} value={`session-${s.id}`}>{s.name}</option>)}
                        </optgroup>}
                    {families.length > 0 &&
                        <optgroup label={t('calendarFamilies')}>
                            {families.map(f => <option key={f.id} value={`family-${f.id}`}>{f.name}</option>)}
                        </optgroup>}
                </select>
                <span className={styles.sourceChevron}><Icon name="expand" size={18} /></span>
            </label>
            {isShared && shared.data &&
                <Link to={sharedPage} className={styles.sourceLink}
                    aria-label={t(source.kind === 'session' ? 'calendarOpenSession' : 'calendarOpenFamily')}
                    title={t(source.kind === 'session' ? 'calendarOpenSession' : 'calendarOpenFamily')}>
                    <Icon name="open" size={18} />
                </Link>}
        </div>
    );

    // the rarer controls behind one button: group, done ones, export (on phones also the calendar)
    const filterMenu = (
        <div className={styles.filterMenu} id="calendarFilters" role="group" aria-label={t('calendarFilters')}>
            {compact && sourceChoice && sourcePicker}
            {groups.length > 0 &&
                <label className={styles.filterField}>
                    <span>{t(taskGroups.collections ? 'collectionFilter' : 'filterGroup')}</span>
                    <select className={styles.groupSelect} value={String(groupId)}
                        onChange={(e) => setGroupFilter(e.target.value === 'all' ? 'all' : groups.find(group => String(group.id) === e.target.value)?.id ?? 'all')}>
                        <option value="all">{t(taskGroups.collections ? 'collectionAllFilter' : 'allGroups')}</option>
                        {groups.map(group => <option key={group.id} value={String(group.id)}>{group.emoji ? `${group.emoji} ${group.name}` : group.name}</option>)}
                    </select>
                </label>}
            <button type="button" className={`${styles.doneToggle} ${showDone ? styles.doneToggleOn : ''}`}
                aria-pressed={showDone} onClick={() => setShowDone(!showDone)}>
                <span className={styles.doneBox} aria-hidden="true" />
                {t('showDoneTasks')}
            </button>
            {untisConnected && !isShared &&
                <button type="button" className={`${styles.doneToggle} ${showLessons ? styles.doneToggleOn : ''}`}
                    aria-pressed={showLessons} onClick={() => setShowLessons(!showLessons)}>
                    <span className={styles.doneBox} aria-hidden="true" />
                    {t('untisShowLessons')}
                </button>}
            <div className={styles.filterDivider} role="separator" />
            <button type="button" className={styles.exportBtn} onClick={() => { setFiltersOpen(false); exportIcs(); }} title={t('exportIcsHint')}>
                <Icon name="download" size={18} />
                <span>{t('exportIcs')}</span>
            </button>
        </div>
    );

    return (
        <div className={styles.page}>
            {compact
                ? <header className={`${styles.toolbar} ${styles.toolbarCompact}`}>
                    <div className={styles.compactBar}>
                        {/* the views (and today) behind one menu button */}
                        <div className={styles.menuWrap} ref={viewsRef}>
                            <button type="button" className={styles.barBtn} aria-label={t('calendarViews')} title={t('calendarViews')} data-tip="calendar-views"
                                aria-expanded={viewsOpen} aria-controls={viewsOpen ? 'calendarViewMenu' : undefined}
                                onClick={() => setViewsOpen(open => !open)}>
                                <Icon name="menu" size={22} />
                                {overdueCount > 0 && <span className={styles.barDot} aria-hidden="true" />}
                            </button>
                            {viewsOpen &&
                                <div className={`${styles.filterMenu} ${styles.viewMenu}`} id="calendarViewMenu" role="menu" aria-label={t('calendarViews')}>
                                    {CALENDAR_VIEWS.map(name => (
                                        <button key={name} type="button" role="menuitemradio" aria-checked={view === name} className={styles.viewItem}
                                            onClick={() => { setView(name); setViewsOpen(false); }}>
                                            {t(VIEW_LABELS[name])}
                                            {view === name && <Icon name="check" size={18} />}
                                        </button>
                                    ))}
                                    <div className={styles.filterDivider} role="separator" />
                                    <button type="button" role="menuitem" className={styles.viewItem} onClick={() => { goToday(); setViewsOpen(false); }}>
                                        {t('today')}
                                    </button>
                                    {overdueCount > 0 &&
                                        <button type="button" role="menuitem" className={`${styles.viewItem} ${styles.viewItemDanger}`}
                                            onClick={() => { setView('agenda', today); setViewsOpen(false); }}>
                                            {fill(t('overdueCount'), { count: overdueCount })}
                                        </button>}
                                </div>}
                        </div>
                        <h1 className={styles.compactTitle} aria-live="polite">{compactTitle}</h1>
                        <button type="button" className={`${styles.barBtn} ${searchShown ? styles.barBtnOn : ''}`}
                            aria-label={t('searchTasks')} title={t('searchTasks')} aria-expanded={searchShown}
                            onClick={() => (searchShown ? closeSearch() : setSearchOpen(true))}>
                            <Icon name="search" size={22} />
                        </button>
                        <div className={styles.filterWrap} ref={filterRef}>
                            <button type="button" className={`${styles.barBtn} ${hiddenFilters > 0 || isShared ? styles.barBtnOn : ''}`}
                                aria-label={hiddenFilters > 0 ? fill(t('calendarFiltersActive'), { count: hiddenFilters }) : t('calendarFilters')}
                                title={t('calendarFilters')}
                                aria-expanded={filtersOpen} aria-controls={filtersOpen ? 'calendarFilters' : undefined}
                                onClick={() => setFiltersOpen(open => !open)}>
                                <Icon name="filter" size={22} />
                                {hiddenFilters > 0 && <span className={styles.barCount} aria-hidden="true">{hiddenFilters}</span>}
                            </button>
                            {filtersOpen && filterMenu}
                        </div>
                        <button type="button" className={styles.barBtn} onClick={() => shift(-1)} aria-label={prevLabel} title={prevLabel}><Icon name="prev" size={22} /></button>
                        <button type="button" className={styles.barBtn} onClick={() => shift(1)} aria-label={nextLabel} title={nextLabel}><Icon name="next" size={22} /></button>
                    </div>
                    {searchShown &&
                        <label className={styles.compactSearch}>
                            <Icon name="search" size={18} />
                            <input ref={searchRef} type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); closeSearch(); } }}
                                placeholder={t('searchTasks')} aria-label={t('searchTasks')} />
                            <button type="button" className={styles.searchClose} onClick={closeSearch} aria-label={t('close')} title={t('close')}>
                                <Icon name="close" size={18} />
                            </button>
                        </label>}
                    {shared.readOnly && <p className={styles.sourceNote}>{t('calendarSessionEnded')}</p>}
                </header>
                : <header className={styles.toolbar}>
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
                        <div className={styles.segmented} role="group" aria-label={t('calendarViews')} data-tip="calendar-views">
                            {CALENDAR_VIEWS.map(name => (
                                <button key={name} type="button" aria-pressed={view === name}
                                    className={view === name ? styles.segmentActive : undefined}
                                    onClick={() => setView(name)} title={`${t(VIEW_LABELS[name])} (${name[0].toUpperCase()})`}>
                                    {t(VIEW_LABELS[name])}
                                </button>
                            ))}
                        </div>
                        <div className={styles.filters}>
                            {sourceChoice && sourcePicker}
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
                                {filtersOpen && filterMenu}
                            </div>
                        </div>
                    </div>
                    {shared.readOnly && <p className={styles.sourceNote}>{t('calendarSessionEnded')}</p>}
                </header>}

            {!isShared && <div className={styles.invites}><TaskInvites /></div>}

            {view === 'month' && <MonthView {...viewProps} tasksByDay={gridTasksByDay} drag={drag} startDrag={startDrag} onOpenWeek={(date) => setView('week', date)} />}
            {view === 'week' && <WeekView {...viewProps} tasksByDay={gridTasksByDay} drag={drag} startDrag={startDrag} />}
            {view === 'agenda' &&
                <AgendaView {...viewProps} tasksByDay={agendaByDay} tasks={agendaTasks} onToggleDone={toggleDone} onSchedule={moveTask}
                    onOpenGroup={openGroup} filtersActive={filtersActive} onClearFilters={clearFilters} />}

            {view !== 'agenda' &&
                <p className={styles.hint}>
                    <span className={styles.hintPointer}>{t('calendarDragHint')} {t('calendarKeyHint')}</span>
                    <span className={styles.hintTouch}>{t('calendarDragHintTouch')}</span>
                </p>}

            {openDay &&
                <DayPanel
                    date={openDay}
                    today={today}
                    tasks={panelTasksByDay[openKey] ?? []}
                    focus={focusByDay[openKey]}
                    sharedEntries={isShared ? [] : (sharedHistory ?? []).filter(entry => entry.lastWorkedAt && sameDay(new Date(entry.lastWorkedAt), openDay))}
                    personal={!isShared}
                    allowEvents={sharedEvents}
                    remindsAll={remindsAll}
                    initialTaskId={openTaskId}
                    locale={locale}
                    longDate={longDate}
                    onClose={closeDay}
                    onShiftDay={shiftDay}
                    onCreate={(time) => openCreate(openDay, time)}
                    paused={createAt !== null}
                    onToggleDone={toggleDone}
                    onSaveTask={saveTask}
                    onDeleteTask={removeTask}
                    onOpenSeries={(task) => openDate(parseDate(dateKey(task.due)), task.id)}
                    onLeaveTask={isShared ? undefined : leaveSharedTask}
                    onOpenGroup={openGroup}
                />}

            {createAt && createPortal(
                <FormSheet onClose={() => setCreateAt(null)}>
                    {(sheet, close) => (
                        <TaskForm sheet={sheet} initialDue={createAt.due} initialTime={createAt.time ?? ''}
                            target={createTarget} group={isShared ? undefined : newTaskGroup ?? null}
                            setCreateTask={(open) => { if (!open) close(); }} />
                    )}
                </FormSheet>,
                document.body
            )}

            {drag && createPortal(
                <div className={styles.dragGhost} style={{ left: drag.x, top: drag.y }} aria-hidden="true">{drag.task.name}</div>,
                document.body
            )}
        </div>
    );
}
