import { useState, useEffect, useRef, useCallback } from "react";
import styles from './WorkingPage.module.css'
import { useNavigate } from "react-router-dom";
import TimerContainer from "./TimerContainer.jsx";
import { useSelector, useDispatch } from "react-redux";
import { saveSessionData } from "../features/session/sessionAction.js";

export default function WorkingPage(props){
    const { t, setTasks } = props;

    const navigate = useNavigate();

    const dispatch = useDispatch();

    const tasks = useSelector(state => state.task.tasks);
    const sessionParams = useSelector(state => state.session.sessionParams);

    const [editNote, setEditNote] = useState(false);

    const [timer, setTimer] = useState({time: sessionParams.time, active: false});
    const [activeTask, setActiveTask] = useState(null);
    const [workedTasks, setWorkedTasks] = useState([]);
    const [workedTime, setWorkedTime] = useState(0);

    class sessionData {
        constructor(group, tasksArray){
            this.time = workedTime;
            this.workedTasks = [tasksArray];
            this.group = group;
            this.date = new Date();
        }
    }

    // New state for drag logic:
    const [draggedTask, setDraggedTask] = useState(null); // currently dragged task
    const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 }); // current pointer position (fürs Rendering)
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 }); // distance from clickpoint to element corner

    const dropZoneRef = useRef(null);
    // Refs spiegeln draggedTask/dragPosition, damit handlePointerUp
    // immer den aktuellen Wert lesen kann, ohne dass sich die Funktionsreferenz ändert
    const draggedTaskRef = useRef(null);
    const dragPositionRef = useRef({ x: 0, y: 0 });

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
        setDragPosition({ x: e.clientX, y: e.clientY }); // löst Re-Render fürs Floating-Element aus
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
                setWorkedTasks(prev => [...prev, currentTask]);
            }
        }

        draggedTaskRef.current = null;
        setDraggedTask(null);
    }, []); // <- bleibt stabil, keine Deps nötig

    useEffect(() => {
        // Nur registrieren, solange aktiv gedraggt wird
        if (!draggedTask) return;

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
        };
    }, [draggedTask, handlePointerMove, handlePointerUp]); // handlePointerMove/Up ändern sich nie mehr → Effect läuft nur noch bei draggedTask-Wechsel

    const handleSessionDone = () => {
        const currentSession = new sessionData(sessionParams.group, workedTasks);
        if (currentSession.time > 0){
            dispatch(saveSessionData(currentSession));
        }
        navigate('/');
    }

    const noteInputRef = useRef(null);
    useEffect(() => {
        if (editNote && noteInputRef.current) {
            noteInputRef.current.focus();
        }
    }, [editNote]);

    const handleCreateNoteSvg = () => {
        setEditNote(true);
    };

    const handleCreateNote = (e) => {
        if(!e.target.value) return;
        const newNote = {note: e.target.value, index: activeTask.notes[activeTask.notes.length-1]?.index + 1 || 0};
        const updatedTask = { ...activeTask, notes: [...(activeTask.notes || []), newNote] };
        setTasks((prev) =>
            prev.map((t) => (t.index === activeTask.index ? updatedTask : t))
        );
        setActiveTask(updatedTask);
        setEditNote(false);
        console.log(newNote);
    }
    const handleDeleteNote = (noteIndex) => {
        const filteredNotes = activeTask.notes.filter(n=> n.index!== noteIndex);
        const updatedTask = { ...activeTask, notes: filteredNotes };
        setTasks((prev) =>
            prev.map((t) => (t.index === activeTask.index ? updatedTask : t))
        );
        setActiveTask(updatedTask);
    }

    const handleEditNote = (e, noteIndex) => {
        const updatedNote = {note: e.target.value, index: noteIndex}
        const updatedNotes = activeTask.notes.map((n)=>n.index === noteIndex ? updatedNote : n);
        const updatedTask = { ...activeTask, notes: updatedNotes };
        setTasks((prev) =>
            prev.map((t) => (t.index === activeTask.index ? updatedTask : t))
        );
        setActiveTask(updatedTask);
    }

    return(
        <div className={styles.div}>
            <h2 className={styles.h2}>{t('currentGroup')}: {sessionParams.group === 'all' ? t('all') : sessionParams.group}</h2>
            <TimerContainer setWorkedTime={setWorkedTime} timer={timer} setTimer={setTimer} />
            <div ref={dropZoneRef} className={styles.currentTaskDiv}>
                {activeTask ? <div>
                    <h2>{activeTask.name}</h2>
                    <p>{activeTask.description}</p>
                    <p>{activeTask.due}</p>
                    <div className={styles.notesDiv}>
                        <h3>{t('taskNotes')}  </h3>
                        <svg onClick={handleCreateNoteSvg} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M440-440v120q0 17 11.5 28.5T480-280q17 0 28.5-11.5T520-320v-120h120q17 0 28.5-11.5T680-480q0-17-11.5-28.5T640-520H520v-120q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640v120H320q-17 0-28.5 11.5T280-480q0 17 11.5 28.5T320-440h120Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/></svg>
                    </div>
                    { editNote && <input ref={noteInputRef} id="noteInput" type="text" onBlur={(e)=>{handleCreateNote(e)}} onKeyDown={(e)=>{if(e.key === 'Enter') handleCreateNote(e)}} /> }
                    <ul className={styles.ul}>
                        {activeTask.notes.length > 0 && activeTask.notes.map((n)=><div className={styles.notesDiv} key={n.index}>
                            <input type="text" className={styles.noteInput} value={n.note} onChange={(e)=>handleEditNote(e, n.index)} />
                            <svg onClick={()=>{handleDeleteNote(n.index)}} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520q-17 0-28.5-11.5T160-760q0-17 11.5-28.5T200-800h160q0-17 11.5-28.5T400-840h160q17 0 28.5 11.5T600-800h160q17 0 28.5 11.5T800-760q0 17-11.5 28.5T760-720v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM428.5-291.5Q440-303 440-320v-280q0-17-11.5-28.5T400-640q-17 0-28.5 11.5T360-600v280q0 17 11.5 28.5T400-280q17 0 28.5-11.5Zm160 0Q600-303 600-320v-280q0-17-11.5-28.5T560-640q-17 0-28.5 11.5T520-600v280q0 17 11.5 28.5T560-280q17 0 28.5-11.5ZM280-720v520-520Z"/></svg>
                        </div>)}
                    </ul>
                </div> : <p>{t('dragATask')}</p>}
            </div>
            <ul className={styles.ul}>
                {tasks.filter(task => task.groups.includes(sessionParams.group)) 
                    .map(task => {
                    if (task.done || task.index === activeTask?.index) { return null; }

                    // Check if this specific task is the one currently being dragged
                    const isBeingDragged = draggedTask?.index === task.index;

                    // Calculate the floating position only if this task is being dragged
                    const dragStyle = isBeingDragged ? {
                        position: "fixed",
                        left: dragPosition.x - dragOffset.x,
                        top: dragPosition.y - dragOffset.y,
                        zIndex: 1000,
                        pointerEvents: "none", // prevents the floating element from blocking pointer events underneath
                    } : undefined;

                    return (
                        <li className={styles.li} key={`t${task.index}`} style={dragStyle}>
                            <div className={styles.pDiv}>
                                <p>{task.name}</p>
                                <p>{task.due}</p>
                            </div>
                            <svg onPointerDown={(e) => handlePointerDown(e, task)} className={styles.dragSvg} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor" style={{ touchAction: "none" }}><path d="M360-160q-33 0-56.5-23.5T280-240q0-33 23.5-56.5T360-320q33 0 56.5 23.5T440-240q0 33-23.5 56.5T360-160Zm240 0q-33 0-56.5-23.5T520-240q0-33 23.5-56.5T600-320q33 0 56.5 23.5T680-240q0 33-23.5 56.5T600-160ZM360-400q-33 0-56.5-23.5T280-480q0-33 23.5-56.5T360-560q33 0 56.5 23.5T440-480q0 33-23.5 56.5T360-400Zm240 0q-33 0-56.5-23.5T520-480q0-33 23.5-56.5T600-560q33 0 56.5 23.5T680-480q0 33-23.5 56.5T600-400ZM360-640q-33 0-56.5-23.5T280-720q0-33 23.5-56.5T360-800q33 0 56.5 23.5T440-720q0 33-23.5 56.5T360-640Zm240 0q-33 0-56.5-23.5T520-720q0-33 23.5-56.5T600-800q33 0 56.5 23.5T680-720q0 33-23.5 56.5T600-640Z"/></svg>
                        </li>
                    );
                })}
            </ul>
            <button onClick={handleSessionDone} className={styles.sessionDoneBtn}>{t('sessionDone')}</button>
        </div>
    )
}