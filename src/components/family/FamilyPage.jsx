import styles from '../Together.module.css';
import { COMMUNITY_PATHS, friendsPath } from '../../features/community/paths';
import own from './Family.module.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { displayName, fill, formatDuration, formatRelative, parseDate, sameDay, toDateOnly } from '../../features/helperFunction';
import { dateKey, taskTimeText } from '../../features/calendar/calendar';
import { fetchFriends } from '../../features/friends/friendsAction';
import {
    addFamilyTask, removeFamilyTask, updateFamilyTask, deleteFamily, fetchFamily, fetchFamilyMessages, inviteToFamily, removeFamilyMember,
    renameFamily, sendFamilyMessage, updateFamily, FAMILY_EMOJIS, addFamilySubGroup, removeFamilySubGroup,
} from '../../features/family/family';
import { useIsTester } from '../../features/auth/tester';
import { createdText } from '../../features/tasks/created';
import { inSubGroup, openCounts, shownSubGroup } from '../../features/tasks/subGroups';
import SubGroupBar from '../subgroups/SubGroupBar.jsx';
import { TASK_COLORS } from '../../features/tasks/taskColors';
import { rememberPresence } from '../../features/presence/presence';
import { OnlineLabel } from '../presence/OnlineDot';
import { calendarLink } from '../../features/calendar/sources';
import { useRealtime, useRealtimeRefresh, useSafetyPoll } from '../../features/realtime/socket';
import { useNow } from '../../features/together/work';
import { useFamilyRun } from './useFamilyRun';
import Avatar from '../together/Avatar';
import TaskEditDialog from '../task/TaskEditDialog';
import Icon from '../calendar/icons.jsx';
// the app's outline set, for what the calendar's icons don't have (flame, chevron)
import AppIcon from '../icons';
import FriendPicker from '../together/FriendPicker';

const UPCOMING_MAX = 8;
const MESSAGE_MAX = 1000;
const NOTE_MAX = 2000;

// The joined members, for "who takes care of it"
const joinedPeople = (family) => family.people.filter(person => person.status === 'joined');

// "Who takes care of it?": nobody, or one of the joined members
function AssigneeSelect({ family, value, onChange, className, label }) {
    const { t } = useTranslation();
    return (
        <select className={className} value={value ?? ''} aria-label={label ?? t('familyAssignee')} title={label ?? t('familyAssignee')}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{t('familyAssigneeNobody')}</option>
            {joinedPeople(family).map(person => (
                <option key={person.user.id} value={person.user.id}>
                    {person.user.id === family.me ? t('familyAssigneeMe') : displayName(person.user)}
                </option>
            ))}
        </select>
    );
}

// Loads a family and keeps it current: again on "family:changed" for it, and as a safety net.
// missing: I'm not (or no longer) in it, or it was deleted.
function useFamily(id) {
    const [state, setState] = useState({ id: null, family: null, missing: false });
    const seq = useRef(0);
    const load = useCallback(() => {
        const mine = ++seq.current;
        fetchFamily(id).then(
            (family) => { if (mine === seq.current) setState({ id, family, missing: false }); },
            (err) => { if (mine === seq.current && err.status === 404) setState({ id, family: null, missing: true }); },
        );
    }, [id]);
    useEffect(() => { load(); }, [load]);
    useSafetyPoll(load, { everyMs: 60 * 1000 });
    useRealtimeRefresh(['family:changed'], load, (event, payload) => Number(payload?.familyId) === id);
    // a change answered with the whole family: show it right away
    const show = useCallback((family) => {
        seq.current++;
        setState({ id, family, missing: false });
    }, [id]);
    const current = state.id === id ? state : { family: null, missing: false };
    return { family: current.family, missing: current.missing, show };
}

