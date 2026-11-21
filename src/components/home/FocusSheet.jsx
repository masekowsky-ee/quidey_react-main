import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import styles from './FocusSheet.module.css';
import Icon from '../icons.jsx';
import DurationInput from '../focus/DurationInput.jsx';
import { useTranslation } from '../../i18n/useTranslation';
import { dueText, fill, formatClock, shortClock } from '../../features/helperFunction';
import { durationText } from '../../features/calendar/calendar';
import { TIMER_MODE_LABEL } from '../../features/settings/preferences';
import TaskNoteRow from '../task/TaskNoteRow.jsx';
import CardNote from './CardNote.jsx';
import { useCardNote } from '../../features/home/cardNote';
import {
    PHASE_LABEL, pauseFocus, selectTaskTime, selectTimerInProgress, selectTimerProgress,
    setSessionParams, setTimerMode, skipPhase, startFocus, stopFocus,
} from '../../features/session/sessionAction';
import { useFocusClock } from '../../features/session/useFocusClock';
import { plannedProgress, selectFocusByTask } from '../../features/tasks/plannedTime';
import { useTaskGroups } from '../../features/collections/collections';
import { useActiveTaskActions } from '../../features/home/useActiveTaskActions';


const MODES = ['timer', 'pomodoro', 'stopwatch'].map((mode) => [mode, TIMER_MODE_LABEL[mode]]);
const LENGTHS = [15, 25, 30, 45, 60, 90];

