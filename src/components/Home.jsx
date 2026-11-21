import { useState, useRef, useCallback, useEffect } from 'react'
import TaskContainer from './TaskContainer.jsx'
import { showForms } from '../features/settings/settingsAction.js'
import styles from './Home.module.css';
import GroupForm from './GroupForm.jsx';
import { FormSheet } from './QuickAdd.jsx';
import WeekDaysContainer from './WeekDaysContainer.jsx';
import GroupBtnContainer from './GroupBtnContainer.jsx';
import WorkingContainer from './WorkingContainer.jsx';
import TimerContainer from './TimerContainer.jsx';
import TaskInvites from './task/TaskInvites.jsx';
import Momentum from './home/Momentum.jsx';
import { addWorkedTask, setFocusTask, selectFocusTask } from '../features/session/sessionAction.js'
import { fetchMySharedTasks, selectSharedSoloTasks } from '../features/together/togetherAction.js'
import Today from './home/Today.jsx'
import HomeExtras from './home/HomeExtras.jsx'
import { useHomeKinds } from '../features/home/kinds.js'
import { pinCardNote, clearCardNote } from '../features/home/cardNote.js'
import DayPlan from './home/DayPlan.jsx'
import TitleRow from './home/TitleRow.jsx'
import FocusSheet from './home/FocusSheet.jsx'
import ReplanCard from './study/ReplanCard.jsx'
import { DESKTOP_QUERY, useMediaQuery } from '../features/layout/breakpoints.js'
import { isEvent } from '../features/tasks/kinds.js'
import { selectHasMax } from '../features/pro/pro.js'
import { useTranslation } from '../i18n/useTranslation.js'
import { DEFAULT_UI_VARIANT, useUiVariant } from '../features/tester/variants.js'
import DepartureBoard from './variants/DepartureBoard.jsx'
import Seats from './variants/Seats.jsx'

import {useSelector, useDispatch} from 'react-redux';
import { useRequireAccount } from '../features/auth/gate.js'

// Home, "solo" layout: the day's title, the next days, the task list, and the focus column
// (the task being worked on and the timer). Wide screens put the focus column beside the list,
// where it stays in view; narrower ones show the task in focus above the list and fold the
// timer into a button in the corner.
export default function Home(){
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const desktop = useMediaQuery(DESKTOP_QUERY);

    const tasks = useSelector(state => state.task.tasks);
    const hasMax = useSelector(selectHasMax);
    const sharedTasks = useSelector(selectSharedSoloTasks);
    const showSharedTasks = useSelector(state => state.settings.showSharedTasks);
    // testers' interface variants arrange Home their own way (src/ui-variants) and add a part:
    // the departure board (Abfahrtstafel), the reading room's seats (Lesesaal)
    const uiVariant = useUiVariant();
    const [kinds, toggleKind] = useHomeKinds();

    const setCreateTask = useCallback((open) => dispatch(showForms(Boolean(open))), [dispatch]);
    const [createGroup, setCreateGroupOpen] = useState(false);
    const requireAccount = useRequireAccount();
    const setCreateGroup = (open) => (open ? requireAccount(() => setCreateGroupOpen(true)) : setCreateGroupOpen(false));

    // The task in focus lives in the store (the Fokusraum and the timer on every page use it):
    // a task from a shared session is read live, so done/assignee changes show up; it's gone
    // (nothing active) when I left the session or it ended. One of my own leaves the work area
    // as soon as the list says it's done or gone (finished in the calendar, on another device).
    const activeTask = useSelector(selectFocusTask);
    const focusTask = useSelector(state => state.session.focusTask);
    const focusPicked = useSelector(state => state.session.focusPicked);
    const setActiveTask = useCallback((next) =>
        dispatch(setFocusTask(typeof next === 'function' ? next(focusTask) : next)), [dispatch, focusTask]);
    const starterTask = tasks.find(task => !task.done && !isEvent(task)) || null;
    useEffect(() => {
        if (!focusPicked && starterTask) dispatch(setFocusTask(starterTask));
    }, [focusPicked, starterTask, dispatch]);
    const [releasedIds, setReleasedIds] = useState([]);

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
        clearCardNote(); // a task picked by hand takes the card back from a note
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
            // a note dropped there goes into the card (no focus), a task into focus
            if (isOverDropZone) {
                if (currentTask.noteId) pinCardNote(currentTask.noteId);
                else { clearCardNote(); dispatch(setFocusTask(currentTask)); }
            }
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

    const timerPanel = <TimerContainer inline={desktop} />;

    const listedTasks = showSharedTasks ? [...tasks, ...sharedTasks] : tasks;
    const groupForm = createGroup && <FormSheet onClose={() => setCreateGroupOpen(false)}>
        {(sheet, close) => <GroupForm sheet={sheet} setCreateGroup={(value) => { if (!value) close(); }} />}
    </FormSheet>;
    const listProps = {
        activeTask, releasedIds, onActivate: activateTask, setCreateTask, handlePointerDown, draggedTask, dragPosition, dragOffset,
    };
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
                    <TaskContainer {...listProps} plain kinds={kinds} onToggleKind={toggleKind} />
                    <HomeExtras kinds={kinds} onDragNote={handlePointerDown} />
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

    return (
        <div className={styles.page} data-part="home">
            <TitleRow tasks={listedTasks} focusTask={activeTask} />
            {uiVariant === 'tafel' && <DepartureBoard tasks={listedTasks} activeTask={activeTask} />}
            <div data-part="home-momentum" data-label={t('momentumTitle')}>
                <Momentum />
            </div>
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
                    <TaskContainer {...listProps} />
                </div>
                <aside className={styles.focusCol} aria-label={t('focusTitle')} data-part="home-focus" data-label={t('focusTitle')}>
                    {working}
                    {desktop && timerPanel}
                    {uiVariant === 'lesesaal' && <Seats />}
                </aside>
            </div>
            {/* folded in the bottom left (the add button, from App, is in the bottom right); Max accounts have
                the assistant's button there instead, and the Fokusraum and the focus sheet for the timer */}
            {!desktop && !hasMax && timerPanel}
        </div>
    );
}
