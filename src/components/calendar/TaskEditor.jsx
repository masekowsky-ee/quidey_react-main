import styles from '../CalendarDay.module.css';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { displayName, fill, toInputDate } from '../../features/helperFunction';
import { durationText } from '../../features/calendar/calendar';
import TaskOptionsFields from '../task/TaskOptionsFields.jsx';
import { linkIsValid } from '../../features/tasks/taskFields';
import TaskSharing from '../task/TaskSharing.jsx';
import TaskColorPicker from '../task/TaskColorPicker.jsx';
import Icon from './icons.jsx';

// What is set under "More options", for the line next to the (closed) toggle:
// "1 h 30 min · 15 min before · Luigi's · Link · Bob"
function optionsSummary(t, extras, hasTime, task) {
    const reminder = hasTime && extras.reminder_minutes !== null && extras.reminder_minutes !== undefined
        ? (extras.reminder_minutes === 0 ? t('reminderAtStart') : fill(t('reminderBefore'), { time: durationText(extras.reminder_minutes) }))
            + (extras.reminder_email ? ` (${t('reminderEmailShort')})` : '')
        : '';
    const people = (task.sharedWith ?? []).map(share => displayName(share.user));
    return [
        extras.repeat ? t(`repeat_${extras.repeat}`) : '',
        extras.duration_minutes ? durationText(extras.duration_minutes) : '',
        reminder,
        extras.location.trim(),
        extras.link.trim() ? t('link') : '',
        extras.details.trim() ? t('details') : '',
        people.join(', '),
    ].filter(Boolean).join(' · ');
}

