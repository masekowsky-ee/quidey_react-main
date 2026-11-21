import { useState } from "react";
import styles from './WorkingPage.module.css'
import { useSelector } from "react-redux";
import TaskNoteRow from "./task/TaskNoteRow.jsx";
import {useTranslation} from '../i18n/useTranslation'
import { dueText, formatClock } from '../features/helperFunction'
import { selectTaskTime } from '../features/session/sessionAction'
import { Link } from 'react-router-dom'
import TaskLabels from './TaskLabels.jsx'
import Icon from './icons.jsx'

import { motion, useDragControls } from 'motion/react'
import { useActiveTaskActions } from '../features/home/useActiveTaskActions'

// how far (px) or how fast (px/s) the card has to be swiped to put the task back
const SWIPE_DISTANCE = 110;
const SWIPE_SPEED = 600;

// The task being worked on ("Focus"): its name, the time on it in this session, its description
// and notes; done or put back from here. Empty, it is the place a task is dragged to.
// dragging: a task is on its way here (the empty zone lights up).
export default function WorkingContainer (props) {
    const {dropZoneRef, activeTask, setActiveTask, onRelease, dragging = false } = props;

    const {t} = useTranslation();
    // a second, smaller burst follows the first on "extreme"
    const { markDone, saveDescription, addNote, addingNote, setAddingNote, noteInputRef } = useActiveTaskActions(activeTask, setActiveTask, { echo: true });
    // the card can be swiped sideways by its head (not by the fields inside it)
    const dragControls = useDragControls();
    const startSwipe = (e) => { if (!e.target.closest('button, input, textarea')) dragControls.start(e); };
    const onSwipeEnd = (_, info) => {
        if (Math.abs(info.offset.x) > SWIPE_DISTANCE || Math.abs(info.velocity.x) > SWIPE_SPEED) onRelease?.();
    };

    const notes = useSelector(state => state.task.notes);
    const taskSeconds = useSelector(state => activeTask ? selectTaskTime(state, activeTask.id) : 0);

    const [editActiveDescription, setEditActiveDescription] = useState(false);
    const onDescriptionBlur = (e) => { setEditActiveDescription(false); saveDescription(e); };

    // name, then "put back" and "done"; the head is where the card is grabbed to swipe it away
    const head = (
        <div className={`${styles.taskCardHead} ${styles.swipeHandle}`} onPointerDown={startSwipe}>
            <h2 className={styles.taskTitle}>{activeTask?.name}</h2>
            <button className={styles.releaseBtn} onClick={onRelease} title={t('releaseTask')} aria-label={t('releaseTask')}>
                <Icon name="release" className={styles.headIcon} />
            </button>
            <button className={styles.doneBtn} onClick={markDone} title={t('markDone')} aria-label={t('markDone')}>
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
                            onBlur={onDescriptionBlur}
                            onKeyDown={(e)=>{ if(e.key === "Enter") e.currentTarget.blur(); }}
                        />}
                        <div className={styles.notesHead}>
                            <h3>{t('taskNotes')}</h3>
                            <button className={styles.noteAdd} onClick={() => setAddingNote(true)} aria-label={t('addNote')} title={t('addNote')}>
                                <Icon name="plus" className={styles.noteIcon} strokeWidth={2} />
                            </button>
                        </div>
                        {addingNote && <input ref={noteInputRef} className={styles.newNoteInput} type="text" aria-label={t('addNote')}
                            onBlur={addNote}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setAddingNote(false); }} />}
                        <ul className={styles.notesList}>
                            {notes?.filter(note => note.task_id === activeTask.id).map(note =>
                                <TaskNoteRow key={note.id} taskId={activeTask.id} note={note} className={styles.noteRow} />)}
                        </ul>
                        <p className={styles.swipeHint}>{t('releaseTaskHint')}</p>
                    </motion.div>}
            </div>
        </section>
    )
}
