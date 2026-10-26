import styles from '../CalendarDay.module.css';
import { useEffect, useId, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { displayName, fill, toInputDate } from '../../features/helperFunction';
import { dateKey, durationText, minutesOfDay, timeText } from '../../features/calendar/calendar';
import TaskOptionsFields from '../task/TaskOptionsFields.jsx';
import { reminderLabel, remindersOf } from '../../features/tasks/reminders';
import { linkIsValid } from '../../features/tasks/taskFields';
import { selectFocusByTask } from '../../features/tasks/plannedTime';
import TaskSharing from '../task/TaskSharing.jsx';
import TaskColorPicker from '../task/TaskColorPicker.jsx';
import DurationField from '../task/DurationWheel.jsx';
import { EventTypePicker, KindSwitch } from '../task/KindFields.jsx';
import { matchEventType } from '../../features/tasks/kinds';
import { createdText } from '../../features/tasks/created';
import Icon from './icons.jsx';

// What is set under "More options", for the line next to the (closed) toggle:
// "Weekly · At the start, 15 min before · Luigi's · Link · Bob"
function optionsSummary(t, extras, hasDate, hasTime, task) {
    const reminder = hasDate && extras.reminders.length > 0
        ? extras.reminders.map(minutes => reminderLabel(t, minutes, hasTime)).join(', ')
            + (extras.reminder_email ? ` (${t('reminderEmailShort')})` : '')
        : '';
    const people = (task.sharedWith ?? []).map(share => displayName(share.user));
    return [
        extras.repeat ? t(`repeat_${extras.repeat}`) + (Number.isInteger(extras.repeat_left) ? ` (${fill(t('repeatLeftShort'), { count: extras.repeat_left })})` : '') : '',
        reminder,
        extras.location.trim(),
        extras.link.trim() ? t('link') : '',
        extras.details.trim() ? t('details') : '',
        people.join(', '),
    ].filter(Boolean).join(' · ');
}

// Edits one task or event in the day panel: task or event, name, day and optional time,
// priority (tasks), a task's planned time or an event's length and type (both on wheels),
// description, colour, and under "More options" reminders, repeating, location, link, extra
// info and sharing. Enter saves (Ctrl+Enter in the text fields), Escape cancels without
// closing the panel. A task's day is optional (then no time, reminder or repeating either);
// an event needs one. Picking a time before a day takes today.
// personal: false for a task in a shared session or a family: reminders, repeating, sharing,
// groups and event types (all personal) are left out. allowEvents: it can still be a task or an
// event (a shared session's). Without onDelete / onLeave / onPickGroups their buttons are left out.
// An event's type follows its name by the types' keywords (matchEventType) until one is picked by
// hand, also "none"; a task whose name fits a type offers to become such an event.
// subGroups: [{ id, name }] of a session or family (experimental, testers): a field to move the
// entry between them (group_id). Under the fields a quiet line says when and by whom it was made.
export default function TaskEditor({ task, onSave, onCancel, onDelete, onLeave, onPickGroups, personal = true, allowEvents = false, subGroups }) {
    const { t, language } = useTranslation();
    const id = useId();
    const nameRef = useRef(null);
    const isOwner = task.isOwner !== false;
    const myUsername = useSelector(state => state.auth.user?.username);
    const created = createdText(task, t, language, myUsername);
    const [groupId, setGroupId] = useState(task.groupId ?? null);
    // only the owner makes a task an event or back and picks its type, from their own list
    // (in a shared session everybody can, without types)
    const canPickType = personal && isOwner;
    const canChangeKind = canPickType || allowEvents;
    const [kind, setKind] = useState((personal || allowEvents) && task.kind === 'event' ? 'event' : 'task');
    const event = kind === 'event';
    const [eventTypeId, setEventTypeId] = useState(task.event_type_id ?? null);
    // 'hand' once a type was picked (an existing event's type counts as picked), 'auto' while
    // it came from a keyword of the name
    const [typeSource, setTypeSource] = useState(task.event_type_id ? 'hand' : null);
    const types = useSelector(state => state.task.eventTypes);
    const [name, setName] = useState(task.name ?? '');
    const match = canPickType ? matchEventType(name, types) : null;
    // follows the name (and the switch to an event) until a type is picked by hand
    const followName = (nextName, nextKind) => {
        if (!canPickType || typeSource === 'hand' || nextKind !== 'event') return;
        const found = matchEventType(nextName, types);
        setEventTypeId(found?.type.id ?? null);
        setTypeSource(found ? 'auto' : null);
    };
    const pickType = (id) => {
        setEventTypeId(id);
        setTypeSource('hand');
    };
    const [due, setDue] = useState(toInputDate(task.due));
    const [time, setTime] = useState(task.due_time ?? '');
    // a time of day needs a day: picking one first takes today
    const dayForTime = () => { if (!due) setDue(dateKey(new Date())); };
    // kept as it is (also empty, or above 100 from older tasks) until the slider is moved
    const [prio, setPrio] = useState(task.prio ?? null);
    const sliderValue = Math.min(100, Math.max(0, Number(prio ?? 50)));
    const [description, setDescription] = useState(task.description ?? '');
    const [color, setColor] = useState(task.color ?? null);
    // a task's planned time, an event's length
    const [duration, setDuration] = useState(task.duration_minutes ?? null);
    const [extras, setExtras] = useState({
        reminders: remindersOf(task),
        reminder_email: Boolean(task.reminder_email),
        location: task.location ?? '',
        link: task.link ?? '',
        details: task.details ?? '',
        repeat: task.repeat ?? null,
        repeat_left: Number.isInteger(task.repeat_left) ? task.repeat_left : null,
    });
    // closed at first (the editor stays short); the toggle says what is set in it
    const [showMore, setShowMore] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const focusedSeconds = useSelector(state => selectFocusByTask(state)[task.id] ?? 0);

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
        if (event && !due) { setError(t('eventNeedsDay')); return; }
        if (!linkIsValid(extras.link)) { setShowMore(true); return; }
        setBusy(true);
        const saved = await onSave(!personal ? {
            ...(allowEvents ? { kind } : {}),
            name: name.trim(),
            due: due || null,
            prio,
            description: description.trim(),
            // a time of day needs a day
            due_time: due ? time || null : null,
            duration_minutes: duration,
            color,
            location: extras.location.trim(),
            link: extras.link.trim(),
            details: extras.details.trim(),
            ...(subGroups ? { group_id: groupId } : {}),
        } : {
            name: name.trim(),
            // the day is optional; a time of day, a reminder and repeating need one
            due: due || null,
            prio,
            description: description.trim(),
            due_time: due ? time || null : null,
            duration_minutes: duration,
            // reminders count from the start, or from my all-day time on the day
            reminders: due ? extras.reminders : [],
            // only the owner's (the server ignores them from others)
            ...(isOwner ? {
                reminder_email: Boolean(due && extras.reminders.length > 0 && extras.reminder_email),
                kind,
                event_type_id: event ? eventTypeId : null,
            } : {}),
            color,
            location: extras.location.trim(),
            link: extras.link.trim(),
            details: extras.details.trim(),
            repeat: due ? extras.repeat ?? null : null,
            // an end only for something that repeats
            repeat_left: due && extras.repeat ? extras.repeat_left : null,
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

    const start = minutesOfDay(time);
    const durationHint = event
        ? (duration && start !== null ? fill(t('eventUntil'), { time: timeText(start + duration) }) : t('eventDurationHint'))
        : (focusedSeconds >= 60 ? fill(t('plannedFocused'), { time: durationText(Math.round(focusedSeconds / 60)) }) : t('plannedTimeHint'));

    return (
        <form className={styles.editor} onSubmit={submit} onKeyDown={onKeyDown} noValidate>
            {canChangeKind && <KindSwitch value={kind} onChange={(next) => { setKind(next); setError(''); followName(name, next); }} />}
            <label className={styles.field}>
                <span>{t(event ? 'eventName' : 'taskName')}</span>
                <input ref={nameRef} value={name} maxLength={200}
                    onChange={(e) => { setName(e.target.value); setError(''); followName(e.target.value, kind); }} aria-invalid={Boolean(error) && !name.trim()} />
            </label>
            {/* a task whose name fits a type: one tap makes it such an event */}
            {!event && canChangeKind && match &&
                <button type="button" className={styles.typeHint} data-task-color={match.type.color ?? undefined}
                    onClick={() => { setKind('event'); setEventTypeId(match.type.id); setTypeSource('auto'); }}>
                    <span className={styles.typeHintDot} aria-hidden="true" />
                    {fill(t('keywordSuggestEvent'), { type: match.type.name })}
                </button>}
            <div className={styles.fieldRow}>
                <label className={styles.field}>
                    <span>{t(event ? 'eventDay' : 'dueDate')}</span>
                    <input type="date" value={due} required={event} aria-invalid={event && Boolean(error) && !due}
                        onChange={(e) => { setDue(e.target.value); setError(''); }} />
                </label>
                <label className={`${styles.field} ${styles.timeField}`}>
                    <span>{t(event ? 'eventStart' : 'taskTime')}</span>
                    <span className={styles.timeInput}>
                        <input type="time" value={time} onPointerDown={dayForTime} onChange={(e) => { dayForTime(); setTime(e.target.value); }} />
                        {time &&
                            <button type="button" className={styles.clearTime} onClick={() => setTime('')} title={t('allDay')} aria-label={t('allDay')}>
                                <Icon name="close" size={16} />
                            </button>}
                    </span>
                    {!time && <small className={styles.allDayNote}>{t('allDay')}</small>}
                </label>
                {!event &&
                    <label className={`${styles.field} ${styles.prioField}`} htmlFor={`${id}-prio`}>
                        <span>{t('prioritise')} <output className={styles.prioValue} htmlFor={`${id}-prio`}>{prio ?? '–'}</output></span>
                        <input id={`${id}-prio`} type="range" min="0" max="100" step="1" value={sliderValue}
                            onChange={(e) => setPrio(Number(e.target.value))} />
                    </label>}
            </div>
            <div className={styles.fieldRow}>
                <DurationField label={t(event ? 'eventDuration' : 'plannedTime')} value={duration} onChange={setDuration}
                    maxHours={event ? 168 : 99} hint={durationHint} />
            </div>
            {event && canPickType && <EventTypePicker value={eventTypeId} onChange={pickType}
                autoNote={typeSource === 'auto' && match ? fill(t('keywordAutoNote'), { keyword: match.keyword }) : null} />}
            {event && !canPickType && personal && task.event_type &&
                <p className={styles.sharedNote}>{t('eventType')}: {task.event_type.name}</p>}
            <label className={styles.field}>
                <span>{t('description')}</span>
                <textarea rows={2} value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <TaskColorPicker value={color} onChange={setColor} />
            {subGroups && !personal &&
                <label className={styles.field}>
                    <span>{t('subGroup')}</span>
                    <select value={groupId ?? ''} onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : null)}>
                        <option value="">{t('subGroupNone')}</option>
                        {subGroups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
                    </select>
                </label>}

            {!isOwner && task.owner && !showMore &&
                <p className={styles.sharedNote}>{fill(t('sharedTaskHint'), { name: displayName(task.owner) })}</p>}
            <button type="button" ref={moreRef} className={styles.moreToggle} aria-expanded={showMore} onClick={toggleMore}>
                <span className={`${styles.moreChevron} ${showMore ? styles.moreChevronOpen : ''}`} aria-hidden="true"><Icon name="next" size={18} /></span>
                <span className={styles.moreLabel}>{showMore ? t('fewerOptions') : t('moreOptions')}</span>
                {!showMore && <span className={styles.moreSummary}>{optionsSummary(t, extras, Boolean(due), Boolean(time), task)}</span>}
            </button>
            {showMore &&
                <div className={styles.more}>
                    <TaskOptionsFields value={extras} hasTime={Boolean(time)} hasDate={Boolean(due)} canMail={isOwner} personal={personal} onChange={(change) => setExtras(prev => ({ ...prev, ...change }))} />
                    {personal && <TaskSharing task={task} />}
                </div>}

            {created && <p className={styles.createdNote}>{created}</p>}
            {error && <p className={styles.error} role="alert">{error}</p>}
            <div className={styles.editorActions}>
                {onPickGroups && <button type="button" className={styles.groupsBtn} onClick={() => onPickGroups(task)}>{t('assignGroup')}</button>}
                {isOwner
                    ? onDelete && <button type="button" className={styles.deleteBtn} onClick={() => onDelete(task)} aria-label={`${t(event ? 'deleteEvent' : 'deleteTask')}: ${task.name}`} title={t(event ? 'deleteEvent' : 'deleteTask')}>
                        <Icon name="delete" size={20} />
                    </button>
                    : onLeave && <button type="button" className={styles.leaveBtn} onClick={() => onLeave(task)}>{t('leaveTask')}</button>}
                <span className={styles.spacer} />
                <button type="button" className={styles.cancelBtn} onClick={onCancel}>{t('cancel')}</button>
                <button type="submit" className={styles.saveBtn} disabled={busy}>{t('save')}</button>
            </div>
        </form>
    );
}
