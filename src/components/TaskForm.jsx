import { useMemo, useRef, useState } from 'react';
import { COMMUNITY_PATHS } from '../features/community/paths';
import { Link, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { addTask, shareTask } from '../features/tasks/taskAction'
import styles from './Form.module.css';
import {useTranslation} from '../i18n/useTranslation';
import {setCustomError} from '../features/settings/settingsAction';
import { showToast } from '../features/toast/toast';
import TaskOptionsFields from './task/TaskOptionsFields.jsx';
import { linkIsValid } from '../features/tasks/taskFields';
import { useFriends } from '../features/friends/useFriends';
import FriendPicker from './together/FriendPicker.jsx';
import TaskColorPicker from './task/TaskColorPicker.jsx';
import DurationField from './task/DurationWheel.jsx';
import { endOf, fromEnd } from '../features/tasks/eventTimes';
import { EventTypePicker, KindSwitch } from './task/KindFields.jsx';
import { matchEventType } from '../features/tasks/kinds';
import { dueText, fill } from '../features/helperFunction';
import { parseQuickEntry, stripFound, needsAiHelp } from '../features/tasks/quickParse';
import { useAiQuota, readLineWithAi, left } from '../features/ai/ai';
import { prioLevel, durationText } from '../features/calendar/calendar';
import { dateKey, minutesOfDay, timeText } from '../features/calendar/calendar';
import { defaultReminders, reminderLabel } from '../features/tasks/reminders';
import { addSharedTask, selectSharedGroups, togetherErrorText } from '../features/together/togetherAction';
import { shownSubGroup } from '../features/tasks/subGroups';
import { addToShownCollection } from '../features/collections/collections';

import Icon from './icons';
import SheetGrabber from './SheetGrabber.jsx';
import { useFocusOnArrival } from '../features/layout/dragDismiss';
import { useIsTester } from '../features/auth/tester';
const EMPTY_EXTRAS = { reminders: [], reminder_email: false, location: '', link: '', details: '', repeat: null, repeat_left: null };

// New task or event. A task needs only its name; optionally a day and time (no time: the whole
// day, no day: whenever), the time planned for it, description and priority (none until the
// slider is touched). An event needs a day; it has a length and a type instead of a priority.
// "More options" adds reminders, repeating, location, link, extra info and friends to share it
// with (they get an invite once it's created). With notifications on for this device a new
// task starts with a reminder at its start (or at my all-day time on its day). Picking a time
// before a day takes today.
// While a shared session's group is shown on Home (and the form is opened there), the new task
// goes into that session (and, for testers, into its shown sub-group): then only the session's
// fields, nothing personal (reminders, repeating, event types, sharing with friends).
// A shown collection (testers, in place of a group) takes the new task or event, as a group does.
// The calendar opens it on a day (initialDue, initialTime: the tapped time); in a shared session's
// or family's calendar with a target ({ kind, name, events, save(fields) }): the entry goes there,
// with the same shared fields as a session's.
export default function TaskForm(props){
    // sheet: QuickAdd's FormSheet (slides in, swiped down on phones)
    // onReminder(name): testers' "Erinnerung" choice, QuickAdd swaps in the reminder form;
    // initialKind / initialName: coming back from there
    const {setCreateTask, sheet, onReminder, initialKind = 'task', initialName = '', initialDue = '', initialTime = '', target = null, group} = props;
    const isTester = useIsTester();
    const nameRef = useRef(null);
    useFocusOnArrival(nameRef);

    const dispatch = useDispatch();

    const { t } = useTranslation();

    const groupToDisplay = useSelector((state)=>state.task.groupToDisplay)
    const sharedGroups = useSelector(selectSharedGroups);
    const onHome = useLocation().pathname === '/';
    const session = onHome && groupToDisplay.group?.shared
        ? sharedGroups.find(group => group.sessionId === groupToDisplay.group.sessionId)
        : undefined;
    const subGroupId = session ? shownSubGroup(session.subGroups, groupToDisplay.group.subGroupId ?? null) : null;
    const subGroupName = session?.subGroups.find(group => group.id === subGroupId)?.name;
    // the entry goes into a shared place (a session, a family): nothing personal in the form then
    const elsewhere = Boolean(session || target);
    // the group (or collection) the new one goes into: the calendar names its filter's (group, null
    // for none), elsewhere it's the one shown on Home
    const intoGroup = group !== undefined ? group : groupToDisplay.group;
    const collection = intoGroup?.collection ? intoGroup : null;

    const [kind, setKind] = useState(initialKind);
    // the switch used by hand: what the name says no longer decides
    const [kindByHand, setKindByHand] = useState(initialKind !== 'task');
    const [eventTypeId, setEventTypeId] = useState(null);
    // a task's planned time, an event's length (minutes)
    const [duration, setDuration] = useState(null);
    const [name, setName] = useState(initialName);
    // the type follows the name's keywords until one is picked by hand (also "none")
    const types = useSelector(state => state.task.eventTypes);
    const [typeByHand, setTypeByHand] = useState(false);
    const match = matchEventType(name, types);
    const followName = (nextName, nextKind) => {
        if (typeByHand || nextKind !== 'event') return;
        setEventTypeId(matchEventType(nextName, types)?.type.id ?? null);
    };
    const [due, setDue] = useState(initialDue);
    const [time, setTime] = useState(initialTime);
    // a time of day needs a day: picking one first takes today
    const dayForTime = () => { if (!due) setDue(dateKey(new Date())); };
    const [description, setDescription] = useState('');
    const [prio, setPrio] = useState(null);
    const [color, setColor] = useState(null);
    const [showMore, setShowMore] = useState(false);
    const [extras, setExtras] = useState(() => ({ ...EMPTY_EXTRAS, reminders: defaultReminders() }));
    const [shareWith, setShareWith] = useState([]);
    const [busy, setBusy] = useState(false);
    // a day, time or priority written into the name ("morgen 14 Uhr !hoch") is taken over on
    // saving, for the fields still empty; "Ignore" keeps the name as it was typed
    const [ignoreQuick, setIgnoreQuick] = useState(false);
    const parsed = useMemo(() => parseQuickEntry(name, undefined, { eventTypes: types }), [name, types]);
    // a time range or one of my types in the name makes it an event (where events can go)
    const nameMakesEvent = !ignoreQuick && !kindByHand && kind === 'task' && parsed.kind === 'event' && (!target || target.events);
    const effectiveKind = nameMakesEvent ? 'event' : kind;
    const event = effectiveKind === 'event';
    const quick = ignoreQuick ? {} : {
        ...(!due && parsed.due && { due: parsed.due }),
        ...(!time && parsed.time && { time: parsed.time }),
        ...(!event && prio === null && parsed.prio !== null && { prio: parsed.prio }),
        ...(duration === null && parsed.durationMinutes && { duration: parsed.durationMinutes }),
        ...(color === null && parsed.color && { color: parsed.color }),
        ...(event && !elsewhere && !typeByHand && parsed.eventTypeId && { type: parsed.eventTypeId }),
        ...(!elsewhere && parsed.reminders.length > 0 && { reminder: parsed.reminders }),
    };
    // the words in the name for what was taken over (a time range is read as 'time')
    const quickKinds = Object.keys(quick);
    // what is saved: the typed fields, with what the name said in the empty ones
    const saved = {
        name: quickKinds.length > 0 ? stripFound(name, parsed.found, quickKinds) : name,
        kind: effectiveKind,
        due: quick.due ?? due,
        time: quick.time ?? time,
        prio: quick.prio ?? prio,
        duration: quick.duration ?? duration,
        color: quick.color ?? color,
        eventTypeId: quick.type ?? eventTypeId,
        reminders: quick.reminder ?? extras.reminders,
    };
    const typeName = (id) => types.find(type => type.id === id)?.name;
    const quickParts = [
        nameMakesEvent && t('quickAddEvent'),
        quick.due && dueText(quick.due, t),
        quick.time && (parsed.end ? fill(t('quickAddRange'), { from: quick.time, to: parsed.end }) : fill(t('quickAddAt'), { time: quick.time })),
        quick.duration && !parsed.end && fill(t('quickAddLength'), { time: durationText(quick.duration) }),
        quick.prio !== undefined && t(`quickAddPrio_${prioLevel(quick.prio)}`),
        quick.color && t(`taskColor_${quick.color}`),
        quick.type && fill(t('quickAddType'), { name: typeName(quick.type) }),
        ...(quick.reminder ?? []).map(minutes => reminderLabel(t, minutes, Boolean(saved.time))),
    ].filter(Boolean);

    // a long line the rules hardly understood: the AI may read it (one of today's helps)
    const aiQuota = useAiQuota();
    const [aiState, setAiState] = useState(null);
    const offerAi = !elsewhere && !ignoreQuick && aiQuota?.available && needsAiHelp(name, parsed);
    const aiLeft = left(aiQuota?.aiLine);
    async function readWithAi() {
        const text = name;
        setAiState({ reading: true });
        try {
            const entry = await readLineWithAi(text);
            setAiState(null);
            if (entry.kind === 'reminder' && onReminder && isTester) { onReminder(text); return; }
            setName(entry.name);
            if (entry.due) setDue(entry.due);
            if (entry.time) setTime(entry.time);
            if (entry.durationMinutes) setDuration(entry.durationMinutes);
            if (entry.color) setColor(entry.color);
            if (entry.prio != null) setPrio(entry.prio);
            if (entry.kind === 'event' && (!target || target.events)) { setKind('event'); setKindByHand(true); }
            if (entry.eventTypeId) { setEventTypeId(entry.eventTypeId); setTypeByHand(true); }
            if (entry.reminders.length > 0) setExtras(prev => ({ ...prev, reminders: entry.reminders }));
        } catch (err) {
            const back = err.data?.resetsAt ? new Date(err.data.resetsAt) : null;
            setAiState({ message: err.code === 'QUOTA_REACHED'
                ? fill(t('aiNoneLeft'), { time: back ? timeText(back.getHours() * 60 + back.getMinutes()) : '0:00' })
                : t('aiFailed') });
        }
    }

    const friends = useFriends();

    async function handleSubmit(e){
        e.preventDefault();
        const { name, due, time, prio, kind, duration, color, eventTypeId } = saved;
        const event = kind === 'event';
        if (!name.trim()) {
            dispatch( setCustomError({bool: true, message: t('nameTaskError') }) );
            return;
        }
        if (event && !due) {
            dispatch(setCustomError({ bool: true, message: t('eventNeedsDay') }));
            return;
        }
        if (!linkIsValid(extras.link)) {
            setShowMore(true);
            return;
        }
        if (target) {
            setBusy(true);
            try {
                await target.save({
                    name: name.trim(),
                    ...(target.events ? { kind } : {}),
                    due: due || null,
                    due_time: due && time ? time : null,
                    prio: event ? null : prio,
                    description: description.trim(),
                    duration_minutes: duration,
                    color,
                    location: extras.location.trim(),
                    link: extras.link.trim(),
                    details: extras.details.trim(),
                });
                setCreateTask(false);
            } catch (err) {
                dispatch(setCustomError({ bool: true, message: target.errorText?.(err) ?? (err.message || t('friendError_generic')) }));
                setBusy(false);
            }
            return;
        }
        if (session) {
            setBusy(true);
            try {
                await dispatch(addSharedTask(session.sessionId, {
                    name: name.trim(),
                    kind,
                    due: due || null,
                    // a time of day needs a day
                    due_time: due && time ? time : null,
                    prio: event ? null : prio,
                    description: description.trim(),
                    duration_minutes: duration,
                    color,
                    location: extras.location.trim(),
                    link: extras.link.trim(),
                    details: extras.details.trim(),
                    ...(subGroupId ? { group_id: subGroupId } : {}),
                }));
                setCreateTask(false);
            } catch (err) {
                dispatch(setCustomError({ bool: true, message: togetherErrorText(t, err) }));
                setBusy(false);
            }
            return;
        }
        // the shown group gets the new task (not a shared session's group: those aren't real groups)
        const groupId = intoGroup?.id;
        const activeGroupId = typeof groupId === 'number' && intoGroup.name !== 'all' ? groupId : null;
        setBusy(true);
        try {
            const task = await dispatch(addTask(name.trim(), due, description.trim(), event ? null : prio, activeGroupId, undefined, {
                kind,
                event_type_id: event ? eventTypeId : null,
                // a time of day needs a day
                due_time: due && time ? time : null,
                duration_minutes: duration,
                // reminders need a day (without a time they count from my all-day time)
                reminders: due ? saved.reminders : [],
                // only a reminder can come by mail
                reminder_email: Boolean(due && saved.reminders.length > 0 && extras.reminder_email),
                color,
                location: extras.location.trim(),
                link: extras.link.trim(),
                details: extras.details.trim(),
                // repeating needs a day
                repeat: due ? extras.repeat : null,
                repeat_left: due && extras.repeat ? extras.repeat_left : null,
            }));
            // made already: not getting into the collection is only told, the form still closes
            await dispatch(addToShownCollection(collection, task))
                .catch(() => dispatch(showToast(t('collectionError'), 'error')));
            if (shareWith.length > 0) {
                await dispatch(shareTask(task.id, shareWith));
                dispatch(showToast(t('shareInviteSent'), 'success'));
            }
            setCreateTask(false);
        } catch (err) {
            dispatch(setCustomError({ bool: true, message: err.message || t('friendError_generic') }));
            setBusy(false);
        }
    }

    return (
        <div className={`${styles.div}`} role="dialog" aria-modal="true" aria-labelledby="createTaskTitle" {...sheet?.panel}>
            {sheet && <SheetGrabber />}
            <button className={styles.closeBtn} onClick={()=>{setCreateTask(false)}} aria-label={t('close')}>
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>
            </button>
            <h2 id="createTaskTitle" data-sheet-drag>{t(event ? 'createEventH2' : 'createTaskH2')}</h2>
            {session &&
                <p className={styles.shareHint}>
                    {fill(t('createInSession'), { name: subGroupName ? `${session.name} · ${subGroupName}` : session.name })}
                </p>}
            {target &&
                <p className={styles.shareHint}>{fill(t(target.kind === 'session' ? 'createInSession' : 'createInCalendar'), { name: target.name })}</p>}
            {collection && !target &&
                <p className={styles.shareHint}>{fill(t('createInCollection'), { name: collection.name })}</p>}
            <form className={`${styles.form}`} onSubmit={handleSubmit} noValidate>
                {(!target || target.events) &&
                <KindSwitch value={effectiveKind} kinds={onReminder && isTester && !elsewhere ? ['task', 'event', 'reminder'] : undefined}
                    onChange={(next) => {
                        if (next === 'reminder') { onReminder(name); return; }
                        setKind(next); setKindByHand(true); followName(name, next);
                    }} />}
                {/* the form opens to be typed into: the name has the focus (on a touch screen once the sheet is up) */}
                <input ref={nameRef} className={styles.input} type="text" placeholder={t(event ? 'eventName' : 'taskName')} aria-label={t(event ? 'eventName' : 'taskName')}
                    aria-describedby={quickParts.length > 0 ? 'quick-add-hint' : undefined}
                    value={name} maxLength={200} onChange={(e) => { setName(e.target.value); followName(e.target.value, kind); }} />
                {quickParts.length > 0 &&
                    <p id="quick-add-hint" className={styles.quickHint} aria-live="polite">
                        <span>
                            {fill(t('quickAddFound'), { what: quickParts.join(' · ') })}
                            {saved.name.trim() && <span className={styles.quickName}> {fill(t('quickAddName'), { name: saved.name })}</span>}
                        </span>
                        <button type="button" className={styles.quickIgnore} onClick={() => setIgnoreQuick(true)}>{t('quickAddIgnore')}</button>
                    </p>}
                {/* "Erinnere mich …": testers make a reminder of it */}
                {parsed.kind === 'reminder' && onReminder && isTester && !elsewhere && !ignoreQuick &&
                    <button type="button" className={styles.typeHint} onClick={() => onReminder(stripFound(name, parsed.found, ['asReminder']))}>
                        <Icon name="alarm" size={14} /> {t('quickAddAsReminder')}
                    </button>}
                {offerAi &&
                    <button type="button" className={styles.aiHelp} onClick={readWithAi} disabled={aiLeft === 0 || aiState?.reading}>
                        <Icon name="brain" size={14} />
                        <span>{aiState?.reading ? t('aiReading') : t('aiReadLine')}</span>
                        <span className={styles.aiLeft}>{fill(t('aiLeft'), { n: aiLeft })}</span>
                    </button>}
                {aiState?.message && <p className={styles.aiStatus} role="status" aria-label={t('aiHelpStatus')}>{aiState.message}</p>}
                {/* a task whose name fits a type: one tap makes it such an event */}
                {!event && !elsewhere && match &&
                    <button type="button" className={styles.typeHint} data-task-color={match.type.color ?? undefined}
                        onClick={() => { setKind('event'); setEventTypeId(match.type.id); }}>
                        <span className={styles.typeHintDot} aria-hidden="true" />
                        {fill(t('keywordSuggestEvent'), { type: match.type.name })}
                    </button>}
                <div className={event ? styles.eventWhen : styles.rowDiv}>
                    <input className={`${styles.input} ${styles.grow}`} type="date" aria-label={t(event ? 'eventDay' : 'dueDate')}
                        required={event} value={due} onChange={(e) => setDue(e.target.value)} />
                    <input className={styles.input} type="time" aria-label={`${t(event ? 'eventStart' : 'taskTime')} (${t('allDay')}: –)`} title={t(event ? 'eventStart' : 'taskTime')}
                        value={time} onPointerDown={dayForTime} onChange={(e) => { dayForTime(); setTime(e.target.value); }} />
                    {/* an event's end: follows start and length, setting it changes the length */}
                    {event && <span className={styles.timeDash} aria-hidden="true">–</span>}
                    {event &&
                        <input className={styles.input} type="time" aria-label={t('eventEnd')} title={t('eventEnd')}
                            value={endOf(time, duration)} onPointerDown={dayForTime}
                            onChange={(e) => { const next = fromEnd(e.target.value, time, duration); if (next.time !== time) { dayForTime(); setTime(next.time); } setDuration(next.duration); }} />}
                </div>
                <DurationField label={t(event ? 'eventDuration' : 'plannedTime')} value={duration} onChange={setDuration}
                    maxHours={event ? 168 : 99}
                    hint={event && duration && due && time ? fill(t('eventUntil'), { time: timeText(minutesOfDay(time) + duration) }) : t(event ? 'eventDurationHint' : 'plannedTimeHint')} />
                {event && !elsewhere && <EventTypePicker value={eventTypeId} onChange={(id) => { setEventTypeId(id); setTypeByHand(true); }}
                    autoNote={!typeByHand && match && eventTypeId === match.type.id ? fill(t('keywordAutoNote'), { keyword: match.keyword }) : null} />}
                <input className={styles.input} type="text" placeholder={t('description')} aria-label={t('description')}
                    value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
                {!event && <>
                    <div className={styles.prioHead}>
                        <label htmlFor="prioritise">{t('prioritise')} <output htmlFor="prioritise">{prio ?? '–'}</output></label>
                        {prio !== null &&
                            <button type="button" className={styles.prioClear} onClick={() => setPrio(null)}>{t('noPrio')}</button>}
                    </div>
                    <div className={`${styles.rowDiv} ${prio === null ? styles.prioUnset : ''}`}>
                        <p>{t('low')}</p>
                        <input type="range" id="prioritise" min="0" max="100" step="1" value={prio ?? 50} onChange={(e) => setPrio(Number(e.target.value))} />
                        <p>{t('high')}</p>
                    </div>
                </>}
                <TaskColorPicker value={color} onChange={setColor} />

                <button type="button" className={styles.moreToggle} aria-expanded={showMore} onClick={() => setShowMore(!showMore)}>
                    <Icon name="chevronDown" size={16} className={showMore ? styles.moreIconOpen : styles.moreIcon} /> {showMore ? t('fewerOptions') : t('moreOptions')}
                </button>
                {showMore &&
                    <div className={styles.more}>
                        <TaskOptionsFields value={extras} hasTime={Boolean(saved.due && saved.time)} hasDate={Boolean(saved.due)} personal={!elsewhere} onChange={(change) => setExtras(prev => ({ ...prev, ...change }))} />
                        {!elsewhere && <div className={styles.shareBlock}>
                            <span className={styles.shareLabel}>{t('shareWithFriends')}</span>
                            {friends.length > 0
                                ? <>
                                    <FriendPicker friends={friends} selected={shareWith} onChange={setShareWith} />
                                    {shareWith.length > 0 && <p className={styles.shareHint}>{t('shareOnCreateHint')}</p>}
                                </>
                                : <p className={styles.shareHint}>{t('noFriendsToShare')} <Link to={COMMUNITY_PATHS.friends}>{t('findFriends')} →</Link></p>}
                        </div>}
                    </div>}

                <button type="submit" className={styles.createBtn} disabled={busy}>{t('createBtn')}</button>
            </form>
        </div>
    )
}
