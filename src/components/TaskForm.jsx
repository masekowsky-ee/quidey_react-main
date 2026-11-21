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
import { EventTypePicker, KindSwitch, TypeHint } from './task/KindFields.jsx';
import { buildTaskPayload, EMPTY_EXTRAS, useTaskDraft } from '../features/tasks/taskDraft';
import { dueText, fill } from '../features/helperFunction';
import { parseQuickEntry, stripFound, needsAiHelp } from '../features/tasks/quickParse';
import { useAiQuota, readLineWithAi, left } from '../features/ai/ai';
import { prioLevel, durationText } from '../features/calendar/calendar';
import { timeText } from '../features/calendar/calendar';
import { defaultReminders, reminderLabel } from '../features/tasks/reminders';
import { addSharedTask, selectSharedGroups, togetherErrorText } from '../features/together/togetherAction';
import { shownSubGroup } from '../features/tasks/subGroups';
import { addToShownCollection } from '../features/collections/collections';

import Icon from './icons';
import ScanLink from './scan/ScanLink.jsx';
import MicButton from './voice/MicButton.jsx';
import SheetGrabber from './SheetGrabber.jsx';
import { useFocusOnArrival } from '../features/layout/dragDismiss';

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
    // onReminder(name): testers' "Erinnerung" choice, QuickAdd swaps in the reminder form;
    // initialKind / initialName: coming back from there
    const {setCreateTask, sheet, onReminder, onNote, onScan, initialKind = 'task', initialName = '', initialDue = '', initialTime = '', target = null, group} = props;
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
    const elsewhere = Boolean(session || target);
    // the group (or collection) the new one goes into: the calendar names its filter's (group, null
    // for none), elsewhere it's the one shown on Home
    const intoGroup = group !== undefined ? group : groupToDisplay.group;
    const collection = intoGroup?.collection ? intoGroup : null;
    // where the entry goes: events (it can be an event), personalFields (reminders, repeating,
    // types, sharing with friends); what saving does is chosen in handleSubmit
    const destination = { events: !target || target.events, personalFields: !elsewhere };

    const types = useSelector(state => state.task.eventTypes);
    const draft = useTaskDraft({
        kind: initialKind, name: initialName, due: initialDue, time: initialTime,
        extras: { ...EMPTY_EXTRAS, reminders: defaultReminders() },
    });
    const { kind, name, due, time, duration, prio, description, color, extras, eventTypeId, typeByHand, match } = draft;
    const [kindByHand, setKindByHand] = useState(initialKind !== 'task');
    const [showMore, setShowMore] = useState(false);
    const [shareWith, setShareWith] = useState([]);
    const [busy, setBusy] = useState(false);
    // a day, time or priority written into the name ("morgen 14 Uhr !hoch") is taken over on
    // saving, for the fields still empty; "Ignore" keeps the name as it was typed
    const [ignoreQuick, setIgnoreQuick] = useState(false);
    const parsed = useMemo(() => parseQuickEntry(name, undefined, { eventTypes: types }), [name, types]);
    const nameMakesEvent = !ignoreQuick && !kindByHand && kind === 'task' && parsed.kind === 'event' && destination.events;
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
    const quickKinds = Object.keys(quick);
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
            if (entry.kind === 'reminder' && onReminder) { onReminder(text); return; }
            draft.setName(entry.name);
            if (entry.due) draft.setDue(entry.due);
            if (entry.time) draft.setTime(entry.time);
            if (entry.durationMinutes) draft.setDuration(entry.durationMinutes);
            if (entry.color) draft.setColor(entry.color);
            if (entry.prio != null) draft.setPrio(entry.prio);
            if (entry.kind === 'event' && destination.events) { draft.setKind('event'); setKindByHand(true); }
            if (entry.eventTypeId) draft.pickType(entry.eventTypeId);
            if (entry.reminders.length > 0) draft.changeExtras({ reminders: entry.reminders });
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
        if (!saved.name.trim()) {
            dispatch( setCustomError({bool: true, message: t('nameTaskError') }) );
            return;
        }
        if (event && !saved.due) {
            dispatch(setCustomError({ bool: true, message: t('eventNeedsDay') }));
            return;
        }
        if (!linkIsValid(extras.link)) {
            setShowMore(true);
            return;
        }
        const { save, errorText } = target ? {
            save: (payload) => target.save(payload),
            errorText: (err) => target.errorText?.(err) ?? (err.message || t('friendError_generic')),
        } : session ? {
            save: (payload) => dispatch(addSharedTask(session.sessionId, payload)),
            errorText: (err) => togetherErrorText(t, err),
        } : {
            save: async (payload) => {
                // the shown group gets the new task (not a shared session's group: those aren't real groups)
                const groupId = intoGroup?.id;
                const activeGroupId = typeof groupId === 'number' && intoGroup.name !== 'all' ? groupId : null;
                const { name, due, description, prio, ...more } = payload;
                const task = await dispatch(addTask(name, due, description, prio, activeGroupId, undefined, more));
                // made already: not getting into the collection is only told, the form still closes
                await dispatch(addToShownCollection(collection, task))
                    .catch(() => dispatch(showToast(t('collectionError'), 'error')));
                if (shareWith.length > 0) {
                    await dispatch(shareTask(task.id, shareWith));
                    dispatch(showToast(t('shareInviteSent'), 'success'));
                }
            },
            errorText: (err) => err.message || t('friendError_generic'),
        };
        const payload = buildTaskPayload({ ...saved, description, extras }, {
            personal: destination.personalFields,
            withKind: destination.events,
            groupId: subGroupId || undefined,
        });
        setBusy(true);
        try {
            await save(payload);
            setCreateTask(false);
        } catch (err) {
            dispatch(setCustomError({ bool: true, message: errorText(err) }));
            setBusy(false);
        }
    }

    return (
        <div className={`${styles.div}`} role="dialog" aria-modal="true" aria-labelledby="createTaskTitle" {...sheet?.panel}>
            {sheet && <SheetGrabber />}
            <button className={styles.closeBtn} onClick={()=>{setCreateTask(false)}} aria-label={t('close')}>
                <Icon name="mCross" size={24} />
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
                {destination.events &&
                <KindSwitch value={effectiveKind} kinds={onReminder && !elsewhere ? ['task', 'event', 'reminder', ...(onNote ? ['note'] : [])] : undefined}
                    onChange={(next) => {
                        if (next === 'reminder') { onReminder(name); return; }
                        if (next === 'note') { onNote(name); return; }
                        draft.changeKind(next); setKindByHand(true);
                    }} />}
                {/* the plus button's form: study material read by the AI instead (QuickAdd swaps in the scan sheet) */}
                {!elsewhere && <ScanLink onScan={onScan} />}
                <div className={styles.nameRow}>
                    <input ref={nameRef} className={`${styles.input} ${styles.grow}`} type="text" placeholder={t(event ? 'eventName' : 'taskName')} aria-label={t(event ? 'eventName' : 'taskName')}
                        aria-describedby={quickParts.length > 0 ? 'quick-add-hint' : undefined}
                        value={name} maxLength={200} onChange={(e) => draft.changeName(e.target.value)} />
                    {/* speaking the line instead of typing it: read the same way (features/voice/voice.js) */}
                    <MicButton className={styles.nameMic} onText={(text) => { draft.changeName(text.slice(0, 200)); setIgnoreQuick(false); }} />
                </div>
                {quickParts.length > 0 &&
                    <p id="quick-add-hint" className={styles.quickHint} aria-live="polite">
                        <span>
                            {fill(t('quickAddFound'), { what: quickParts.join(' · ') })}
                            {saved.name.trim() && <span className={styles.quickName}> {fill(t('quickAddName'), { name: saved.name })}</span>}
                        </span>
                        <button type="button" className={styles.quickIgnore} onClick={() => setIgnoreQuick(true)}>{t('quickAddIgnore')}</button>
                    </p>}
                {parsed.kind === 'reminder' && onReminder && !elsewhere && !ignoreQuick &&
                    <TypeHint icon={<Icon name="alarm" size={14} />} onClick={() => onReminder(stripFound(name, parsed.found, ['asReminder']))}>
                        {' '}{t('quickAddAsReminder')}
                    </TypeHint>}
                {offerAi &&
                    <button type="button" className={styles.aiHelp} onClick={readWithAi} disabled={aiLeft === 0 || aiState?.reading}>
                        <Icon name="brain" size={14} />
                        <span>{aiState?.reading ? t('aiReading') : t('aiReadLine')}</span>
                        <span className={styles.aiLeft}>{fill(t('aiLeft'), { n: aiLeft })}</span>
                    </button>}
                {aiState?.message && <p className={styles.aiStatus} role="status" aria-label={t('aiHelpStatus')}>{aiState.message}</p>}
                {!event && !elsewhere && match &&
                    <TypeHint color={match.type.color} onClick={draft.suggestEvent}>
                        {fill(t('keywordSuggestEvent'), { type: match.type.name })}
                    </TypeHint>}
                <div className={event ? styles.whenEvent : styles.whenTask}>
                    <label className={`${styles.whenField} ${styles.whenDay}`}>
                        <span className={styles.fieldLabel}>{t(event ? 'eventDay' : 'dueDate')}</span>
                        <input className={styles.input} type="date" aria-label={t(event ? 'eventDay' : 'dueDate')}
                            required={event} value={due} onChange={(e) => draft.setDue(e.target.value)} />
                    </label>
                    <label className={styles.whenField}>
                        <span className={styles.fieldLabel}>{t(event ? 'eventStart' : 'taskTime')}</span>
                        <input className={styles.input} type="time" aria-label={`${t(event ? 'eventStart' : 'taskTime')} (${t('allDay')}: –)`}
                            value={time} onPointerDown={draft.dayForTime} onChange={(e) => draft.changeTime(e.target.value)} />
                    </label>
                    {/* an event's end: follows start and length, setting it changes the length */}
                    {event && <span className={styles.timeDash} aria-hidden="true">–</span>}
                    {event &&
                        <label className={styles.whenField}>
                            <span className={styles.fieldLabel}>{t('eventEnd')}</span>
                            <input className={styles.input} type="time" aria-label={t('eventEnd')}
                                value={draft.endTime} onPointerDown={draft.dayForTime}
                                onChange={(e) => draft.setEnd(e.target.value)} />
                        </label>}
                </div>
                <DurationField label={t(event ? 'eventDuration' : 'plannedTime')} value={duration} onChange={draft.setDuration}
                    maxHours={event ? 168 : 99}
                    hint={event && due && draft.untilTime ? fill(t('eventUntil'), { time: draft.untilTime }) : t(event ? 'eventDurationHint' : 'plannedTimeHint')} />
                {event && destination.personalFields && <EventTypePicker value={eventTypeId} onChange={draft.pickType}
                    autoNote={draft.autoNote ? fill(t('keywordAutoNote'), { keyword: draft.autoNote }) : null} />}
                <input className={styles.input} type="text" placeholder={t('description')} aria-label={t('description')}
                    value={description} maxLength={2000} onChange={(e) => draft.setDescription(e.target.value)} />
                <TaskColorPicker value={color} onChange={draft.setColor} />

                <button type="button" className={styles.moreToggle} aria-expanded={showMore} onClick={() => setShowMore(!showMore)}>
                    <Icon name="chevronDown" size={16} className={showMore ? styles.moreIconOpen : styles.moreIcon} /> {showMore ? t('fewerOptions') : t('moreOptions')}
                </button>
                {showMore &&
                    <div className={styles.more}>
                        {/* a task's priority: optional, "–" until the slider is touched ("!hoch" in the name sets it too) */}
                        {!event &&
                            <div className={styles.prioBlock}>
                                <div className={styles.prioHead}>
                                    <label htmlFor="prioritise">{t('prioritise')} <output htmlFor="prioritise">{saved.prio ?? '–'}</output></label>
                                    {prio !== null &&
                                        <button type="button" className={styles.prioClear} onClick={() => draft.setPrio(null)}>{t('noPrio')}</button>}
                                </div>
                                <div className={`${styles.rowDiv} ${saved.prio === null ? styles.prioUnset : ''}`}>
                                    <p>{t('low')}</p>
                                    <input type="range" id="prioritise" min="0" max="100" step="1" value={saved.prio ?? 50} onChange={(e) => draft.setPrio(Number(e.target.value))} />
                                    <p>{t('high')}</p>
                                </div>
                            </div>}
                        <TaskOptionsFields value={extras} hasTime={Boolean(saved.due && saved.time)} hasDate={Boolean(saved.due)} personal={destination.personalFields} onChange={draft.changeExtras} />
                        {destination.personalFields && <div className={styles.shareBlock}>
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
