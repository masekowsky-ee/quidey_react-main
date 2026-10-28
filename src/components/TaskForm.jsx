import { useMemo, useState } from 'react';
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
import { EventTypePicker, KindSwitch } from './task/KindFields.jsx';
import { matchEventType } from '../features/tasks/kinds';
import { dueText, fill } from '../features/helperFunction';
import { parseQuickEntry, stripFound } from '../features/tasks/quickParse';
import { prioLevel } from '../features/calendar/calendar';
import { dateKey, minutesOfDay, timeText } from '../features/calendar/calendar';
import { defaultReminders } from '../features/tasks/reminders';
import { addSharedTask, selectSharedGroups, togetherErrorText } from '../features/together/togetherAction';
import { shownSubGroup } from '../features/tasks/subGroups';

import Icon from './icons';
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
export default function TaskForm(props){
    const {setCreateTask} = props;

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

    const [kind, setKind] = useState('task');
    const event = kind === 'event';
    const [eventTypeId, setEventTypeId] = useState(null);
    // a task's planned time, an event's length (minutes)
    const [duration, setDuration] = useState(null);
    const [name, setName] = useState('');
    // the type follows the name's keywords until one is picked by hand (also "none")
    const types = useSelector(state => state.task.eventTypes);
    const [typeByHand, setTypeByHand] = useState(false);
    const match = matchEventType(name, types);
    const followName = (nextName, nextKind) => {
        if (typeByHand || nextKind !== 'event') return;
        setEventTypeId(matchEventType(nextName, types)?.type.id ?? null);
    };
    const [due, setDue] = useState('');
    const [time, setTime] = useState('');
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
    const parsed = useMemo(() => parseQuickEntry(name), [name]);
    const quick = ignoreQuick ? {} : {
        ...(!due && parsed.due && { due: parsed.due }),
        ...(!time && parsed.time && { time: parsed.time }),
        ...(!event && prio === null && parsed.prio !== null && { prio: parsed.prio }),
    };
    const quickKinds = Object.keys(quick);
    // what is saved: the typed fields, with what the name said in the empty ones
    const saved = {
        name: quickKinds.length > 0 ? stripFound(name, parsed.found, quickKinds) : name,
        due: quick.due ?? due,
        time: quick.time ?? time,
        prio: quick.prio ?? prio,
    };
    const quickParts = [
        quick.due && dueText(quick.due, t),
        quick.time && fill(t('quickAddAt'), { time: quick.time }),
        quick.prio !== undefined && t(`quickAddPrio_${prioLevel(quick.prio)}`),
    ].filter(Boolean);

    const friends = useFriends();

    async function handleSubmit(e){
        e.preventDefault();
        const { name, due, time, prio } = saved;
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
        const groupId = groupToDisplay.group?.id;
        const activeGroupId = typeof groupId === 'number' && groupToDisplay.group.name !== 'all' ? groupId : null;
        setBusy(true);
        try {
            const task = await dispatch(addTask(name.trim(), due, description.trim(), event ? null : prio, activeGroupId, undefined, {
                kind,
                event_type_id: event ? eventTypeId : null,
                // a time of day needs a day
                due_time: due && time ? time : null,
                duration_minutes: duration,
                // reminders need a day (without a time they count from my all-day time)
                reminders: due ? extras.reminders : [],
                // only a reminder can come by mail
                reminder_email: Boolean(due && extras.reminders.length > 0 && extras.reminder_email),
                color,
                location: extras.location.trim(),
                link: extras.link.trim(),
                details: extras.details.trim(),
                // repeating needs a day
                repeat: due ? extras.repeat : null,
                repeat_left: due && extras.repeat ? extras.repeat_left : null,
            }));
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
        <div className={`${styles.div}`}>
            <button className={styles.closeBtn} onClick={()=>{setCreateTask(false)}} aria-label={t('close')}>
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>
            </button>
            <h2>{t(event ? 'createEventH2' : 'createTaskH2')}</h2>
            {session &&
                <p className={styles.shareHint}>
                    {fill(t('createInSession'), { name: subGroupName ? `${session.name} · ${subGroupName}` : session.name })}
                </p>}
            <form className={`${styles.form}`} onSubmit={handleSubmit} noValidate>
                <KindSwitch value={kind} onChange={(next) => { setKind(next); followName(name, next); }} />
                {/* the form opens to be typed into: the name has the focus */}
                <input className={styles.input} type="text" placeholder={t(event ? 'eventName' : 'taskName')} aria-label={t(event ? 'eventName' : 'taskName')}
                    autoFocus aria-describedby={quickParts.length > 0 ? 'quick-add-hint' : undefined}
                    value={name} maxLength={200} onChange={(e) => { setName(e.target.value); followName(e.target.value, kind); }} />
                {quickParts.length > 0 &&
                    <p id="quick-add-hint" className={styles.quickHint} aria-live="polite">
                        <span>
                            {fill(t('quickAddFound'), { what: quickParts.join(' · ') })}
                            {saved.name.trim() && <span className={styles.quickName}> {fill(t('quickAddName'), { name: saved.name })}</span>}
                        </span>
                        <button type="button" className={styles.quickIgnore} onClick={() => setIgnoreQuick(true)}>{t('quickAddIgnore')}</button>
                    </p>}
                {/* a task whose name fits a type: one tap makes it such an event */}
                {!event && !session && match &&
                    <button type="button" className={styles.typeHint} data-task-color={match.type.color ?? undefined}
                        onClick={() => { setKind('event'); setEventTypeId(match.type.id); }}>
                        <span className={styles.typeHintDot} aria-hidden="true" />
                        {fill(t('keywordSuggestEvent'), { type: match.type.name })}
                    </button>}
                <div className={styles.rowDiv}>
                    <input className={`${styles.input} ${styles.grow}`} type="date" aria-label={t(event ? 'eventDay' : 'dueDate')}
                        required={event} value={due} onChange={(e) => setDue(e.target.value)} />
                    <input className={styles.input} type="time" aria-label={`${t(event ? 'eventStart' : 'taskTime')} (${t('allDay')}: –)`} title={t(event ? 'eventStart' : 'taskTime')}
                        value={time} onPointerDown={dayForTime} onChange={(e) => { dayForTime(); setTime(e.target.value); }} />
                </div>
                <DurationField label={t(event ? 'eventDuration' : 'plannedTime')} value={duration} onChange={setDuration}
                    maxHours={event ? 168 : 99}
                    hint={event && duration && due && time ? fill(t('eventUntil'), { time: timeText(minutesOfDay(time) + duration) }) : t(event ? 'eventDurationHint' : 'plannedTimeHint')} />
                {event && !session && <EventTypePicker value={eventTypeId} onChange={(id) => { setEventTypeId(id); setTypeByHand(true); }}
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
                        <TaskOptionsFields value={extras} hasTime={Boolean(saved.due && saved.time)} hasDate={Boolean(saved.due)} personal={!session} onChange={(change) => setExtras(prev => ({ ...prev, ...change }))} />
                        {!session && <div className={styles.shareBlock}>
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