// Edits one task in the day panel: name, day and optional time, priority, description, and
// under "More options" duration, reminder, location, link, extra info and sharing.
// Enter saves (Ctrl+Enter in the text fields), Escape cancels without closing the panel.
export default function TaskEditor({ task, onSave, onCancel, onDelete, onLeave, onPickGroups }) {
    const { t } = useTranslation();
    const id = useId();
    const nameRef = useRef(null);
    const [name, setName] = useState(task.name ?? '');
    const [due, setDue] = useState(toInputDate(task.due));
    const [time, setTime] = useState(task.due_time ?? '');
    // kept as it is (also empty, or above 100 from older tasks) until the slider is moved
    const [prio, setPrio] = useState(task.prio ?? null);
    const sliderValue = Math.min(100, Math.max(0, Number(prio ?? 50)));
    const [description, setDescription] = useState(task.description ?? '');
    const [color, setColor] = useState(task.color ?? null);
    const [extras, setExtras] = useState({
        duration_minutes: task.duration_minutes ?? null,
        reminder_minutes: task.reminder_minutes ?? null,
        reminder_email: Boolean(task.reminder_email),
        location: task.location ?? '',
        link: task.link ?? '',
        details: task.details ?? '',
        repeat: task.repeat ?? null,
    });
    // closed at first (the editor stays short); the toggle says what is set in it
    const [showMore, setShowMore] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const isOwner = task.isOwner !== false;

    useEffect(() => { nameRef.current?.focus(); }, []);

    // opening "More options" brings them into view (the panel is short on small windows)
    const moreRef = useRef(null);
    const toggleMore = () => {
        const opening = !showMore;
        setShowMore(opening);
        if (opening) requestAnimationFrame(() => moreRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }));
    };

    const submit = async (e) => {
        e?.preventDefault();
        if (!name.trim()) { setError(t('nameRequired')); nameRef.current?.focus(); return; }
        if (!due) { setError(t('dateNameTaskError')); return; }
        if (!linkIsValid(extras.link)) { setShowMore(true); return; }
        setBusy(true);
        const saved = await onSave({
            name: name.trim(),
            due,
            prio,
            description: description.trim(),
            due_time: time || null,
            duration_minutes: extras.duration_minutes,
            // a reminder counts from the start time
            reminder_minutes: time ? extras.reminder_minutes : null,
            // only the owner's mails (the server ignores it from others)
            ...(isOwner ? { reminder_email: Boolean(time && extras.reminder_minutes !== null && extras.reminder_email) } : {}),
            color,
            location: extras.location.trim(),
            link: extras.link.trim(),
            details: extras.details.trim(),
            repeat: extras.repeat ?? null,
        });
        // still open when saving failed; otherwise the editor is gone already
        if (!saved) setBusy(false);
    };

    const onKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            onCancel();
        }
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.tagName === 'TEXTAREA') submit(e);
    };

    return (
        <form className={styles.editor} onSubmit={submit} onKeyDown={onKeyDown} noValidate>
            <label className={styles.field}>
                <span>{t('taskName')}</span>
                <input ref={nameRef} value={name} maxLength={200}
                    onChange={(e) => { setName(e.target.value); setError(''); }} aria-invalid={Boolean(error) && !name.trim()} />
            </label>
            <div className={styles.fieldRow}>
                <label className={styles.field}>
                    <span>{t('dueDate')}</span>
                    <input type="date" value={due} onChange={(e) => { setDue(e.target.value); setError(''); }} />
                </label>
                <label className={`${styles.field} ${styles.timeField}`}>
                    <span>{t('taskTime')}</span>
                    <span className={styles.timeInput}>
                        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                        {time &&
                            <button type="button" className={styles.clearTime} onClick={() => setTime('')} title={t('allDay')} aria-label={t('allDay')}>
                                <Icon name="close" size={16} />
                            </button>}
                    </span>
                    {!time && <small className={styles.allDayNote}>{t('allDay')}</small>}
                </label>
                <label className={`${styles.field} ${styles.prioField}`} htmlFor={`${id}-prio`}>
                    <span>{t('prioritise')} <output className={styles.prioValue} htmlFor={`${id}-prio`}>{prio ?? '–'}</output></span>
                    <input id={`${id}-prio`} type="range" min="0" max="100" step="1" value={sliderValue}
                        onChange={(e) => setPrio(Number(e.target.value))} />
                </label>
            </div>
            <label className={styles.field}>
                <span>{t('description')}</span>
                <textarea rows={2} value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <TaskColorPicker value={color} onChange={setColor} />

            {!isOwner && task.owner && !showMore &&
                <p className={styles.sharedNote}>{fill(t('sharedTaskHint'), { name: displayName(task.owner) })}</p>}
            <button type="button" ref={moreRef} className={styles.moreToggle} aria-expanded={showMore} onClick={toggleMore}>
                <span className={styles.moreChevron} aria-hidden="true">{showMore ? '▾' : '▸'}</span>
                <span className={styles.moreLabel}>{showMore ? t('fewerOptions') : t('moreOptions')}</span>
                {!showMore && <span className={styles.moreSummary}>{optionsSummary(t, extras, Boolean(time), task)}</span>}
            </button>
            {showMore &&
                <div className={styles.more}>
                    <TaskOptionsFields value={extras} hasTime={Boolean(time)} hasDate={Boolean(due)} canMail={isOwner} onChange={(change) => setExtras(prev => ({ ...prev, ...change }))} />
                    <TaskSharing task={task} />
                </div>}

            {error && <p className={styles.error} role="alert">{error}</p>}
            <div className={styles.editorActions}>
                <button type="button" className={styles.groupsBtn} onClick={() => onPickGroups(task)}>{t('assignGroup')}</button>
                {isOwner
                    ? <button type="button" className={styles.deleteBtn} onClick={() => onDelete(task)} aria-label={`${t('deleteTask')}: ${task.name}`} title={t('deleteTask')}>
                        <Icon name="delete" size={20} />
                    </button>
                    : <button type="button" className={styles.leaveBtn} onClick={() => onLeave(task)}>{t('leaveTask')}</button>}
                <span className={styles.spacer} />
                <button type="button" className={styles.cancelBtn} onClick={onCancel}>{t('cancel')}</button>
                <button type="submit" className={styles.saveBtn} disabled={busy}>{t('save')}</button>
            </div>
        </form>
    );
}