// The chat: the newest messages, older ones on demand, new ones live
function useFamilyChat(id) {
    const [chat, setChat] = useState({ id: null, messages: [], hasMore: false });
    const addMessages = useCallback((incoming, { older = false, hasMore } = {}) => setChat(prev => {
        const base = prev.id === id ? prev : { id, messages: [], hasMore: false };
        const known = new Set(base.messages.map(m => m.id));
        const fresh = (incoming ?? []).filter(m => !known.has(m.id));
        const messages = older ? [...fresh, ...base.messages] : [...base.messages, ...fresh].sort((a, b) => a.id - b.id);
        return { id, messages, hasMore: hasMore ?? base.hasMore };
    }), [id]);

    const load = useCallback(() => fetchFamilyMessages(id)
        .then(data => addMessages(data?.messages, { hasMore: Boolean(data?.hasMore) }))
        .catch(() => {}), [id, addMessages]);
    useEffect(() => { load(); }, [load]);
    // after a lost connection: whatever came in meanwhile
    useRealtimeRefresh([], load);
    useRealtime('family:message', (payload) => {
        if (Number(payload?.familyId) === id && payload.message) addMessages([payload.message]);
    });

    const current = chat.id === id ? chat : { messages: [], hasMore: false };
    const loadOlder = () => fetchFamilyMessages(id, current.messages[0]?.id)
        .then(data => addMessages(data?.messages, { older: true, hasMore: Boolean(data?.hasMore) }))
        .catch(() => {});
    return { ...current, addMessages, loadOlder };
}

// The family's emoji and colour; the owner opens a small panel to pick them
function FamilyLooks({ family, onChanged }) {
    const { t } = useTranslation();
    const run = useFamilyRun();
    const [open, setOpen] = useState(false);
    const emoji = family.emoji ?? '🏡';
    if (!family.isOwner) return <span className={own.emojiBadge} aria-hidden="true">{emoji}</span>;

    const change = async (changes) => {
        const changed = await run(updateFamily(family.id, changes));
        if (changed) onChanged(changed);
    };
    return (
        <span className={own.looksWrap}>
            <button type="button" className={own.emojiBadge} onClick={() => setOpen(value => !value)}
                aria-expanded={open} aria-label={t('familyLooks')} title={t('familyLooks')}>
                {emoji}
            </button>
            {open &&
                <div className={own.looks} role="group" aria-label={t('familyLooks')}>
                    <p className={own.looksLabel}>{t('familyEmoji')}</p>
                    <div className={own.emojiGrid}>
                        {FAMILY_EMOJIS.map(item => (
                            <button key={item} type="button" aria-pressed={family.emoji === item}
                                className={family.emoji === item ? own.emojiOn : undefined} onClick={() => change({ emoji: item })}>
                                {item}
                            </button>
                        ))}
                    </div>
                    <p className={own.looksLabel}>{t('familyColor')}</p>
                    <div className={own.colorRow}>
                        <button type="button" className={own.colorNone} aria-pressed={!family.color}
                            aria-label={t('familyColorNone')} title={t('familyColorNone')} onClick={() => change({ color: null })} />
                        {TASK_COLORS.map(color => (
                            <button key={color} type="button" data-task-color={color} className={own.colorDot}
                                aria-pressed={family.color === color} aria-label={t(`taskColor_${color}`)} title={t(`taskColor_${color}`)}
                                onClick={() => change({ color })} />
                        ))}
                    </div>
                    <button type="button" className={styles.quietBtn} onClick={() => setOpen(false)}>{t('familyLooksDone')}</button>
                </div>}
        </span>
    );
}

