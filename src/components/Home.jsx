import { useState, useRef, useCallback, useEffect } from 'react'
import TaskContainer from './TaskContainer.jsx'
import TaskForm from './TaskForm.jsx'
import styles from './Home.module.css';
import GroupForm from './GroupForm.jsx';
import WeekDaysContainer from './WeekDaysContainer.jsx';
import GroupBtnContainer from './GroupBtnContainer.jsx';
import WorkingContainer from './WorkingContainer.jsx';
import TimerContainer from './TimerContainer.jsx';
import SoloTogetherStrip from './together/SoloTogetherStrip.jsx';
import TaskInvites from './task/TaskInvites.jsx';
import { updateCurrentSessionData, addWorkedTask } from '../features/session/sessionAction.js'
import { fetchMySharedTasks, selectSharedSoloTasks } from '../features/together/togetherAction.js'
import { useSoloSharedWork } from '../features/together/useSoloSharedWork.js'
import { DESKTOP_QUERY, useMediaQuery } from '../features/layout/breakpoints.js'
import { fill, isOverdue, sameDay, parseDate } from '../features/helperFunction.js'
import { isEvent } from '../features/tasks/kinds.js'
import { useTranslation } from '../i18n/useTranslation.js'

import {useSelector, useDispatch} from 'react-redux';

// "Thursday, 22 October" and how the day looks: open tasks, due today, overdue (the tasks the
// list shows, so both say the same number); the Solo | Team switch on the right
function TitleRow({ tasks }) {
    const { t, language } = useTranslation();
    const today = new Date();
    const title = new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB',
        { weekday: 'long', day: 'numeric', month: 'long' }).format(today);
    const isToday = (task) => { const due = parseDate(task.due); return due && sameDay(due, today); };
    // events aren't to-dos: they only count as today's events still to come
    const open = tasks.filter(task => !task.done && !isEvent(task));
    const dueToday = open.filter(isToday).length;
    const overdue = open.filter(task => isOverdue(task, today)).length;
    const eventsToday = tasks.filter(task => isEvent(task) && !task.done && isToday(task)).length;
    return (
        <header className={styles.titleRow}>
            <div className={styles.titleText}>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.summary}>
                {open.length === 0
                    ? <span>{t('allDoneToday')}</span>
                    : <>
                        <span>{fill(t('openTasksCount'), { count: open.length })}</span>
                        {dueToday > 0 && <span>{fill(t('dueTodayCount'), { count: dueToday })}</span>}
                        {overdue > 0 && <span className={styles.overdue}>{fill(t('overdueCount'), { count: overdue })}</span>}
                    </>}
                {eventsToday > 0 && <span>{fill(t(eventsToday === 1 ? 'eventsTodayOne' : 'eventsTodayCount'), { count: eventsToday })}</span>}
            </p>
            </div>
            <SoloTogetherStrip />
        </header>
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

    const [createTask, setCreateTask] = useState(false);
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

    return (
        <div className={styles.page}>
            <TitleRow tasks={showSharedTasks ? [...tasks, ...sharedTasks] : tasks} />
            <TaskInvites />
            <WeekDaysContainer />
            {(createTask || createGroup) && <div className={styles.formsDiv}>
                {createTask && <TaskForm setCreateTask={setCreateTask}/>}
                {createGroup && <GroupForm setCreateGroup={setCreateGroup}/>}
            </div>}
            <div className={styles.columns}>
                <div className={styles.mainCol}>
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
                <aside className={styles.focusCol} aria-label={t('focusTitle')}>
                    <WorkingContainer
                        dropZoneRef={dropZoneRef}
                        activeTask={activeTask}
                        setActiveTask={setActiveTask}
                        onRelease={releaseActiveTask}
                        dragging={Boolean(draggedTask)}
                    />
                    {desktop && timerPanel}
                </aside>
            </div>
            {!desktop && timerPanel}
        </div>
    );
}
