import { useState, useRef, useCallback, useEffect } from 'react'
import TaskContainer from './TaskContainer.jsx'
import TaskForm from './TaskForm.jsx'
import styles from './Home.module.css';
import GroupForm from './GroupForm.jsx';
import { Outlet } from 'react-router-dom';
import WeekDaysContainer from './WeekDaysContainer.jsx';
import GroupBtnContainer from './GroupBtnContainer.jsx';
import WorkingContainer from './WorkingContainer.jsx';
import TimerContainer from './TimerContainer.jsx';
import SoloTogetherStrip from './together/SoloTogetherStrip.jsx';
import { updateCurrentSessionData, addWorkedTask } from '../features/session/sessionAction.js'

import {useSelector, useDispatch} from 'react-redux';

export default function Home(props){
    const {t, setCustomError, setActiveTimer} = props;

    const dispatch = useDispatch();

    const tasks = useSelector(state => state.task.tasks);

    const [groupToDisplayName, setGroupToDisplayName] = useState('all');

    const [createTask, setCreateTask] = useState(false);
    const [createGroup, setCreateGroup] = useState(false);

    const sessionParams = useSelector(state => state.session.sessionParams)
    const [timer, setTimer] = useState({time: sessionParams.time, active: false});
    const [workedTime, setWorkedTime] = useState(0);

    // --- Gehobener State für Drag & Drop + aktive Task/Worked Tasks ---
    const starterTask = tasks[0] || null;
    const [activeTask, setActiveTask] = useState(starterTask);

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
        const liElement = e.currentTarget.closest("li");
        const rect = liElement.getBoundingClientRect();

        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;

        draggedTaskRef.current = task;
        dragPositionRef.current = { x: e.clientX, y: e.clientY };

        setDraggedTask(task);
        setDragOffset({ x: offsetX, y: offsetY });
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

            if (isOverDropZone) {
                setActiveTask(currentTask);
            }
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
    // --- Ende gehobener State ---

    return (
        <div className={styles.div}>
            <SoloTogetherStrip />
            <WeekDaysContainer t={t} tasks={tasks} />
            {(createTask || createGroup) && <div className={styles.formsDiv}>
                {createTask && <TaskForm setCreateTask={setCreateTask}/>}
                {createGroup && <GroupForm setCreateGroup={setCreateGroup}/>}
            </div>}
            <WorkingContainer
                t={t}
                dropZoneRef={dropZoneRef}
                activeTask={activeTask}
                setTasks={props.setTasks}
                setActiveTask={setActiveTask}
            />
            <GroupBtnContainer 
                setCreateGroup={setCreateGroup} 
                t={t}
                setGroupToDisplayName={setGroupToDisplayName} 
                groupToDisplayName={groupToDisplayName} 
            />
            <div className={styles.tcc}>
                <TaskContainer
                    activeTask={activeTask}
                    setCreateTask={setCreateTask}
                    working={false}
                    tasks={props.tasks}
                    groupToDisplayName={groupToDisplayName}
                    setTasks={props.setTasks}
                    t={props.t}
                    groups={props.groups}
                    setGroups={props.setGroups}
                    setCustomError={setCustomError}
                    handlePointerDown={handlePointerDown}
                    draggedTask={draggedTask}
                    dragPosition={dragPosition}
                    dragOffset={dragOffset}
                />
            </div>
            <TimerContainer setActiveTimer={setActiveTimer} setWorkedTime={setWorkedTime} timer={timer} setTimer={setTimer} activeTask={activeTask} />
            <Outlet />
        </div>
    );
}