// The board: one short text for everybody (any member changes it)
function FamilyBoard({ family, onChanged }) {
    const { t, language } = useTranslation();
    const locale = language === 'de' ? 'de-DE' : 'en-GB';
    const run = useFamilyRun();
    const now = useNow(true, 60 * 1000);
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const note = family.note;

    const start = () => { setText(note?.text ?? ''); setEditing(true); };
    const save = async (e) => {
        e.preventDefault();
        setBusy(true);
        const changed = await run(updateFamily(family.id, { note: text.trim() }));
        setBusy(false);
        if (changed) { onChanged(changed); setEditing(false); }
    };

    return (
        <section className={`${styles.card} ${own.board}`}>
            <div className={styles.cardHead}>
                <h2 className={styles.cardTitle}>{t('familyBoard')}</h2>
                {!editing && <button type="button" className={styles.quietBtn} onClick={start}>{note ? t('familyBoardEdit') : t('familyBoardPin')}</button>}
            </div>
            {editing
                ? <form className={own.boardForm} onSubmit={save}>
                    <textarea value={text} maxLength={NOTE_MAX} rows={4} autoFocus onChange={(e) => setText(e.target.value)}
                        placeholder={t('familyBoardPlaceholder')} aria-label={t('familyBoard')} />
                    <div className={styles.formActions}>
                        <span className={own.boardCount}>{text.length} / {NOTE_MAX}</span>
                        <button type="button" className={styles.quietBtn} onClick={() => setEditing(false)}>{t('cancel')}</button>
                        <button type="submit" className={styles.primaryBtn} disabled={busy}>{t('save')}</button>
                    </div>
                </form>
                : note
                    ? <>
                        <p className={own.boardText}>{note.text}</p>
                        <p className={own.boardMeta}>
                            {note.updatedBy && fill(t('familyBoardBy'), { name: displayName(note.updatedBy) })}
                            {note.updatedAt && <> · <time dateTime={note.updatedAt}>{formatRelative(note.updatedAt, now, locale)}</time></>}
                        </p>
                    </>
                    : <p className={styles.emptyLine}>{t('familyBoardEmpty')}</p>}
        </section>
    );
}

// The family's list: entries without a day (shopping, chores), ticked off by anybody, each
// with whoever takes care of it; done ones folded away under the open ones.
// subGroup: the shown sub-group (testers, null: all), which new items go into too.
function FamilyList({ family, onChanged, subGroup }) {
    const { t, language } = useTranslation();
    const run = useFamilyRun();
    const myUsername = useSelector(state => state.auth.user?.username);
    const [name, setName] = useState('');
    const [assignee, setAssignee] = useState(null);
    const [busy, setBusy] = useState(false);
    const [showDone, setShowDone] = useState(false);
    const items = inSubGroup(family.tasks, subGroup).filter(task => !task.due);
    const open = items.filter(task => !task.done);
    const done = items.filter(task => task.done);

    const change = (request) => request.then(onChanged);
    const add = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setBusy(true);
        const changed = await run(addFamilyTask(family.id, {
            name: name.trim(), ...(assignee ? { assignee_id: assignee } : {}), ...(subGroup ? { group_id: subGroup } : {}),
        }));
        setBusy(false);
        if (changed) { onChanged(changed); setName(''); }
    };
    const canRemove = (task) => family.isOwner || task.addedBy?.id === family.me;

    const row = (task) => (
        <li key={task.id} className={own.listItem} data-done={task.done} title={createdText(task, t, language, myUsername) || undefined}>
            <button type="button" className={own.entryCheck} aria-pressed={task.done}
                onClick={() => run(change(updateFamilyTask(family.id, task.id, { done: !task.done })), task.done ? null : 'toast_entryDone')}
                aria-label={`${t(task.done ? 'markUndone' : 'markDone')}: ${task.name}`} title={t(task.done ? 'markUndone' : 'markDone')}>
                <Icon name="check" size={14} />
            </button>
            <span className={own.listName}>{task.name}</span>
            <AssigneeSelect family={family} value={task.assignee?.id} className={own.assigneeChip}
                label={`${t('familyAssignee')}: ${task.name}`}
                onChange={(id) => run(change(updateFamilyTask(family.id, task.id, { assignee_id: id })))} />
            {canRemove(task)
                ? <button type="button" className={own.entryEdit} onClick={() => run(change(removeFamilyTask(family.id, task.id)))}
                    aria-label={`${t('delete')}: ${task.name}`} title={t('delete')}>
                    <Icon name="close" size={16} />
                </button>
                : <span />}
        </li>
    );

    return (
        <section className={styles.card}>
            <div className={styles.cardHead}>
                <h2 className={styles.cardTitle}>{t('familyList')}</h2>
                {open.length > 0 && <span className={styles.meta}>{fill(t('familyListOpen'), { count: open.length })}</span>}
            </div>
            {items.length === 0 && <p className={styles.emptyLine}>{t('familyListEmpty')}</p>}
            {open.length > 0 && <ul className={own.list}>{open.map(row)}</ul>}
            {done.length > 0 &&
                <button type="button" className={own.doneToggle} aria-expanded={showDone} onClick={() => setShowDone(value => !value)}>
                    {fill(t('familyListDone'), { count: done.length })}
                    <AppIcon name="chevronDown" size={14} />
                </button>}
            {showDone && done.length > 0 && <ul className={own.list}>{done.map(row)}</ul>}
            <form className={own.listAdd} onSubmit={add}>
                <input value={name} maxLength={200} onChange={(e) => setName(e.target.value)}
                    placeholder={t('familyListAdd')} aria-label={t('familyListAdd')} />
                <AssigneeSelect family={family} value={assignee} onChange={setAssignee} />
                <button type="submit" className={styles.primaryBtn} disabled={busy || !name.trim()}>{t('add')}</button>
            </form>
        </section>
    );
}

