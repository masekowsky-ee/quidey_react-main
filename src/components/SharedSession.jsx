import styles from './Together.module.css';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../i18n/useTranslation';
import { formatClock, formatDate, formatDuration, getInitials, displayName } from '../features/helperFunction';
import { setCustomError } from '../features/settings/settingsAction';
import { fetchFriends } from '../features/friends/friendsAction';
import { fetchTaskState } from '../features/tasks/taskAction';
import {
    fetchSharedSession, inviteToSharedSession, addSharedTask, setSharedTaskDone, removeSharedTask,
    endSharedSession, deleteSharedSession, removeSharedMember, timeOf, togetherErrorText,
} from '../features/together/togetherAction';
import { useSharedStopwatch } from '../features/together/useSharedStopwatch';
import { FriendPicker } from './Together';

// How often the page asks for the others' progress
const POLL_MS = 5 * 1000;

function Avatar({ user, small }) {
    return <span className={small ? styles.avatarSmall : styles.avatar} aria-hidden="true" title={displayName(user)}>{getInitials(displayName(user))}</span>;
}

export default function SharedSession() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const id = Number(useParams().id);

    const stored = useSelector(state => state.together.current);
    const session = stored?.id === id ? stored : null;
    const friends = useSelector(state => state.friends.friends);
    const myTasks = useSelector(state => state.task.tasks);

    const [missing, setMissing] = useState(false);

    // keeps the page current while it's open; a 404 means I'm not (or no longer) in it
    useEffect(() => {
        const load = () => dispatch(fetchSharedSession(id)).catch(err => { if (err.status === 404) setMissing(true); });
        load();
        const interval = setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
        window.addEventListener('focus', load);
        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', load);
        };
    }, [dispatch, id]);

    useEffect(() => {
        dispatch(fetchFriends()).catch(() => {});
    }, [dispatch]);

    const isOpen = Boolean(session && !session.endedAt);
    const stopwatch = useSharedStopwatch(id, isOpen);

    const showError = (err) => dispatch(setCustomError({ bool: true, message: togetherErrorText(t, err) }));
    // true when it worked; failures are shown to the user
    const run = async (action) => {
        try {
            await dispatch(action);
            return true;
        } catch (err) {
            showError(err);
            return false;
        }
    };

    // ---------- forms and confirmations ----------
    const [newTask, setNewTask] = useState('');
    const [invitees, setInvitees] = useState([]);
    const [showInvite, setShowInvite] = useState(false);
    const [confirm, setConfirm] = useState(null); // 'end' | 'delete' | 'leave'

    if (missing && !session) {
        return (
            <div className={styles.page}>
                <h1 className={styles.title}>{t('together')}</h1>
                <section className={`${styles.card} ${styles.empty}`}>
                    <p>{t('sessionNotFound')}</p>
                    <Link to="/together" className={styles.primaryBtn}>{t('backToTogether')}</Link>
                </section>
            </div>
        );
    }
    if (!session) return <div className={styles.page} />;

    const me = session.me;
    const taskById = new Map(session.tasks.map(task => [task.id, task]));

    // server time plus what my stopwatch hasn't delivered yet
    const myTimeOn = (task) => timeOf(task, me) + stopwatch.localMs(task.id);
    const totalOn = (task) => task.totalMs + stopwatch.localMs(task.id);
    const personTotal = (person) => person.user.id === me
        ? person.totalMs + session.tasks.reduce((sum, task) => sum + stopwatch.localMs(task.id), 0)
        : person.totalMs;
    const personTimeOn = (task, userId) => userId === me ? myTimeOn(task) : timeOf(task, userId);

    // who is working on a task right now (me from my own stopwatch, the others from the server)
    const workersOn = (taskId) => session.people.filter(p =>
        p.user.id === me ? stopwatch.workingOn === taskId : p.workingOn === taskId);

    const totalMs = session.people.reduce((sum, p) => sum + personTotal(p), 0);
    const doneCount = session.tasks.filter(task => task.done).length;
    const current = stopwatch.workingOn ? taskById.get(stopwatch.workingOn) : null;

    // ---------- handlers ----------
    const handleAddTask = async (e) => {
        e.preventDefault();
        const name = newTask.trim();
        if (!name) return;
        if (await run(addSharedTask(id, { name }))) setNewTask('');
    };

    const sharedMine = new Set(session.tasks.map(task => task.sourceTaskId).filter(Boolean));
    const shareable = myTasks.filter(task => !task.done && !sharedMine.has(task.id));

    const handleShareOwn = (e) => {
        const taskId = Number(e.target.value);
        e.target.value = '';
        if (taskId) run(addSharedTask(id, { taskId }));
    };

    const handleDone = async (task) => {
        if (!task.done && stopwatch.workingOn === task.id) await stopwatch.stop();
        if (await run(setSharedTaskDone(id, task.id, !task.done)) && task.sourceTaskId) {
            // it's one of my own tasks, which was marked too
            dispatch(fetchTaskState()).catch(() => {});
        }
    };

    const handleInvite = async () => {
        if (await run(inviteToSharedSession(id, invitees))) {
            setInvitees([]);
            setShowInvite(false);
        }
    };

    const handleConfirmed = async () => {
        const action = confirm;
        setConfirm(null);
        await stopwatch.stop();
        if (action === 'end') {
            run(endSharedSession(id));
        } else if (action === 'delete') {
            if (await run(deleteSharedSession(id))) navigate('/together');
        } else if (action === 'leave') {
            if (await run(removeSharedMember(id, me, me))) navigate('/together');
        }
    };

    const invitable = friends.filter(f => !session.people.some(p => p.user.id === f.id && p.status !== 'left'));
    const contributors = session.people
        .map(person => ({ ...person, total: personTotal(person) }))
        .filter(person => person.total > 0)
        .sort((a, b) => b.total - a.total);

    return (
        <div className={styles.page}>
            <Link to="/together" className={styles.back}>← {t('together')}</Link>
            <div className={styles.titleRow}>
                <div>
                    <h1 className={styles.title}>{session.name}</h1>
                    <p className={styles.meta}>
                        {t('startedBy')} {displayName(session.owner)} · {formatDate(session.createdAt)}
                        {session.endedAt && ` · ${t('endedOn')} ${formatDate(session.endedAt)}`}
                    </p>
                </div>
                {session.endedAt && <span className={styles.endedBadge}>{t('ended')}</span>}
            </div>

            <div className={styles.stats}>
                <div className={styles.stat}>
                    <span className={styles.statValue}>{formatDuration(totalMs)}</span>
                    <span className={styles.statLabel}>{t('togetherTime')}</span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.statValue}>{doneCount}/{session.tasks.length}</span>
                    <span className={styles.statLabel}>{t('tasksDone')}</span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.statValue}>{session.people.filter(p => p.status === 'joined').length}</span>
                    <span className={styles.statLabel}>{t('members')}</span>
                </div>
            </div>

            {isOpen && (
                <section className={`${styles.card} ${current ? styles.workingCard : ''}`} aria-live="polite">
                    <h2 className={styles.cardTitle}>{t('myWork')}</h2>
                    {current ? (
                        <div className={styles.workRow}>
                            <div className={styles.who}>
                                <span className={styles.name}>{current.name}</span>
                                <span className={styles.meta}>{t('workingOnIt')}</span>
                            </div>
                            <span className={styles.clock}>{formatClock(myTimeOn(current))}</span>
                            <button className={styles.secondaryBtn} onClick={() => stopwatch.stop()}>{t('pause')}</button>
                        </div>
                    ) : <p className={styles.emptyLine}>{t('pickTaskHint')}</p>}
                </section>
            )}

            <section className={styles.card}>
                <h2 className={styles.cardTitle}>{t('taskContainer')}</h2>
                {isOpen && (
                    <div className={styles.addTask}>
                        <form className={styles.addRow} onSubmit={handleAddTask}>
                            <input
                                value={newTask}
                                maxLength={200}
                                onChange={(e) => setNewTask(e.target.value)}
                                placeholder={t('newSharedTask')}
                                aria-label={t('newSharedTask')}
                            />
                            <button type="submit" className={styles.primaryBtn} disabled={!newTask.trim()}>{t('add')}</button>
                        </form>
                        {shareable.length > 0 && (
                            <select defaultValue="" onChange={handleShareOwn} aria-label={t('addFromMyTasks')} className={styles.select}>
                                <option value="" disabled>{t('addFromMyTasks')}</option>
                                {shareable.map(task => <option key={task.id} value={task.id}>{task.name}</option>)}
                            </select>
                        )}
                    </div>
                )}

                {session.tasks.length === 0 ? <p className={styles.emptyLine}>{t('noSharedTasks')}</p> : (
                    <ul className={styles.list}>
                        {[...session.tasks].sort((a, b) => a.done - b.done).map(task => {
                            const workers = workersOn(task.id);
                            const mine = stopwatch.workingOn === task.id;
                            const canRemove = isOpen && totalOn(task) === 0 && (session.isOwner || task.addedBy?.id === me);
                            return (
                                <li key={task.id} className={`${styles.taskRow} ${task.done ? styles.taskDone : ''} ${mine ? styles.taskMine : ''}`}>
                                    <input
                                        type="checkbox"
                                        className={styles.check}
                                        checked={task.done}
                                        disabled={!isOpen}
                                        onChange={() => handleDone(task)}
                                        aria-label={t('markDone')}
                                    />
                                    <div className={styles.who}>
                                        <span className={styles.name}>{task.name}</span>
                                        <span className={styles.meta}>
                                            {task.addedBy && `${t('addedBy')} ${displayName(task.addedBy)}`}
                                            {totalOn(task) > 0 && ` · ${formatDuration(totalOn(task))}`}
                                        </span>
                                        {task.description && <span className={styles.desc}>{task.description}</span>}
                                    </div>
                                    {workers.length > 0 && (
                                        <span className={styles.workers} title={workers.map(p => displayName(p.user)).join(', ')}>
                                            <span className={styles.liveDot} />
                                            {workers.map(p => <Avatar key={p.user.id} user={p.user} small />)}
                                        </span>
                                    )}
                                    {isOpen && !task.done && (
                                        <div className={styles.actions}>
                                            {mine
                                                ? <button className={styles.secondaryBtn} onClick={() => stopwatch.stop()}>{t('pause')}</button>
                                                : <button className={styles.acceptBtn} onClick={() => stopwatch.start(task.id)}>{t('workOnThis')}</button>}
                                            {canRemove && (
                                                <button className={styles.quietBtn} onClick={() => run(removeSharedTask(id, task.id))} aria-label={t('taskDeleteBtn')}>✕</button>
                                            )}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            <section className={styles.card}>
                <h2 className={styles.cardTitle}>{t('whoWorkedOnWhat')}</h2>
                {contributors.length === 0 ? <p className={styles.emptyLine}>{t('noTimeYet')}</p> : (
                    <ul className={styles.summary}>
                        {contributors.map(person => {
                            const perTask = session.tasks
                                .map(task => ({ task, ms: personTimeOn(task, person.user.id) }))
                                .filter(entry => entry.ms > 0)
                                .sort((a, b) => b.ms - a.ms);
                            return (
                                <li key={person.user.id} className={styles.summaryPerson}>
                                    <div className={styles.summaryHead}>
                                        <Avatar user={person.user} />
                                        <span className={styles.name}>
                                            {displayName(person.user)}{person.user.id === me && ` (${t('you')})`}
                                            {person.status === 'left' && <span className={styles.meta}> · {t('leftSession')}</span>}
                                        </span>
                                        <span className={styles.timeMain}>{formatDuration(person.total)}</span>
                                    </div>
                                    {/* share of the whole session's time */}
                                    <div className={styles.shareBar} aria-hidden="true">
                                        <div style={{ width: `${totalMs ? person.total / totalMs * 100 : 0}%` }} />
                                    </div>
                                    <ul className={styles.breakdown}>
                                        {perTask.map(({ task, ms }) => (
                                            <li key={task.id}>
                                                <span className={styles.breakdownName}>{task.name}</span>
                                                <span className={styles.breakdownTime}>{formatDuration(ms)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            <section className={styles.card}>
                <h2 className={styles.cardTitle}>{t('members')}</h2>
                <ul className={styles.list}>
                    {session.people.filter(p => p.status !== 'left').map(person => {
                        const task = person.user.id === me ? current : taskById.get(person.workingOn);
                        return (
                            <li key={person.user.id} className={styles.row}>
                                <Avatar user={person.user} />
                                <div className={styles.who}>
                                    <span className={styles.name}>
                                        {displayName(person.user)}{person.user.id === me && ` (${t('you')})`}
                                    </span>
                                    <span className={styles.meta}>
                                        @{person.user.username}
                                        {person.isOwner && ` · ${t('owner')}`}
                                        {person.status === 'invited' && ` · ${t('invited')}`}
                                    </span>
                                </div>
                                {task && <span className={styles.live}><span className={styles.liveDot} />{task.name}</span>}
                                {isOpen && session.isOwner && !person.isOwner && (
                                    <div className={styles.actions}>
                                        <button className={styles.quietBtn} onClick={() => run(removeSharedMember(id, person.user.id, me))}>
                                            {t(person.status === 'invited' ? 'withdrawRequest' : 'removeFriend')}
                                        </button>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
                {isOpen && invitable.length > 0 && (showInvite ? (
                    <div className={styles.invite}>
                        <FriendPicker friends={invitable} selected={invitees} onChange={setInvitees} />
                        <div className={styles.formActions}>
                            <button className={styles.quietBtn} onClick={() => { setShowInvite(false); setInvitees([]); }}>{t('cancel')}</button>
                            <button className={styles.primaryBtn} disabled={invitees.length === 0} onClick={handleInvite}>{t('invite')}</button>
                        </div>
                    </div>
                ) : (
                    <div className={styles.formActions}>
                        <button className={styles.secondaryBtn} onClick={() => setShowInvite(true)}>{t('inviteFriends')}</button>
                    </div>
                ))}
            </section>

            <div className={styles.footerActions}>
                {confirm ? (
                    <>
                        <span className={styles.confirmText}>{t({ end: 'confirmEndSession', delete: 'confirmDeleteSession', leave: 'confirmLeaveSession' }[confirm])}</span>
                        <button className={styles.dangerBtn} onClick={handleConfirmed}>
                            {t({ end: 'endSession', delete: 'deleteSession', leave: 'leaveSession' }[confirm])}
                        </button>
                        <button onClick={() => setConfirm(null)}>{t('cancel')}</button>
                    </>
                ) : session.isOwner ? (
                    <>
                        {isOpen && <button className={styles.secondaryBtn} onClick={() => setConfirm('end')}>{t('endSession')}</button>}
                        <button className={styles.quietDangerBtn} onClick={() => setConfirm('delete')}>{t('deleteSession')}</button>
                    </>
                ) : (
                    <button className={styles.quietDangerBtn} onClick={() => setConfirm('leave')}>{t('leaveSession')}</button>
                )}
            </div>
        </div>
    );
}