// Home's one white sheet: the task in focus and the timer together. The name in the serif, one
// line of what is known about it (time worked against the plan, its groups, its day), the time
// large on the right, the timer's progress under both, then the controls: start, the three
// modes, and at the end the task's own actions (notes, put back, done). Nothing in focus, the
// sheet is where a task is dragged to and the timer still works.
export default function FocusSheet({ dropZoneRef, activeTask, setActiveTask, onRelease, dragging = false }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    useFocusClock();
    const { markDone, saveDescription, addNote, addingNote, setAddingNote, noteInputRef } = useActiveTaskActions(activeTask, setActiveTask);

    const { timer, timerMode, pomodoro, sessionParams } = useSelector(state => state.session);
    const percent = useSelector(selectTimerProgress);
    const inProgress = useSelector(selectTimerInProgress);
    const sessionSeconds = useSelector(state => activeTask ? selectTaskTime(state, activeTask.id) : 0);
    const focusByTask = useSelector(selectFocusByTask);
    const notes = useSelector(state => state.task.notes);
    const { groupsOf } = useTaskGroups();
    const cardNote = useCardNote();

    const stopwatch = timerMode === 'stopwatch';
    const isPomodoro = timerMode === 'pomodoro';
    const onBreak = isPomodoro && pomodoro.phase !== 'focus';
    const own = activeTask && !activeTask.shared;
    const taskNotes = own ? (notes ?? []).filter(note => note.task_id === activeTask.id) : [];

    const [openFor, setOpenFor] = useState(null);
    const open = openFor !== null && openFor === activeTask?.id;
    const setOpen = (value) => setOpenFor(value ? activeTask.id : null);
    const [editLength, setEditLength] = useState(false);

    const progress = own ? plannedProgress(activeTask, focusByTask) : null;
    const meta = [];
    if (activeTask) {
        if (progress && progress.spent > 0) meta.push(fill(t('homeFocusWorked'), { spent: durationText(progress.spent), planned: durationText(progress.planned) }));
        else if (progress) meta.push(fill(t('plannedShort'), { time: durationText(progress.planned) }));
        else if (sessionSeconds > 0) meta.push(`${t('timeThisSession')} ${formatClock(sessionSeconds * 1000)}`);
        if (activeTask.shared) meta.push(activeTask.shared.sessionName);
        else meta.push(...groupsOf(activeTask).map(group => group.name));
        if (activeTask.due && !activeTask.shared) meta.push(dueText(activeTask.due, t));
    }

    const startLabel = inProgress ? t('focusResume')
        : !stopwatch && timer.time < 1000 ? t('focusAgain')
        : onBreak ? t('pomodoroStartBreak') : t('focusStart');
    const canEditLength = timerMode === 'timer' && !inProgress;

    if (cardNote) {
        return (
            <section ref={dropZoneRef} className={styles.sheet} aria-label={t('homeCardNoteLabel')} data-part="home-focus"
                data-note="" data-dragging={dragging || undefined}>
                <CardNote id={cardNote} />
            </section>
        );
    }

    return (
        <section ref={dropZoneRef} className={styles.sheet} aria-label={t('focusTitle')} data-part="home-focus"
            data-empty={activeTask ? undefined : ''} data-dragging={dragging || undefined} data-break={onBreak || undefined}>
            <div className={styles.what}>
                {activeTask
                    ? <h2 className={styles.title}>{activeTask.name}</h2>
                    : <h2 className={`${styles.title} ${styles.titleEmpty}`}>{t(dragging ? 'dragATask' : 'homeFocusEmpty')}</h2>}
                <p className={styles.meta}>
                    {activeTask
                        ? meta.map((part, i) => <span key={i}>{part}</span>)
                        : <span>{t('focusHint')}</span>}
                </p>
            </div>

            <div className={styles.clock}>
                {isPomodoro && <span className={styles.phase}>{t(PHASE_LABEL[pomodoro.phase])}</span>}
                {canEditLength
                    ? <button type="button" className={styles.time} onClick={() => setEditLength(!editLength)}
                        aria-expanded={editLength} title={t('focusLength')}>
                        <span role="timer" aria-live="off">{shortClock(timer.time)}</span>
                    </button>
                    : <span className={styles.time} role="timer" aria-live="off">{shortClock(timer.time)}</span>}
            </div>

            <div className={styles.progress} aria-hidden="true">
                {inProgress || stopwatch && timer.active
                    ? (stopwatch
                        ? <i className={styles.live} style={{ transform: 'scaleX(1)' }} />
                        : <i style={{ transform: `scaleX(${percent / 100})` }} />)
                    : <i className={styles.plan} style={{ transform: `scaleX(${Math.min(1, progress?.share ?? 0)})` }} />}
            </div>

            {editLength && canEditLength &&
                <div className={styles.length}>
                    <DurationInput label={t('focusLength')} ms={sessionParams.time} presets={LENGTHS}
                        onChange={time => dispatch(setSessionParams({ ...sessionParams, time }))} />
                </div>}

            <div className={styles.controls}>
                {timer.active
                    ? <button type="button" className={styles.go} onClick={() => dispatch(pauseFocus())}>
                        <Icon name="pause" size={16} strokeWidth={2.4} />{t('focusPause')}
                    </button>
                    : <button type="button" className={styles.go} onClick={() => { setEditLength(false); dispatch(startFocus()); }}>
                        <Icon name="play" size={16} strokeWidth={2.4} />{startLabel}
                    </button>}
                {(inProgress || (stopwatch && timer.time > 0)) &&
                    <button type="button" className={styles.icon} onClick={() => dispatch(stopFocus())} title={t('focusStop')} aria-label={t('focusStop')}>
                        <Icon name="stop" size={18} strokeWidth={2} />
                    </button>}
                {isPomodoro &&
                    <button type="button" className={styles.icon} onClick={() => dispatch(skipPhase())} title={t('pomodoroSkip')} aria-label={t('pomodoroSkip')}>
                        <Icon name="skip" size={18} strokeWidth={2} />
                    </button>}
                <div className={styles.modes} role="group" aria-label={t('timerMode')}>
                    {MODES.map(([mode, label]) =>
                        <button key={mode} type="button" className={styles.mode} aria-pressed={timerMode === mode}
                            disabled={inProgress && timerMode !== mode}
                            onClick={() => { if (timerMode !== mode) { setEditLength(false); dispatch(setTimerMode(mode)); } }}>
                            {t(label)}
                        </button>)}
                </div>

                <div className={styles.taskActions}>
                    {own &&
                        <button type="button" className={styles.text} onClick={() => setOpen(!open)} aria-expanded={open}>
                            {t('homeFocusNotes')}{taskNotes.length > 0 && <span className={styles.count}>{taskNotes.length}</span>}
                        </button>}
                    <Link to="/focus" className={styles.icon} title={t('focusRoomOpen')} aria-label={t('focusRoomOpen')}>
                        <Icon name="expand" size={18} />
                    </Link>
                    {activeTask && <>
                        <button type="button" className={styles.icon} onClick={onRelease} title={t('releaseTask')} aria-label={t('releaseTask')}>
                            <Icon name="release" size={18} />
                        </button>
                        <button type="button" className={styles.check} onClick={markDone} title={t('markDone')} aria-label={t('markDone')}>
                            <Icon name="check" size={18} strokeWidth={2.2} />
                        </button>
                    </>}
                </div>
            </div>

            {activeTask?.shared &&
                <p className={styles.note}>
                    {t('sharedTaskWorkHint')} <Link to={`/together/${activeTask.shared.sessionId}`}>{t('openSession')}</Link>
                </p>}

            {own && open &&
                <div className={styles.details}>
                    <textarea key={activeTask.id} className={styles.description} rows={2} defaultValue={activeTask.description ?? ''}
                        placeholder={t('description')} aria-label={t('description')} onBlur={saveDescription} />
                    <ul className={styles.notes}>
                        {taskNotes.map(note =>
                            <TaskNoteRow key={note.id} taskId={activeTask.id} note={note} />)}
                        {addingNote &&
                            <li><input ref={noteInputRef} type="text" aria-label={t('addNote')} onBlur={addNote}
                                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setAddingNote(false); }} /></li>}
                    </ul>
                    {!addingNote &&
                        <button type="button" className={styles.text} onClick={() => setAddingNote(true)}>
                            <Icon name="plus" size={16} strokeWidth={2} />{t('addNote')}
                        </button>}
                </div>}
        </section>
    );
}

export function FocusSheetSkeleton() {
    const { t } = useTranslation();
    const { timer } = useSelector(state => state.session);
    return (
        <section className={styles.sheet} data-empty="" aria-busy="true">
            <div className={styles.what}>
                <h2 className={`${styles.title} ${styles.titleEmpty}`}>{t('homeFocusEmpty')}</h2>
                <p className={styles.meta}><span>{t('focusHint')}</span></p>
            </div>
            <div className={styles.clock}><span className={styles.time}>{shortClock(timer.time)}</span></div>
            <div className={styles.progress} />
            <div className={styles.controls}>
                <span className={styles.go} aria-hidden="true"><Icon name="play" size={16} strokeWidth={2.4} />{t('focusStart')}</span>
            </div>
        </section>
    );
}