// Title; the owner clicks it to rename
function FamilyTitle({ family, onChanged }) {
    const { t } = useTranslation();
    const run = useFamilyRun();
    const [editing, setEditing] = useState(false);
    const save = async (e) => {
        const name = e.target.value.trim();
        setEditing(false);
        if (!name || name === family.name) return;
        const changed = await run(renameFamily(family.id, name));
        if (changed) onChanged(changed);
    };
    if (editing) {
        return <input className={styles.titleInput} defaultValue={family.name} maxLength={60} autoFocus aria-label={t('familyName')}
            onBlur={save} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(false); }} />;
    }
    return family.isOwner
        ? <h1 className={styles.title}>
            <button className={styles.renamable} title={t('rename')} onClick={() => setEditing(true)}>
                {family.name} <span className={styles.editHint} aria-hidden="true"><Icon name="edit" size={18} /></span>
            </button>
        </h1>
        : <h1 className={styles.title}>{family.name}</h1>;
}

// What's coming up in the family calendar: tick entries off, edit or delete them (who added one,
// or the owner, may delete it), and add new ones. subGroup / subGroups: the shown sub-group and
// all of them (testers; subGroups undefined for everybody else).
function Upcoming({ family, onChanged, subGroup, subGroups }) {
    const { t, language } = useTranslation();
    const locale = language === 'de' ? 'de-DE' : 'en-GB';
    const run = useFamilyRun();
    const myUsername = useSelector(state => state.auth.user?.username);
    const today = toDateOnly(new Date());
    const todayKey = dateKey(today);
    const [name, setName] = useState('');
    const [day, setDay] = useState(todayKey);
    const [time, setTime] = useState('');
    const [assignee, setAssignee] = useState(null);
    const [busy, setBusy] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [onlyMine, setOnlyMine] = useState(false);
    const editing = family.tasks.find(task => task.id === editingId) ?? null;

    // every change answers with the whole family, which is shown right away
    const change = (request) => request.then(onChanged);
    const toggleDone = (task) => run(change(updateFamilyTask(family.id, task.id, { done: !task.done })),
        task.done ? null : 'toast_entryDone');

    // the server sends them by day and time; "YYYY-MM-DD" compares like dates
    const upcoming = inSubGroup(family.tasks, subGroup)
        .filter(task => !task.done && task.due && dateKey(task.due) >= todayKey)
        .filter(task => !onlyMine || task.assignee?.id === family.me)
        .slice(0, UPCOMING_MAX);

    const add = async (e) => {
        e.preventDefault();
        if (!name.trim() || !day) return;
        setBusy(true);
        const changed = await run(addFamilyTask(family.id, {
            name: name.trim(), due: day, ...(time ? { due_time: time } : {}), ...(assignee ? { assignee_id: assignee } : {}),
            ...(subGroup ? { group_id: subGroup } : {}),
        }));
        setBusy(false);
        if (changed) {
            onChanged(changed);
            setName('');
            setTime('');
        }
    };

    const dayText = (value) => {
        const date = parseDate(value);
        return sameDay(date, today) ? t('today') : date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
    };

    return (
        <section className={styles.card}>
            <div className={styles.cardHead}>
                <h2 className={styles.cardTitle}>{t('familyUpcoming')}</h2>
                <span className={own.headLinks}>
                    <button type="button" className={own.filterBtn} aria-pressed={onlyMine} onClick={() => setOnlyMine(value => !value)}>
                        {t('familyOnlyMine')}
                    </button>
                    <Link to={calendarLink('family', family.id)} className={own.calendarLink}>{t('calendarOpenCalendar')} →</Link>
                </span>
            </div>
            {upcoming.length === 0
                ? <p className={styles.emptyLine}>{t(onlyMine ? 'familyNothingMine' : 'familyNothingPlanned')}</p>
                : <ul className={own.upcoming}>
                    {upcoming.map(task => (
                        <li key={task.id} className={own.entry} title={createdText(task, t, language, myUsername) || undefined}>
                            <button type="button" className={own.entryCheck} aria-pressed={false} onClick={() => toggleDone(task)}
                                aria-label={`${t('markDone')}: ${task.name}`} title={t('markDone')}>
                                <Icon name="check" size={14} />
                            </button>
                            <span className={`${own.entryWhen} ${sameDay(parseDate(task.due), today) ? own.entryToday : ''}`}>
                                {dayText(task.due)}{task.due_time ? ` · ${taskTimeText(task)}` : ''}
                            </span>
                            <span>
                                <Link to={`${calendarLink('family', family.id)}&date=${dateKey(task.due)}&day=${dateKey(task.due)}&task=${task.id}`} className={own.entryName}>
                                    {task.name}
                                </Link>
                                <span className={own.entryMeta}>
                                    {[
                                        task.assignee && fill(t(task.assignee.id === family.me ? 'familyForMe' : 'familyForName'), { name: displayName(task.assignee) }),
                                        task.location,
                                        task.addedBy && fill(t('addedByName'), { name: displayName(task.addedBy) }),
                                    ].filter(Boolean).join(' · ')}
                                </span>
                            </span>
                            <button type="button" className={own.entryEdit} onClick={() => setEditingId(task.id)}
                                aria-label={`${t('editTask')}: ${task.name}`} title={t('editTask')}>
                                <Icon name="edit" size={18} />
                            </button>
                        </li>
                    ))}
                </ul>}
            {editing &&
                <TaskEditDialog
                    task={editing}
                    onClose={() => setEditingId(null)}
                    handlers={{
                        save: (changes) => change(updateFamilyTask(family.id, editing.id, changes)),
                        remove: family.isOwner || editing.addedBy?.id === family.me
                            ? () => change(removeFamilyTask(family.id, editing.id))
                            : undefined,
                        subGroups,
                    }}
                />}
            <form className={own.quickAdd} onSubmit={add}>
                <input value={name} maxLength={200} onChange={(e) => setName(e.target.value)}
                    placeholder={t('familyAddEntry')} aria-label={t('familyAddEntry')} />
                <input type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label={t('dueDate')} required />
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label={t('taskTime')} />
                <AssigneeSelect family={family} value={assignee} onChange={setAssignee} />
                <button type="submit" className={styles.primaryBtn} disabled={busy || !name.trim() || !day}>{t('add')}</button>
            </form>
        </section>
    );
}

