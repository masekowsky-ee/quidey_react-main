import { useState, useEffect, useRef } from "react";
import styles from './WorkingPage.module.css'
import { useSelector, useDispatch } from "react-redux";
import { createNote, deleteNote, editNote, updateTaskProps } from "../features/tasks/taskAction.js";
import {useTranslation} from '../i18n/useTranslation'
import { dueText, formatClock } from '../features/helperFunction'
import { selectTaskTime } from '../features/session/sessionAction'
import { setSharedTaskDone, togetherErrorText } from '../features/together/togetherAction'
import { showToast } from '../features/toast/toast'
import { Link } from 'react-router-dom'
import TaskLabels from './TaskLabels.jsx'
import Icon from './icons.jsx'

// The focus column's card with nothing in focus yet, for the start screen (AppSkeleton)
export function FocusSkeleton() {
    const { t } = useTranslation();
    return (
        <section className={styles.focus} data-part="focus">
            <h2 className={styles.focusTitle}>{t('focusTitle')}</h2>
            <div className={`${styles.currentTaskDiv} ${styles.dropZoneEmpty}`}>
                <div className={styles.dropHint}>
                    <Icon name="focus" className={styles.dropIcon} />
                    <p className={styles.dropTitle}>{t('dragATask')}</p>
                    <p className={styles.dropText}>{t('focusHint')}</p>
                </div>
            </div>
        </section>
    );
}
import { motion, useDragControls } from 'motion/react'
import { useMotionLevel, burstFrom } from '../features/settings/motion'
import { playSound } from '../features/settings/sound'

// how far (px) or how fast (px/s) the card has to be swiped to put the task back
const SWIPE_DISTANCE = 110;
const SWIPE_SPEED = 600;

