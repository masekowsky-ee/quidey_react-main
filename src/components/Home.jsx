import { useState, useRef, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { dateKey } from '../features/calendar/calendar.js'
import TaskContainer, { TaskListSkeleton } from './TaskContainer.jsx'
import { showForms } from '../features/settings/settingsAction.js'
import styles from './Home.module.css';
import GroupForm from './GroupForm.jsx';
import { FormSheet } from './QuickAdd.jsx';
import WeekDaysContainer from './WeekDaysContainer.jsx';
import GroupBtnContainer from './GroupBtnContainer.jsx';
import WorkingContainer, { FocusSkeleton } from './WorkingContainer.jsx';
import TimerContainer, { TimerSkeleton } from './TimerContainer.jsx';
import SoloTogetherStrip from './together/SoloTogetherStrip.jsx';
import TaskInvites from './task/TaskInvites.jsx';
import Momentum, { MomentumSkeleton } from './home/Momentum.jsx';
import { addWorkedTask, setFocusTask, selectFocusTask } from '../features/session/sessionAction.js'
import { fetchMySharedTasks, selectSharedSoloTasks } from '../features/together/togetherAction.js'
import { selectTasksLoaded } from '../features/tasks/taskAction.js'
import { Bone } from './skeleton/Skeleton.jsx'
import Today from './home/Today.jsx'
import DayPlan from './home/DayPlan.jsx'
import FocusSheet, { FocusSheetSkeleton } from './home/FocusSheet.jsx'
import ReplanCard from './study/ReplanCard.jsx'
import { DESKTOP_QUERY, useMediaQuery } from '../features/layout/breakpoints.js'
import { fill, isOverdue, sameDay, parseDate } from '../features/helperFunction.js'
import { isEvent } from '../features/tasks/kinds.js'
import { useTranslation } from '../i18n/useTranslation.js'
import { DEFAULT_UI_VARIANT, useUiVariant } from '../features/tester/variants.js'
import DepartureBoard from './variants/DepartureBoard.jsx'
import Seats from './variants/Seats.jsx'

import {useSelector, useDispatch} from 'react-redux';

// "Thursday, 22 October": known before anything is loaded (also for the start screen's skeleton)
function useTodayTitle() {
    const { language } = useTranslation();
    return new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB',
        { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
}

// "Guten Morgen" / "Guten Tag" / "Guten Abend" by the hour
function greetingKey(hour) {
    if (hour >= 5 && hour < 11) return 'greetMorning';
    if (hour >= 11 && hour < 17) return 'greetDay';
    return 'greetEvening';
}

// The app's own look says the day in sentences under the greeting: the date, what is due today
// (unless the grey line already says it), the next event today with its time, and the overdue
// ones as a link to the agenda.
function DaySentence({ date, dueToday, overdue, nextEvent, leadSaysDue, today }) {
    const { t } = useTranslation();
    const due = dueToday === 0 ? t('homeSumNone')
        : fill(t(dueToday === 1 ? 'homeSumDueOne' : 'homeSumDue'), { count: dueToday });
    return (
        <p className={styles.sentence}>
            {date}.{' '}
            {!leadSaysDue && <>{due}{' '}</>}
            {nextEvent && <>{fill(t('homeSumEvent'), { time: nextEvent.due_time.slice(0, 5), name: nextEvent.name })}{' '}</>}
            {overdue > 0 && <>
                <Link to={`/calendar?view=agenda&date=${dateKey(today)}`} className={styles.overdue}>
                    {fill(t(overdue === 1 ? 'homeSumOverdueOne' : 'homeSumOverdue'), { count: overdue })}
                </Link>.
            </>}
        </p>
    );
}

// Home's title: a greeting with the first name, and under it in grey what today is about (the
// task in focus, else how many are due). Then the day's numbers as one line: the date, open, due
// today, overdue (a link to the agenda) and today's events (the tasks the list shows, so both say
// the same number); the Solo | Team switch on the right. Until my tasks are there the numbers are
// grey, not "all done". sentence: the app's own look, the numbers said as sentences.
function TitleRow({ tasks, focusTask = null, sentence = false }) {
    const { t } = useTranslation();
    const today = new Date();
    const date = useTodayTitle();
    const loaded = useSelector(selectTasksLoaded);
    const user = useSelector(state => state.auth.user);
    const firstName = (user?.display_name || user?.username || '').trim().split(/\s+/)[0];
    const hello = t(greetingKey(today.getHours()));
    const isToday = (task) => { const due = parseDate(task.due); return due && sameDay(due, today); };
    // events aren't to-dos: they only count as today's events still to come
    const open = tasks.filter(task => !task.done && !isEvent(task));
    const dueToday = open.filter(isToday).length;
    const overdue = open.filter(task => isOverdue(task, today)).length;
    const eventsToday = tasks.filter(task => isEvent(task) && !task.done && isToday(task)).length;
    const nowText = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
    const nextEvent = tasks
        .filter(task => isEvent(task) && !task.done && isToday(task) && task.due_time && task.due_time.slice(0, 5) >= nowText)
        .sort((a, b) => a.due_time.localeCompare(b.due_time))[0];
    const lead = !loaded ? null
        : focusTask ? fill(t('homeLeadFocus'), { name: focusTask.name })
        : dueToday > 0 ? fill(t(dueToday === 1 ? 'homeLeadDueOne' : 'homeLeadDue'), { count: dueToday })
        : t('homeLeadFree');
    return (
        <header className={styles.titleRow} data-part="home-title">
            <div className={styles.titleText}>
            <h1 className={`${styles.title} ${styles.greeting}`}>
                <span>{firstName ? `${hello}, ${firstName}.` : `${hello}.`}</span>
                {lead && <span className={styles.lead}>{lead}</span>}
            </h1>
            {sentence
                ? (loaded
                    ? <DaySentence date={date} dueToday={dueToday} overdue={overdue} nextEvent={nextEvent} today={today} leadSaysDue={!focusTask} />
                    : <p className={styles.sentence}>{date}. <Bone w="14rem" h="1.0625rem" style={{ display: 'inline-block', verticalAlign: 'middle' }} /></p>)
                : <p className={styles.summary}>
                <span>{date}</span>
                {!loaded ? <Bone w="11rem" h="0.9375rem" style={{ margin: '0.25rem 0' }} />
                    : open.length === 0
                    ? <span>{t('allDoneToday')}</span>
                    : <>
                        <span>{fill(t('openTasksCount'), { count: open.length })}</span>
                        {dueToday > 0 && <span>{fill(t('dueTodayCount'), { count: dueToday })}</span>}
                        {/* the overdue ones wait in the calendar's agenda: one tap there */}
                        {overdue > 0 &&
                            <Link to={`/calendar?view=agenda&date=${dateKey(today)}`} className={styles.overdue}>
                                {fill(t('overdueCount'), { count: overdue })}
                            </Link>}
                    </>}
                {eventsToday > 0 && <span>{fill(t(eventsToday === 1 ? 'eventsTodayOne' : 'eventsTodayCount'), { count: eventsToday })}</span>}
            </p>}
            </div>
            <SoloTogetherStrip />
        </header>
    );
}

// Home before the app knows it may load anything (the start screen, see AppSkeleton): the same
// layout, the parts that need no data as they are, grey where tasks and progress will be
export function HomeSkeleton() {
    const desktop = useMediaQuery(DESKTOP_QUERY);
    const own = useUiVariant() === DEFAULT_UI_VARIANT;
    if (own) return (
        <div className={styles.page} data-part="home">
            <TitleRow tasks={[]} sentence />
            <div className={styles.board} data-part="home-columns">
                <div className={styles.focusArea}><FocusSheetSkeleton /></div>
                <div className={styles.dayArea}><DayPlan tasks={[]} /></div>
                <div className={`${styles.listArea} ${styles.listBlock}`} data-part="home-list">
                    <GroupBtnContainer setCreateGroup={() => {}} />
                    <TaskListSkeleton />
                </div>
                <aside className={styles.sideArea}>
                    <MomentumSkeleton stacked />
                </aside>
            </div>
        </div>
    );
    return (
        <div className={styles.page} data-part="home">
            <TitleRow tasks={[]} />
            <MomentumSkeleton />
            <WeekDaysContainer />
            <div className={styles.columns} data-part="home-columns">
                <div className={styles.mainCol} data-part="home-list">
                    <GroupBtnContainer setCreateGroup={() => {}} />
                    <TaskListSkeleton />
                </div>
                <aside className={styles.focusCol} data-part="home-focus">
                    <FocusSkeleton />
                    {desktop && <TimerSkeleton />}
                </aside>
            </div>
        </div>
    );
}

// Home, "solo" layout: the day's title, the next days, the task list, and the focus column
// (the task being worked on and the timer). Wide screens put the focus column beside the list,
// where it stays in view; narrower ones show the task in focus above the list and fold the
// timer into a button in the corner.
export default function Home(){
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const desktop = useMediaQuery(DESKTOP_QUERY);

    const tasks = useSelector(state => state.task.tasks);
    const sharedTasks = useSelector(selectSharedSoloTasks);
    const showSharedTasks = useSelector(state => state.settings.showSharedTasks);
    // testers' interface variants arrange Home their own way (src/ui-variants) and add a part:
    // the departure board (Abfahrtstafel), the reading room's seats (Lesesaal)
    const uiVariant = useUiVariant();

    // the new-task form opens over any page (QuickAdd in the shell); Home's button opens it too
    const setCreateTask = useCallback((open) => dispatch(showForms(Boolean(open))), [dispatch]);
    const [createGroup, setCreateGroup] = useState(false);

    // --- task in focus, drag & drop ---
    // The task in focus lives in the store (the Fokusraum and the timer on every page use it):
    // a task from a shared session is read live, so done/assignee changes show up; it's gone
    // (nothing active) when I left the session or it ended. One of my own leaves the work area
    // as soon as the list says it's done or gone (finished in the calendar, on another device).
    const activeTask = useSelector(selectFocusTask);
    const focusTask = useSelector(state => state.session.focusTask);
    const focusPicked = useSelector(state => state.session.focusPicked);
    const setActiveTask = useCallback((next) =>
        dispatch(setFocusTask(typeof next === 'function' ? next(focusTask) : next)), [dispatch, focusTask]);
    // an open task to start with (only before one was ever chosen), never one that's already done
    const starterTask = tasks.find(task => !task.done && !isEvent(task)) || null;
    useEffect(() => {
        if (!focusPicked && starterTask) dispatch(setFocusTask(starterTask));
    }, [focusPicked, starterTask, dispatch]);
    // tasks put back from the work area (not done): shown at the end of the list, latest last
    const [releasedIds, setReleasedIds] = useState([]);

    // the shared sessions' tasks; changes arrive live afterwards (useLiveLists in App)
    useEffect(() => {
        dispatch(fetchMySharedTasks()).catch(() => {});
    }, [dispatch]);

    const releaseActiveTask = () => {
        if (!activeTask) return;
        setReleasedIds(prev => [...prev.filter(id => id !== activeTask.id), activeTask.id]);
        setActiveTask(null);
    };

    // the button on a task row: the same as dropping it into the work area, which then comes
    // into view (on a phone it is far above the list)
    const activateTask = useCallback((task) => {
        dispatch(setFocusTask(task));
        requestAnimationFrame(() => dropZoneRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }));
    }, [dispatch]);

    const [draggedTask, setDraggedTask] = useState(null);
    const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const dropZoneRef = useRef(null);
    const draggedTaskRef = useRef(null);
    const dragPositionRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (activeTask) dispatch(addWorkedTask(activeTask));
    }, [activeTask, dispatch]);

    const handlePointerDown = useCallback((e, task) => {
        e.preventDefault();
        const rect = e.currentTarget.closest("li").getBoundingClientRect();

        draggedTaskRef.current = task;
        dragPositionRef.current = { x: e.clientX, y: e.clientY };

        setDraggedTask(task);
        setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        setDragPosition({ x: e.clientX, y: e.clientY });
    }, []);

    const handlePointerMove = useCallback((e) => {
        dragPositionRef.current = { x: e.clientX, y: e.clientY };
        setDragPosition({ x: e.clientX, y: e.clientY });
    }, []);

    const handlePointerUp = useCallback(() => {
        const currentTask = draggedTaskRef.current;
        const currentPos = dragPositionRef.current;

        if (dropZoneRef.current && currentTask) {
            const dropRect = dropZoneRef.current.getBoundingClientRect();
            const isOverDropZone =
                currentPos.x >= dropRect.left &&
                currentPos.x <= dropRect.right &&
                currentPos.y >= dropRect.top &&
                currentPos.y <= dropRect.bottom;
            if (isOverDropZone) dispatch(setFocusTask(currentTask));
        }

        draggedTaskRef.current = null;
        setDraggedTask(null);
    }, [dispatch]);

    useEffect(() => {
        if (!draggedTask) return;

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
        };
    }, [draggedTask, handlePointerMove, handlePointerUp]);

    // one timer at any time: in the focus column on wide screens, in the corner otherwise
    const timerPanel = <TimerContainer inline={desktop} />;

    const listedTasks = showSharedTasks ? [...tasks, ...sharedTasks] : tasks;
    const groupForm = createGroup && <FormSheet onClose={() => setCreateGroup(false)}>
        {(sheet, close) => <GroupForm sheet={sheet} setCreateGroup={(value) => { if (!value) close(); }} />}
    </FormSheet>;
    const taskList = (
        <TaskContainer
            activeTask={activeTask}
            releasedIds={releasedIds}
            onActivate={activateTask}
            setCreateTask={setCreateTask}
            handlePointerDown={handlePointerDown}
            draggedTask={draggedTask}
            dragPosition={dragPosition}
            dragOffset={dragOffset}
        />
    );
    const working = (
        <WorkingContainer
            dropZoneRef={dropZoneRef}
            activeTask={activeTask}
            setActiveTask={setActiveTask}
            onRelease={releaseActiveTask}
            dragging={Boolean(draggedTask)}
        />
    );

    // The app's own look: the greeting, then the task in focus on its own white sheet with the
    // timer (the one lifted thing), the list under it; beside it what keeps the day going (today's
    // dashboard, streak, challenges, friends), and the coming days at the end. Narrower, all of
    // it in one column, the focus first.
    if (uiVariant === DEFAULT_UI_VARIANT) return (
        <div className={styles.page} data-part="home">
            <TitleRow tasks={listedTasks} focusTask={activeTask} sentence />
            <ReplanCard />
            <TaskInvites />
            {groupForm}
            {/* 8 + 4 columns: the focus sheet beside the day, the list beside what keeps one going;
                one column on narrower screens, in that order */}
            <div className={styles.board} data-part="home-columns">
                <div className={styles.focusArea}>
                    <FocusSheet dropZoneRef={dropZoneRef} activeTask={activeTask} setActiveTask={setActiveTask}
                        onRelease={releaseActiveTask} dragging={Boolean(draggedTask)} />
                </div>
                <div className={styles.dayArea}>
                    <DayPlan tasks={listedTasks} />
                </div>
                <section className={`${styles.listArea} ${styles.listBlock}`} aria-label={t('taskContainer')} data-part="home-list">
                    <GroupBtnContainer setCreateGroup={setCreateGroup} />
                    <TaskContainer
                        plain
                        activeTask={activeTask}
                        releasedIds={releasedIds}
                        onActivate={activateTask}
                        setCreateTask={setCreateTask}
                        handlePointerDown={handlePointerDown}
                        draggedTask={draggedTask}
                        dragPosition={dragPosition}
                        dragOffset={dragOffset}
                    />
                </section>
                <aside className={styles.sideArea} aria-label={t('momentumTitle')} data-part="home-momentum">
                    <Momentum stacked />
                </aside>
            </div>
            <section className={styles.weekBlock} aria-labelledby="home-week-title" data-part="home-week">
                <h2 id="home-week-title" className={styles.blockTitle}>{t('homeComing')}</h2>
                <WeekDaysContainer />
            </section>
        </div>
    );

    // testers' interface variants: the arrangement their stylesheets (src/ui-variants) expect
    return (
        <div className={styles.page} data-part="home">
            <TitleRow tasks={listedTasks} focusTask={activeTask} />
            {uiVariant === 'tafel' && <DepartureBoard tasks={listedTasks} activeTask={activeTask} />}
            {/* streak, today's challenges and level, friends: what keeps one going */}
            <div data-part="home-momentum" data-label={t('momentumTitle')}>
                <Momentum />
            </div>
            {/* the day at a glance: focus goal, routines, what's next, a quick note */}
            <ReplanCard />
            <Today tasks={listedTasks} />
            <TaskInvites />
            <div data-part="home-week" data-label={t('calendar')}>
                <WeekDaysContainer />
            </div>
            {groupForm}
            <div className={styles.columns} data-part="home-columns">
                <div className={styles.mainCol} data-part="home-list" data-label={t('taskContainer')}>
                    <GroupBtnContainer setCreateGroup={setCreateGroup} />
                    {taskList}
                </div>
                <aside className={styles.focusCol} aria-label={t('focusTitle')} data-part="home-focus" data-label={t('focusTitle')}>
                    {working}
                    {desktop && timerPanel}
                    {uiVariant === 'lesesaal' && <Seats />}
                </aside>
            </div>
            {/* folded in the bottom left (the add button, from App, is in the bottom right) */}
            {!desktop && timerPanel}
        </div>
    );
}
