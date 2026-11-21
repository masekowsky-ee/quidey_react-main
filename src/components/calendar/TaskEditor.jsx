import styles from '../CalendarDay.module.css';
import { useEffect, useId, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectUsername } from '../../features/auth/tester';
import { useTranslation } from '../../i18n/useTranslation';
import { displayName, fill, toInputDate } from '../../features/helperFunction';
import { durationText, remindersOf } from '../../features/calendar/calendar';
import TaskOptionsFields from '../task/TaskOptionsFields.jsx';
import { reminderLabel } from '../../features/tasks/reminders';
import { linkIsValid } from '../../features/tasks/taskFields';
import { selectFocusByTask } from '../../features/tasks/plannedTime';
import TaskSharing from '../task/TaskSharing.jsx';
import TaskColorPicker from '../task/TaskColorPicker.jsx';
import DurationField from '../task/DurationWheel.jsx';
import { EventTypePicker, KindSwitch, TypeHint } from '../task/KindFields.jsx';
import { buildTaskPayload, useTaskDraft } from '../../features/tasks/taskDraft';
import { createdText } from '../../features/tasks/created';
import CollectionPicker from '../collections/CollectionPicker.jsx';
import Icon from '../icons.jsx';

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
// event (a shared session's). Without onDelete / onLeave their buttons are left out.
// An event's type follows its name by the types' keywords (matchEventType) until one is picked by
// hand, also "none"; a task whose name fits a type offers to become such an event.
// subGroups: [{ id, name }] of a session or family (experimental, testers): a field to move the
// entry between them (group_id). Under the fields a quiet line says when and by whom it was made.
// Testers: an own task or event can be put into collections (with notes and other tasks).
// remindsAll: a family's entry: not personal, but with reminders (they reach every member).
export default function TaskEditor({ task, onSave, onCancel, onDelete, onLeave, personal = true, allowEvents = false, remindsAll = false, subGroups }) {
    const { t, language } = useTranslation();
    const id = useId();
    const nameRef = useRef(null);
    const isOwner = task.isOwner !== false;
    const myUsername = useSelector(selectUsername);
    const created = createdText(task, t, language, myUsername);
    const [groupId, setGroupId] = useState(task.groupId ?? null);
    // only the owner makes a task an event or back and picks its type, from their own list
    // (in a shared session everybody can, without types)
    const canPickType = personal && isOwner;
    const canChangeKind = canPickType || allowEvents;
    const draft = useTaskDraft({
        kind: (personal || allowEvents) && task.kind === 'event' ? 'event' : 'task',
        name: task.name, eventTypeId: task.event_type_id, due: toInputDate(task.due), time: task.due_time,
        // kept as it is (also empty, or above 100 from older tasks) until the slider is moved
        prio: task.prio, description: task.description, color: task.color, duration: task.duration_minutes,
        extras: {
            reminders: remindersOf(task),
            reminder_email: Boolean(task.reminder_email),
            location: task.location ?? '',
            link: task.link ?? '',
            details: task.details ?? '',
            repeat: task.repeat ?? null,
            repeat_left: Number.isInteger(task.repeat_left) ? task.repeat_left : null,
        },
    }, { pickTypes: canPickType });
    const { kind, name, due, time, duration, prio, description, color, extras, eventTypeId, match } = draft;
    const event = kind === 'event';
    const sliderValue = Math.min(100, Math.max(0, Number(prio ?? 50)));

    const [showMore, setShowMore] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const focusedSeconds = useSelector(state => selectFocusByTask(state)[task.id] ?? 0);
    const showCollections = personal && Number.isInteger(task.id);

    useEffect(() => { nameRef.current?.focus(); }, []);

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
        const saved = await onSave(buildTaskPayload(draft.values, { personal, owner: isOwner, withKind: allowEvents, groupId: subGroups ? groupId : undefined, remindsAll }));
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

    const durationHint = event
        ? (draft.untilTime ? fill(t('eventUntil'), { time: draft.untilTime }) : t('eventDurationHint'))
        : (focusedSeconds >= 60 ? fill(t('plannedFocused'), { time: durationText(Math.round(focusedSeconds / 60)) }) : t('plannedTimeHint'));

    return (
        <form className={styles.editor} onSubmit={submit} onKeyDown={onKeyDown} noValidate>
            {canChangeKind && <KindSwitch value={kind} onChange={(next) => { draft.changeKind(next); setError(''); }} />}
            <label className={styles.field}>
                <span>{t(event ? 'eventName' : 'taskName')}</span>
                <input ref={nameRef} value={name} maxLength={200}
                    onChange={(e) => { draft.changeName(e.target.value); setError(''); }} aria-invalid={Boolean(error) && !name.trim()} />
            </label>
            {!event && canChangeKind && match &&
                <TypeHint className={styles.typeHintTight} color={match.type.color} onClick={draft.suggestEvent}>
                    {fill(t('keywordSuggestEvent'), { type: match.type.name })}
                </TypeHint>}
            <div className={styles.fieldRow}>
                <label className={styles.field}>
                    <span>{t(event ? 'eventDay' : 'dueDate')}</span>
                    <input type="date" value={due} required={event} aria-invalid={event && Boolean(error) && !due}
                        onChange={(e) => { draft.setDue(e.target.value); setError(''); }} />
                </label>
                <label className={`${styles.field} ${styles.timeField}`}>
                    <span>{t(event ? 'eventStart' : 'taskTime')}</span>
                    <span className={styles.timeInput}>
                        <input type="time" value={time} onPointerDown={draft.dayForTime} onChange={(e) => draft.changeTime(e.target.value)} />
                        {time &&
                            <button type="button" className={styles.clearTime} onClick={() => draft.setTime('')} title={t('allDay')} aria-label={t('allDay')}>
                                <Icon name="mClose" size={16} />
                            </button>}
                    </span>
                    {!time && <small className={styles.allDayNote}>{t('allDay')}</small>}
                </label>
                {event &&
                    <label className={`${styles.field} ${styles.timeField}`}>
                        <span>{t('eventEnd')}</span>
                        <input type="time" value={draft.endTime} onPointerDown={draft.dayForTime} onChange={(e) => draft.setEnd(e.target.value)} />
                        {draft.endDays > 0 && <small className={styles.allDayNote}>{fill(t(draft.endDays === 1 ? 'eventEndNextDay' : 'eventEndDaysLater'), { days: draft.endDays })}</small>}
                    </label>}
                {!event &&
                    <label className={`${styles.field} ${styles.prioField}`} htmlFor={`${id}-prio`}>
                        <span>{t('prioritise')} <output className={styles.prioValue} htmlFor={`${id}-prio`}>{prio ?? '–'}</output></span>
                        <input id={`${id}-prio`} type="range" min="0" max="100" step="1" value={sliderValue}
                            onChange={(e) => draft.setPrio(Number(e.target.value))} />
                    </label>}
            </div>
            <div className={styles.fieldRow}>
                <DurationField label={t(event ? 'eventDuration' : 'plannedTime')} value={duration} onChange={draft.setDuration}
                    maxHours={event ? 168 : 99} hint={durationHint} />
            </div>
            {event && canPickType && <EventTypePicker value={eventTypeId} onChange={draft.pickType}
                autoNote={draft.autoNote ? fill(t('keywordAutoNote'), { keyword: draft.autoNote }) : null} />}
            {event && !canPickType && personal && task.event_type &&
                <p className={styles.sharedNote}>{t('eventType')}: {task.event_type.name}</p>}
            <label className={styles.field}>
                <span>{t('description')}</span>
                <textarea rows={2} value={description} maxLength={2000} onChange={(e) => draft.setDescription(e.target.value)} />
            </label>
            <TaskColorPicker value={color} onChange={draft.setColor} />
            {showCollections && <CollectionPicker item={{ kind: 'task', id: task.id }} name={name.trim() || task.name} />}
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
                <span className={`${styles.moreChevron} ${showMore ? styles.moreChevronOpen : ''}`} aria-hidden="true"><Icon name="mNext" size={18} /></span>
                <span className={styles.moreLabel}>{showMore ? t('fewerOptions') : t('moreOptions')}</span>
                {!showMore && <span className={styles.moreSummary}>{optionsSummary(t, extras, Boolean(due), Boolean(time), task)}</span>}
            </button>
            {showMore &&
                <div className={styles.more}>
                    <TaskOptionsFields value={extras} hasTime={Boolean(time)} hasDate={Boolean(due)} canMail={isOwner} personal={personal} remindsAll={remindsAll} onChange={draft.changeExtras} />
                    {personal && <TaskSharing task={task} />}
                </div>}

            {created && <p className={styles.createdNote}>{created}</p>}
            {error && <p className={styles.error} role="alert">{error}</p>}
            <div className={styles.editorActions}>
                {isOwner
                    ? onDelete && <button type="button" className={styles.deleteBtn} onClick={() => onDelete(task)} aria-label={`${t(event ? 'deleteEvent' : 'deleteTask')}: ${task.name}`} title={t(event ? 'deleteEvent' : 'deleteTask')}>
                        <Icon name="mDelete" size={20} />
                    </button>
                    : onLeave && <button type="button" className={styles.leaveBtn} onClick={() => onLeave(task)}>{t('leaveTask')}</button>}
                <span className={styles.spacer} />
                <button type="button" className={styles.cancelBtn} onClick={onCancel}>{t('cancel')}</button>
                <button type="submit" className={styles.saveBtn} disabled={busy}>{t('save')}</button>
            </div>
        </form>
    );
}