// The task being worked on ("Focus"): its name, the time on it in this session, its description
// and notes; done or put back from here. Empty, it is the place a task is dragged to.
// dragging: a task is on its way here (the empty zone lights up).
export default function WorkingContainer (props) {
    const {dropZoneRef, activeTask, setActiveTask, onRelease, dragging = false } = props;

    const dispatch = useDispatch();
    const {t} = useTranslation();
    const motionLevel = useMotionLevel();
    // the card can be swiped sideways by its head (not by the fields inside it)
    const dragControls = useDragControls();
    const startSwipe = (e) => { if (!e.target.closest('button, input, textarea')) dragControls.start(e); };
    const onSwipeEnd = (_, info) => {
        if (Math.abs(info.offset.x) > SWIPE_DISTANCE || Math.abs(info.velocity.x) > SWIPE_SPEED) onRelease?.();
    };

    const notes = useSelector(state => state.task.notes);
    const taskSeconds = useSelector(state => activeTask ? selectTaskTime(state, activeTask.id) : 0);

    const [addingNote, setAddingNote] = useState(false);
    const noteInputRef = useRef(null);
    useEffect(() => {
        if (addingNote) noteInputRef.current?.focus();
    }, [addingNote]);

    const handleCreateNote = (e) => {
        const text = e.target.value.trim();
        setAddingNote(false);
        if (!text) return;
        dispatch(createNote(activeTask.id, text));
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

    const setActiveDoneHandler = (e) => {
        // finishing the task in focus is worth a burst on "normal", a big one on "extreme"
        playSound('done');
        if (motionLevel === 'extreme' && e?.currentTarget) {
            burstFrom(e.currentTarget, 60);
            const target = e.currentTarget;
            setTimeout(() => burstFrom(target, 40), 180);
        } else if (motionLevel === 'normal' && e?.currentTarget) {
            burstFrom(e.currentTarget, 30);
        }
        if (activeTask.shared) {
            dispatch(setSharedTaskDone(activeTask.shared.sessionId, activeTask.shared.taskId, true))
                .catch(err => dispatch(showToast(togetherErrorText(t, err), 'error')));
        } else {
            dispatch(updateTaskProps({done: true}, activeTask));
        }
        setActiveTask(null);
    }

    // name, then "put back" and "done"; the head is where the card is grabbed to swipe it away
    const head = (
        <div className={`${styles.taskCardHead} ${styles.swipeHandle}`} onPointerDown={startSwipe}>
            <h2 className={styles.taskTitle}>{activeTask?.name}</h2>
            <button className={styles.releaseBtn} onClick={onRelease} title={t('releaseTask')} aria-label={t('releaseTask')}>
                <Icon name="release" className={styles.headIcon} />
            </button>
            <button className={styles.doneBtn} onClick={setActiveDoneHandler} title={t('markDone')} aria-label={t('markDone')}>
                <Icon name="check" className={styles.headIcon} strokeWidth={2.2} />
            </button>
        </div>
    );
    const time = (
        <p className={styles.taskTime}>
            {t('timeThisSession')} <span>{formatClock(taskSeconds * 1000)}</span>
            {activeTask?.due && !activeTask.shared && <> · {dueText(activeTask.due, t)}</>}
        </p>
    );

    return (
        <section className={styles.focus} aria-labelledby="focus-title" data-part="focus" data-active={activeTask ? 'true' : undefined}>
            <h2 id="focus-title" className={styles.focusTitle}>{t('focusTitle')}</h2>
            <div ref={dropZoneRef}
                className={`${styles.currentTaskDiv} ${activeTask ? '' : styles.dropZoneEmpty} ${dragging ? styles.dropReady : ''} ${activeTask?.shared ? styles.sharedPanel : ''}`}>
                {!activeTask
                    ? <div className={styles.dropHint}>
                        <Icon name="focus" className={styles.dropIcon} />
                        <p className={styles.dropTitle}>{t('dragATask')}</p>
                        <p className={styles.dropText}>{t('focusHint')}</p>
                    </div>
                    : activeTask.shared
                    // a task from a shared session: its time goes to the session; notes and editing stay there
                    ? <motion.div key={activeTask.id} className={styles.taskCard}
                        drag="x" dragListener={false} dragControls={dragControls} dragSnapToOrigin dragElastic={0.6} onDragEnd={onSwipeEnd}>
                        {head}
                        <TaskLabels task={activeTask} />
                        {time}
                        {activeTask.description && <p className={styles.taskDesc}>{activeTask.description}</p>}
                        <p className={styles.sharedNote}>
                            {t('sharedTaskWorkHint')} <Link to={`/together/${activeTask.shared.sessionId}`}>{t('openSession')} →</Link>
                        </p>
                    </motion.div>
                    : <motion.div key={activeTask.id} className={styles.taskCard}
                        drag="x" dragListener={false} dragControls={dragControls} dragSnapToOrigin dragElastic={0.6} onDragEnd={onSwipeEnd}>
                        {head}
                        {time}
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
                            <button className={styles.noteAdd} onClick={() => setAddingNote(true)} aria-label={t('addNote')} title={t('addNote')}>
                                <Icon name="plus" className={styles.noteIcon} strokeWidth={2} />
                            </button>
                        </div>
                        {addingNote && <input ref={noteInputRef} className={styles.newNoteInput} type="text" aria-label={t('addNote')}
                            onBlur={handleCreateNote}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setAddingNote(false); }} />}
                        <ul className={styles.notesList}>
                            {notes?.filter(note => note.task_id === activeTask.id).map(note =>
                                <li className={styles.noteRow} key={note.id}>
                                    <input type="text" className={styles.noteInput} defaultValue={note.content} aria-label={t('taskNotes')}
                                        onBlur={(e) => dispatch(editNote(activeTask.id, note.id, e.target.value))}
                                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
                                    <button className={styles.noteDelete} onClick={() => dispatch(deleteNote(activeTask.id, note.id))}
                                        aria-label={`${t('deleteNote')}: ${note.content}`} title={t('deleteNote')}>
                                        <Icon name="trash" className={styles.noteIcon} />
                                    </button>
                                </li>)}
                        </ul>
                        <p className={styles.swipeHint}>{t('releaseTaskHint')}</p>
                    </motion.div>}
            </div>
        </section>
    )
}
