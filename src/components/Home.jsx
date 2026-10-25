import { useState, useRef, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { dateKey } from '../features/calendar/calendar.js'
import TaskContainer, { TaskListSkeleton } from './TaskContainer.jsx'
import { showForms } from '../features/settings/settingsAction.js'
import styles from './Home.module.css';
import GroupForm from './GroupForm.jsx';
import WeekDaysContainer from './WeekDaysContainer.jsx';
import GroupBtnContainer from './GroupBtnContainer.jsx';
import WorkingContainer, { FocusSkeleton } from './WorkingContainer.jsx';
import TimerContainer, { TimerSkeleton } from './TimerContainer.jsx';
import SoloTogetherStrip from './together/SoloTogetherStrip.jsx';
import TaskInvites from './task/TaskInvites.jsx';
import Momentum, { MomentumSkeleton } from './home/Momentum.jsx';
import { updateCurrentSessionData, addWorkedTask } from '../features/session/sessionAction.js'
import { fetchMySharedTasks, selectSharedSoloTasks } from '../features/together/togetherAction.js'
import { selectTasksLoaded } from '../features/tasks/taskAction.js'
import { Bone } from './skeleton/Skeleton.jsx'
import { useSoloSharedWork } from '../features/together/useSoloSharedWork.js'
import { DESKTOP_QUERY, useMediaQuery } from '../features/layout/breakpoints.js'
import { fill, isOverdue, sameDay, parseDate } from '../features/helperFunction.js'
import { isEvent } from '../features/tasks/kinds.js'
import { useTranslation } from '../i18n/useTranslation.js'
import { useUiVariant } from '../features/tester/variants.js'
import DepartureBoard from './variants/DepartureBoard.jsx'
import Seats from './variants/Seats.jsx'

import {useSelector, useDispatch} from 'react-redux';

// "Thursday, 22 October": known before anything is loaded (also for the start screen's skeleton)
function useTodayTitle() {
    const { language } = useTranslation();
    return new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB',
        { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
}

// The day as the title and how it looks: open tasks, due today, overdue (the tasks the list
// shows, so both say the same number); the Solo | Team switch on the right. Until my tasks are
// there the line under the title is grey, not "all done".
function TitleRow({ tasks }) {
    const { t } = useTranslation();
    const today = new Date();
    const title = useTodayTitle();
    const loaded = useSelector(selectTasksLoaded);
    const isToday = (task) => { const due = parseDate(task.due); return due && sameDay(due, today); };
    // events aren't to-dos: they only count as today's events still to come
    const open = tasks.filter(task => !task.done && !isEvent(task));
    const dueToday = open.filter(isToday).length;
    const overdue = open.filter(task => isOverdue(task, today)).length;
    const eventsToday = tasks.filter(task => isEvent(task) && !task.done && isToday(task)).length;
    return (
        <header className={styles.titleRow} data-part="home-title">
            <div className={styles.titleText}>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.summary}>
                {!loaded ? <Bone w="13rem" h="0.9375rem" style={{ margin: '0.25rem 0' }} />
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
            </p>
            </div>
            <SoloTogetherStrip />
        </header>
    );
}

// Home before the app knows it may load anything (the start screen, see AppSkeleton): the same
// layout, the parts that need no data as they are, grey where tasks and progress will be
export function HomeSkeleton() {
    const desktop = useMediaQuery(DESKTOP_QUERY);
    return (
        <div className={styles.page} data-part="home">
            <header className={styles.titleRow} data-part="home-title">
                <div className={styles.titleText}>
                    <h1 className={styles.title}>{useTodayTitle()}</h1>
                    <p className={styles.summary}><Bone w="13rem" h="0.9375rem" style={{ margin: '0.25rem 0' }} /></p>
                </div>
                <SoloTogetherStrip />
            </header>
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
export default function Home({ setActiveTimer }){
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

    const sessionParams = useSelector(state => state.session.sessionParams)
    const [timer, setTimer] = useState({time: sessionParams.time, active: false});
    const [workedTime, setWorkedTime] = useState(0);

    // --- task in focus, drag & drop ---
    // an open task to start with, never one that's already done
    const starterTask = tasks.find(task => !task.done && !isEvent(task)) || null;
    const [chosenTask, setActiveTask] = useState(starterTask);
    // tasks put back from the work area (not done): shown at the end of the list, latest last
    const [releasedIds, setReleasedIds] = useState([]);
    // a task from a shared session is read live, so done/assignee changes show up; it's gone
    // (nothing active) when I left the session or it ended. One of my own leaves the work area
    // as soon as the list says it's done or gone (finished in the calendar, on another device).
    const ownTask = chosenTask && !chosenTask.shared ? tasks.find(task => task.id === chosenTask.id) : null;
    const activeTask = chosenTask?.shared
        ? sharedTasks.find(task => task.id === chosenTask.id) ?? null
        : (ownTask && !ownTask.done ? chosenTask : null);

    // the shared sessions' tasks; changes arrive live afterwards (useLiveLists in App)
    useEffect(() => {
        dispatch(fetchMySharedTasks()).catch(() => {});
    }, [dispatch]);

    // time on a shared task goes to its session
    useSoloSharedWork(activeTask);

    const releaseActiveTask = () => {
        if (!activeTask) return;
        setReleasedIds(prev => [...prev.filter(id => id !== activeTask.id), activeTask.id]);
        setActiveTask(null);
    };

    // the button on a task row: the same as dropping it into the work area, which then comes
    // into view (on a phone it is far above the list)
    const activateTask = useCallback((task) => {
        setActiveTask(task);
        requestAnimationFrame(() => dropZoneRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }));
    }, []);

    const [draggedTask, setDraggedTask] = useState(null);
    const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const dropZoneRef = useRef(null);
    const draggedTaskRef = useRef(null);
    const dragPositionRef = useRef({ x: 0, y: 0 });

    useEffect(()=>{
        dispatch(updateCurrentSessionData({totalTime: workedTime}));
    }, [timer.time, dispatch, workedTime]);

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
            if (isOverDropZone) setActiveTask(currentTask);
        }

        draggedTaskRef.current = null;
        setDraggedTask(null);
    }, []);

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
    const timerPanel = <TimerContainer inline={desktop} setActiveTimer={setActiveTimer} setWorkedTime={setWorkedTime}
        timer={timer} setTimer={setTimer} activeTask={activeTask} />;

    const listedTasks = showSharedTasks ? [...tasks, ...sharedTasks] : tasks;
    return (
        <div className={styles.page} data-part="home">
            <TitleRow tasks={listedTasks} />
            {uiVariant === 'tafel' && <DepartureBoard tasks={listedTasks} activeTask={activeTask} />}
            {/* streak, today's challenges and level, friends: what keeps one going */}
            <div data-part="home-momentum" data-label={t('momentumTitle')}>
                <Momentum />
            </div>
            <TaskInvites />
            <div data-part="home-week" data-label={t('calendar')}>
                <WeekDaysContainer />
            </div>
            {createGroup && <div className={styles.formsDiv}>
                <GroupForm setCreateGroup={setCreateGroup}/>
            </div>}
            <div className={styles.columns} data-part="home-columns">
                <div className={styles.mainCol} data-part="home-list" data-label={t('taskContainer')}>
                    <GroupBtnContainer setCreateGroup={setCreateGroup} />
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
                </div>
                <aside className={styles.focusCol} aria-label={t('focusTitle')} data-part="home-focus" data-label={t('focusTitle')}>
                    <WorkingContainer
                        dropZoneRef={dropZoneRef}
                        activeTask={activeTask}
                        setActiveTask={setActiveTask}
                        onRelease={releaseActiveTask}
                        dragging={Boolean(draggedTask)}
                    />
                    {desktop && timerPanel}
                    {uiVariant === 'lesesaal' && <Seats />}
                </aside>
            </div>
            {!desktop && timerPanel}
        </div>
    );
}