// Who's in it; the owner removes people, everybody invites their own friends
function Members({ family, onChanged }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const run = useFamilyRun();
    const friends = useSelector(state => state.friends.friends);
    const [inviting, setInviting] = useState(false);
    const [selected, setSelected] = useState([]);
    const [busy, setBusy] = useState(false);
    // removing somebody takes a second click on the same button
    const [confirmId, setConfirmId] = useState(null);

    useEffect(() => { if (inviting) dispatch(fetchFriends()).catch(() => {}); }, [inviting, dispatch]);

    const inFamily = new Set(family.people.map(person => person.user.id));
    const candidates = friends.filter(friend => !inFamily.has(friend.id));
    const presence = useSelector(state => state.presence);
    const isOnline = (person) => person.user.id !== family.me && (presence[person.user.id] ?? person.online ?? false);
    // this week, for those who show their numbers
    const week = new Map((family.week?.people ?? []).map(entry => [entry.userId, entry]));
    const togetherMin = (family.week?.people ?? []).reduce((sum, entry) => sum + entry.focusMin, 0);

    const invite = async () => {
        setBusy(true);
        const changed = await run(inviteToFamily(family.id, selected), 'toast_familyInvited');
        setBusy(false);
        if (changed) {
            onChanged(changed);
            setSelected([]);
            setInviting(false);
        }
    };

    const remove = async (person) => {
        if (confirmId !== person.user.id) { setConfirmId(person.user.id); return; }
        setConfirmId(null);
        if (await run(removeFamilyMember(family.id, person.user.id))) {
            const changed = await run(fetchFamily(family.id));
            if (changed) onChanged(changed);
        }
    };

    return (
        <section className={styles.card}>
            <div className={styles.cardHead}>
                <h2 className={styles.cardTitle}>{t('familyMembers')}</h2>
                {!inviting && <button className={styles.addPersonBtn} onClick={() => setInviting(true)}>+ {t('invite')}</button>}
            </div>
            {togetherMin > 0 &&
                <p className={own.weekLine}>{fill(t('familyWeekTogether'), { time: formatDuration(togetherMin * 60000) })}</p>}
            <ul className={styles.list}>
                {family.people.map(person => {
                    const mine = week.get(person.user.id);
                    return (
                    <li key={person.user.id} className={styles.row}>
                        <Avatar user={{ ...person.user, online: person.online }} presence={person.user.id !== family.me} />
                        <div className={styles.who}>
                            <span className={styles.name}>
                                <Link to={`/u/${person.user.username}`}>{displayName(person.user)}</Link>
                                {person.isOwner && <span className={styles.ownerTag}>{t('owner')}</span>}
                                {person.status === 'invited' && <span className={styles.ownerTag}>{t('invited')}</span>}
                            </span>
                            {(isOnline(person) || mine) &&
                                <span className={own.memberMeta}>
                                    {isOnline(person) && <OnlineLabel />}
                                    {mine && mine.focusMin > 0 && <span>{fill(t('familyWeekFocus'), { time: formatDuration(mine.focusMin * 60000) })}</span>}
                                    {mine && mine.streak > 0 &&
                                        <span className={own.streak} title={fill(t('streakDaysTitle'), { days: mine.streak })}>
                                            <AppIcon name="flame" size={13} />{mine.streak}
                                        </span>}
                                </span>}
                        </div>
                        {family.isOwner && !person.isOwner &&
                            <button className={`${confirmId === person.user.id ? styles.dangerBtn : styles.quietDangerBtn} ${own.memberActions}`}
                                onClick={() => remove(person)} onBlur={() => setConfirmId(null)}
                                aria-label={`${t(person.status === 'invited' ? 'withdrawRequest' : 'removeMember')}: ${displayName(person.user)}`}>
                                {confirmId === person.user.id ? t('confirmRemoveShort') : t(person.status === 'invited' ? 'withdrawRequest' : 'removeMember')}
                            </button>}
                    </li>
                    );
                })}
            </ul>
            {inviting &&
                <div className={own.inviteBox}>
                    {candidates.length > 0
                        ? <FriendPicker friends={candidates} selected={selected} onChange={setSelected} />
                        : <p className={styles.hint}>{t('noFriendsToInvite')} <Link to={friendsPath('add')}>{t('addFriend')}</Link></p>}
                    <div className={styles.formActions}>
                        <button type="button" className={styles.quietBtn} onClick={() => { setInviting(false); setSelected([]); }}>{t('cancel')}</button>
                        <button type="button" className={styles.primaryBtn} disabled={busy || selected.length === 0} onClick={invite}>{t('invite')}</button>
                    </div>
                </div>}
        </section>
    );
}

