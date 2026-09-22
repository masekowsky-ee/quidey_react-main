import { useState, useEffect, useRef } from "react";
import styles from './WorkingPage.module.css'
import TimerContainer from "./TimerContainer.jsx";
import { useSelector, useDispatch } from "react-redux";
import { createNote, deleteNote } from "../features/tasks/taskAction.js";

export default function WorkingContainer (props) {
    const { t, setTasks, dropZoneRef, activeTask, setActiveTask, workedTasks, setWorkedTasks, setSessionParams } = props;

        const dispatch = useDispatch();

        const sessionParams = useSelector(state => state.session.sessionParams);

        const [editNote, setEditNote] = useState(false);

        const [timer, setTimer] = useState({time: sessionParams.time, active: false});
        const [workedTime, setWorkedTime] = useState(0);

        /*class sessionData {
            constructor(group, tasksArray){
                this.time = workedTime;
                this.workedTasks = tasksArray;
                this.group = group;
                this.date = new Date();
            }
        } */

        useEffect(()=>{
            setWorkedTasks(prev => prev.map(p => p?.index === activeTask?.index ? {...p, time: p?.time + 1} : p))
        }, [workedTime, activeTask, setWorkedTasks])

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
            const newNote = {note: e.target.value, index: new Date()};
            const updatedTask = { ...activeTask, notes: [...(activeTask.notes || []), newNote] };
            dispatch(createNote(activeTask.index, newNote));
            setActiveTask(updatedTask);
            setEditNote(false);
            console.log(newNote);
        }
        const handleDeleteNote = (noteIndex) => {
            const filteredNotes = activeTask.notes.filter(n=> n.index!== noteIndex);
            const updatedTask = { ...activeTask, notes: filteredNotes };
            dispatch(deleteNote(activeTask.index, noteIndex));
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
                            {activeTask && activeTask.notes?.length > 0 && activeTask.notes.map((n)=><div className={styles.notesDiv} key={n.index}>
                                <input type="text" className={styles.noteInput} value={n.note} onChange={(e)=>handleEditNote(e, n.index)} />
                                <svg onClick={()=>{handleDeleteNote(n.index)}} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520q-17 0-28.5-11.5T160-760q0-17 11.5-28.5T200-800h160q0-17 11.5-28.5T400-840h160q17 0 28.5 11.5T600-800h160q17 0 28.5 11.5T800-760q0 17-11.5 28.5T760-720v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM428.5-291.5Q440-303 440-320v-280q0-17-11.5-28.5T400-640q-17 0-28.5 11.5T360-600v280q0 17 11.5 28.5T400-280q17 0 28.5-11.5Zm160 0Q600-303 600-320v-280q0-17-11.5-28.5T560-640q-17 0-28.5 11.5T520-600v280q0 17 11.5 28.5T560-280q17 0 28.5-11.5ZM280-720v520-520Z"/></svg>
                            </div>)}
                        </ul>
                    </div> : <p>{t('dragATask')}</p>}
                </div>
            </div>
        )
}