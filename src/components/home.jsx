import { useState, useRef, useCallback, useEffect } from 'react'
import TaskContainer from './TaskContainer.jsx'
import TaskForm from './TaskForm.jsx'
import styles from './Home.module.css';
import GroupForm from './GroupForm.jsx';
import { Outlet } from 'react-router-dom';
import WeekDaysContainer from './WeekDaysContainer.jsx';
import GroupBtnContainer from './GroupBtnContainer.jsx';
import WorkingContainer from './WorkingContainer.jsx';

export default function Home(props){
    const {t, tasks, groups, setGroups, setSessionParams, setCustomError, showDone, setShowDone} = props;

    const [groupToDisplayName, setGroupToDisplayName] = useState('all');

    const [createTask, setCreateTask] = useState(false);
    const [createGroup, setCreateGroup] = useState(false);

    // --- Gehobener State für Drag & Drop + aktive Task/Worked Tasks ---
    const starterTask = tasks[0] || null;
    const [activeTask, setActiveTask] = useState(starterTask);
    const [workedTasks, setWorkedTasks] = useState(starterTask ? [{name: starterTask.name, index: starterTask.index, time: 0}] : [null]);

    const [draggedTask, setDraggedTask] = useState(null);
    const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const dropZoneRef = useRef(null);
    const draggedTaskRef = useRef(null);
    const dragPositionRef = useRef({ x: 0, y: 0 });

    const handlePointerDown = useCallback((e, task) => {
        console.log('pointerdown fired', task); // TEST
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
                setWorkedTasks(prev => prev.find(t => t?.index === currentTask.index) ? prev : [...prev, {name: currentTask.name, time: 0, index: currentTask.index}]);
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

    console.log(props.tasks);
    return (
        <div className={styles.div}>
            <WeekDaysContainer t={t} tasks={tasks} />
            {(createTask || createGroup) && <div className={styles.formsDiv}>
                {createTask && <TaskForm setCreateTask={setCreateTask} setCustomError={setCustomError} setTasks={props.setTasks} t={props.t} setGroups={props.setGroups} taskIndexCounter={props.taskIndexCounter} setTaskIndexCounter={props.setTaskIndexCounter} />}
                {createGroup && <GroupForm setCreateGroup={setCreateGroup} t={props.t} setGroups={props.setGroups} groups={props.groups} setCustomError={setCustomError} />}
            </div>}
            <WorkingContainer
                t={t}
                dropZoneRef={dropZoneRef}
                activeTask={activeTask}
                setActiveTask={setActiveTask}
                workedTasks={workedTasks}
                setWorkedTasks={setWorkedTasks}
                setTasks={props.setTasks}
                setSessionParams={setSessionParams}
            />
            <GroupBtnContainer 
                setCreateGroup={setCreateGroup} 
                t={t} groups={groups} 
                setGroups={setGroups} 
                setGroupToDisplayName={setGroupToDisplayName} 
                groupToDisplayName={groupToDisplayName} 
            />
            <div className={styles.tcc}>
                <TaskContainer
                    setCreateTask={setCreateTask}
                    working={false}
                    showDone={showDone}
                    setShowDone={setShowDone}
                    setSessionParams={setSessionParams}
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
            <Outlet />
        </div>
    );
}