// The family's chat, newest at the bottom
function FamilyChat({ family }) {
    const { t, language } = useTranslation();
    const locale = language === 'de' ? 'de-DE' : 'en-GB';
    const run = useFamilyRun();
    const now = useNow(true, 30 * 1000);
    const { messages, hasMore, addMessages, loadOlder } = useFamilyChat(family.id);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);

    // follow new messages, unless the reader scrolled up to read older ones
    const listRef = useRef(null);
    const stickToBottom = useRef(true);
    const lastId = messages.at(-1)?.id;
    useEffect(() => {
        const list = listRef.current;
        if (list && stickToBottom.current) list.scrollTop = list.scrollHeight;
    }, [lastId]);
    const onScroll = () => {
        const list = listRef.current;
        stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
    };

    const send = async (e) => {
        e.preventDefault();
        const message = text.trim();
        if (!message) return;
        setSending(true);
        stickToBottom.current = true;
        const sent = await run(sendFamilyMessage(family.id, message));
        setSending(false);
        if (sent) {
            addMessages([sent]);
            setText('');
        }
    };

    return (
        <section className={`${styles.card} ${styles.feedCard} ${styles.feedTall}`}>
            <h2 className={styles.cardTitle}>{t('familyChat')}</h2>
            <ol className={styles.feed} ref={listRef} onScroll={onScroll} aria-live="polite" aria-label={t('familyChat')}>
                {hasMore && <li className={own.loadOlder}><button type="button" className={styles.quietBtn} onClick={loadOlder}>{t('loadOlder')}</button></li>}
                {messages.length === 0 && <li className={styles.emptyLine}>{t('familyChatEmpty')}</li>}
                {messages.map(message => {
                    const mine = message.user?.id === family.me;
                    return (
                        <li key={message.id} className={mine ? styles.messageMine : styles.message}>
                            {!mine && <Avatar user={message.user} small />}
                            <div className={styles.bubble}>
                                {!mine && <span className={styles.bubbleName}>{displayName(message.user)}</span>}
                                <span className={styles.bubbleText}>{message.text}</span>
                                <time className={styles.feedTime} dateTime={message.createdAt}>{formatRelative(message.createdAt, now, locale)}</time>
                            </div>
                        </li>
                    );
                })}
            </ol>
            <form className={styles.chatForm} onSubmit={send}>
                <input value={text} maxLength={MESSAGE_MAX} onChange={(e) => setText(e.target.value)}
                    placeholder={t('familyMessagePlaceholder')} aria-label={t('familyMessagePlaceholder')} />
                <button type="submit" className={styles.primaryBtn} disabled={sending || !text.trim()}>{t('send')}</button>
            </form>
        </section>
    );
}

