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

        //const [timer, setTimer] = useState({time: sessionParams.time, active: false});
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
                <div ref={dropZoneRef} className={styles.currentTaskDiv}>
                    {activeTask ? <div>
                        
                        <h2>{activeTask.name}</h2>
                        <p>{activeTask.description}</p>
                        <p>{activeTask.due}</p>
                        <div className={styles.notesDiv}>
                            <h3>{t('taskNotes')}  </h3>
                            <svg onClick={handleCreateNoteSvg} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M440-440H240q-17 0-28.5-11.5T200-480q0-17 11.5-28.5T240-520h200v-200q0-17 11.5-28.5T480-760q17 0 28.5 11.5T520-720v200h200q17 0 28.5 11.5T760-480q0 17-11.5 28.5T720-440H520v200q0 17-11.5 28.5T480-200q-17 0-28.5-11.5T440-240v-200Z"/></svg>
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