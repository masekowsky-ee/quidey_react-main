import { useState, useEffect, useRef } from "react";
import styles from './WorkingPage.module.css'
import { useSelector, useDispatch } from "react-redux";
import { createNote, deleteNote, editNote, updateTaskProps } from "../features/tasks/taskAction.js";
import {useTranslation} from '../i18n/useTranslation'
import { formatDate } from '../features/helperFunction'


export default function WorkingContainer (props) {
    const {dropZoneRef, activeTask, setActiveTask } = props;

        const dispatch = useDispatch();

        const {t} = useTranslation();

        const notes = useSelector(state => state.task.notes);

        const [editNoteState, setEditNoteState] = useState(false);

        const noteInputRef = useRef(null);
        useEffect(() => {
            if (editNoteState && noteInputRef.current) {
                noteInputRef.current.focus();
            }
        }, [editNoteState]);

        const handleCreateNoteSvg = () => {
            setEditNoteState(true);
        };

        const handleCreateNote = (e) => {
            if(!e.target.value) return;
            const newNote = e.target.value;
            dispatch(createNote(activeTask.id, newNote));
            setEditNoteState(false);
        }
        const handleDeleteNote = (noteId) => {
            dispatch(deleteNote(activeTask.id, noteId));
        }

        const handleEditNote = (e, noteId) => {
            dispatch(editNote(activeTask.id, noteId, e.target.value));
        }

        const [editActiveDescription, setEditActiveDescription] = useState(false);

        // Saves on blur only (Enter just blurs), and only when the text really changed,
        // so clicking in and out never sends a request or overwrites the description
        const saveDescription = (e) => {
            setEditActiveDescription(false);
            const description = e.target.value.trim();
            if (description === (activeTask.description ?? '')) return;
            setActiveTask(prev => ({...prev, description}));
            dispatch(updateTaskProps({description}, activeTask));
        }

        const setActiveDoneHandler = () => {
            dispatch(updateTaskProps({done: true}, activeTask));
            setActiveTask(null);
        }

        return(
            <div className={styles.div}>
                <div ref={dropZoneRef} className={`${styles.currentTaskDiv} ${activeTask ? '' : styles.dropZoneEmpty}`}>
                    {activeTask ? <div className={styles.taskCard}>
                        <div className={styles.taskCardHead}>
                            <h2 className={styles.taskTitle}>{activeTask.name}</h2>
                            {activeTask.due && <span className={styles.dueChip}>{formatDate(activeTask.due)}</span>}
                            <button className={styles.doneBtn} onClick={()=>{setActiveDoneHandler()}} title={t('markDone')} aria-label={t('markDone')}>
                                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="m382-354 339-339q12-12 28-12t28 12q12 12 12 28.5T777-636L410-268q-12 12-28 12t-28-12L182-440q-12-12-11.5-28.5T183-497q12-12 28.5-12t28.5 12l142 143Z"/></svg>
                            </button>
                        </div>
                        {activeTask.description && !editActiveDescription ?
                        <p onClick={()=>setEditActiveDescription(true)} className={styles.taskDesc} title={t('description')}>{activeTask.description}</p> :
                        <input
                            key={activeTask.id} // a fresh input per task, so text never carries over
                            className={styles.descInput}
                            defaultValue={activeTask.description ?? ''}
                            placeholder={t('description')}
                            autoFocus={editActiveDescription}
                            onBlur={saveDescription}
                            onKeyDown={(e)=>{ if(e.key === "Enter") e.currentTarget.blur(); }}
                        />}
                        <div className={styles.notesHead}>
                            <h3>{t('taskNotes')}</h3>
                            <svg className={styles.noteAdd} onClick={handleCreateNoteSvg} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M440-440H240q-17 0-28.5-11.5T200-480q0-17 11.5-28.5T240-520h200v-200q0-17 11.5-28.5T480-760q17 0 28.5 11.5T520-720v200h200q17 0 28.5 11.5T760-480q0 17-11.5 28.5T720-440H520v200q0 17-11.5 28.5T480-200q-17 0-28.5-11.5T440-240v-200Z"/></svg>
                        </div>
                        { editNoteState && <input ref={noteInputRef} id="noteInput" className={styles.newNoteInput} type="text" onBlur={(e)=>{handleCreateNote(e)}} onKeyDown={(e)=>{if(e.key === 'Enter') handleCreateNote(e)}} /> }
                        <ul className={styles.notesList}>
                            {activeTask && notes?.length > 0 && notes.map(
                                (n)=> n.task_id === activeTask.id ?
                                
                                <li className={styles.noteRow} key={n.id}>
                                <input type="text" className={styles.noteInput} defaultValue={n.content} onBlur={(e)=>handleEditNote(e, n.id)} onKeyDown={(e)=>{if(e.key === "Enter") handleEditNote(e, n.id)}}/>
                                <svg className={styles.noteDelete} onClick={()=>{handleDeleteNote(n.id)}} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520q-17 0-28.5-11.5T160-760q0-17 11.5-28.5T200-800h160q0-17 11.5-28.5T400-840h160q17 0 28.5 11.5T600-800h160q17 0 28.5 11.5T800-760q0 17-11.5 28.5T760-720v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM428.5-291.5Q440-303 440-320v-280q0-17-11.5-28.5T400-640q-17 0-28.5 11.5T360-600v280q0 17 11.5 28.5T400-280q17 0 28.5-11.5Zm160 0Q600-303 600-320v-280q0-17-11.5-28.5T560-640q-17 0-28.5 11.5T520-600v280q0 17 11.5 28.5T560-280q17 0 28.5-11.5ZM280-720v520-520Z"/></svg>
                            </li> : null)}
                        </ul>
                    </div> : <p className={styles.dropHint}>{t('dragATask')}</p>}
                </div>
            </div>
        )
}