// Delete (owner) or leave (member), each with a confirmation step
function FamilyActions({ family, onGone }) {
    const { t } = useTranslation();
    const run = useFamilyRun();
    const [confirm, setConfirm] = useState(false);
    const confirmed = async () => {
        setConfirm(false);
        const done = family.isOwner
            ? await run(deleteFamily(family.id), 'toast_familyDeleted')
            : await run(removeFamilyMember(family.id, 'me'), 'toast_familyLeft');
        if (done) onGone();
    };
    return (
        <div className={styles.footerActions}>
            {confirm
                ? <>
                    <span className={styles.confirmText}>{t(family.isOwner ? 'confirmDeleteFamily' : 'confirmLeaveFamily')}</span>
                    <button className={styles.dangerBtn} onClick={confirmed}>{t(family.isOwner ? 'deleteFamily' : 'leaveFamily')}</button>
                    <button onClick={() => setConfirm(false)}>{t('cancel')}</button>
                </>
                : <button className={styles.quietDangerBtn} onClick={() => setConfirm(true)}>{t(family.isOwner ? 'deleteFamily' : 'leaveFamily')}</button>}
        </div>
    );
}

// One family: what's coming up in its calendar, its members and its chat
export default function FamilyPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const id = Number(useParams().id);
    const { family, missing, show } = useFamily(id);
    // sub-groups (experimental, testers): one choice for the calendar entries and the list
    const isTester = useIsTester();
    const run = useFamilyRun();
    const [subGroupPick, setSubGroupPick] = useState(null);

    // who of them has the app open (kept current live afterwards)
    useEffect(() => { if (family) dispatch(rememberPresence(family.people)); }, [family, dispatch]);

    if (missing || !Number.isInteger(id) || id <= 0) {
        return (
            <div className={styles.page}>
                <h1 className={styles.title}>{t('family')}</h1>
                <section className={`${styles.card} ${styles.empty}`}>
                    <p>{t('familyNotFound')}</p>
                    <Link to={COMMUNITY_PATHS.family} className={styles.primaryBtn}>{t('backToFamilies')}</Link>
                </section>
            </div>
        );
    }
    if (!family) return <div className={styles.page} aria-busy="true" />;

    const memberCount = family.people.filter(person => person.status === 'joined').length;
    const subGroups = family.groups ?? [];
    const subGroup = isTester ? shownSubGroup(subGroups, subGroupPick) : null;
    // every change answers with the whole family, which is shown right away
    const changeSubGroups = async (request) => {
        const changed = await run(request);
        if (changed) show(changed);
        return changed;
    };
    return (
        <div className={`${styles.pageWide} ${own.familyPage}`} data-task-color={family.color ?? undefined}>
            <Link to={COMMUNITY_PATHS.family} className={styles.back}>← {t('family')}</Link>
            <div className={`${styles.titleRow} ${own.titleRow}`}>
                <FamilyLooks family={family} onChanged={show} />
                <div className={styles.titleBlock}>
                    <FamilyTitle family={family} onChanged={show} />
                    <p className={styles.meta}>
                        {fill(t('familyFoundedBy'), { name: displayName(family.owner) })} · {memberCount} {t(memberCount === 1 ? 'member' : 'members')}
                    </p>
                </div>
            </div>
            {isTester &&
                <SubGroupBar groups={subGroups} value={subGroup} onChange={setSubGroupPick} counts={openCounts(family.tasks)}
                    onAdd={(name) => changeSubGroups(addFamilySubGroup(family.id, name))}
                    onRemove={(groupId) => changeSubGroups(removeFamilySubGroup(family.id, groupId))} />}
            <div className={styles.roomGrid}>
                <div className={styles.roomMain}>
                    <FamilyBoard family={family} onChanged={show} />
                    <Upcoming family={family} onChanged={show} subGroup={subGroup} subGroups={isTester ? subGroups : undefined} />
                    <FamilyList family={family} onChanged={show} subGroup={subGroup} />
                    <Members family={family} onChanged={show} />
                </div>
                <div className={styles.roomSide}>
                    <FamilyChat family={family} />
                </div>
            </div>
            <FamilyActions family={family} onGone={() => navigate(COMMUNITY_PATHS.family)} />
        </div>
    );
}
