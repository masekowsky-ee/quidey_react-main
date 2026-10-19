import styles from '../Together.module.css';
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { formatDuration, displayName } from '../../features/helperFunction';
import { fetchTaskState } from '../../features/tasks/taskAction';
import {
    addSharedTask, setSharedTaskDone, removeSharedTask, assignSharedTask,
} from '../../features/together/togetherAction';
import { selectWork, startWork, stopWork, localMs, useNow } from '../../features/together/work';
import { useTogetherRun } from '../../features/together/hooks';
import Avatar from './Avatar';

const FILTERS = ['all', 'mine', 'free'];

// The session's tasks: add new ones or my own, mark done, assign, and work on them
export default function SharedTaskList({ session, showShareSelect = true }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const run = useTogetherRun();
    const work = useSelector(selectWork);
    const myTasks = useSelector(state => state.task.tasks);
    const now = useNow(Boolean(work.taskId));

    const [newTask, setNewTask] = useState('');
    const [filter, setFilter] = useState('all');
    const [showDone, setShowDone] = useState(false);

    const id = session.id;
    const me = session.me;
    const isOpen = !session.endedAt;
    const members = session.people.filter(p => p.status === 'joined');
    const workingOn = work.sessionId === id ? work.taskId : null;

    const totalOn = (task) => task.totalMs + localMs(work, task.id, now);
    // who works on a task right now: me from my own stopwatch, the others from the server
    const workersOn = (taskId) => session.people.filter(p =>
        p.user.id === me ? workingOn === taskId : p.workingOn === taskId);

    const handleAdd = async (e) => {
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
        if (taskId) run(addSharedTask(id, { taskId }), 'toast_taskShared');
    };

    const handleDone = async (task) => {
        if (!task.done && workingOn === task.id) await dispatch(stopWork());
        if (await run(setSharedTaskDone(id, task.id, !task.done)) && task.sourceTaskId) {
            // it's one of my own tasks, which was marked too
            dispatch(fetchTaskState()).catch(() => {});
        }
    };

    const matches = (task) =>
        filter === 'all' || (filter === 'mine' ? task.assignee?.id === me : !task.assignee);
    const open = session.tasks.filter(task => !task.done && matches(task));
    const done = session.tasks.filter(task => task.done);
    const counts = {
        all: session.tasks.filter(task => !task.done).length,
        mine: session.tasks.filter(task => !task.done && task.assignee?.id === me).length,
        free: session.tasks.filter(task => !task.done && !task.assignee).length,
    };

    const row = (task) => {
        const workers = workersOn(task.id);
        const mine = workingOn === task.id;
        const total = totalOn(task);
        const canRemove = isOpen && total === 0 && (session.isOwner || task.addedBy?.id === me);
        return (
            <li key={task.id} className={`${styles.taskRow} ${task.done ? styles.taskDone : ''} ${mine ? styles.taskMine : ''}`}>
                <input
                    type="checkbox"
                    className={styles.check}
                    checked={task.done}
                    disabled={!isOpen}
                    onChange={() => handleDone(task)}
                    aria-label={`${t('markDone')}: ${task.name}`}
                />
                <div className={styles.who}>
                    <span className={styles.name}>{task.name}</span>
                    {task.description && <span className={styles.desc}>{task.description}</span>}
                    <span className={styles.taskMeta}>
                        {isOpen && !task.done ? (
                            <select
                                className={task.assignee ? styles.assigneeSelectSet : styles.assigneeSelect}
                                value={task.assignee?.id ?? ''}
                                onChange={(e) => run(assignSharedTask(id, task.id, e.target.value ? Number(e.target.value) : null))}
                                aria-label={`${t('assignTo')}: ${task.name}`}
                            >
                                <option value="">{t('unassigned')}</option>
                                {members.map(p => (
                                    <option key={p.user.id} value={p.user.id}>
                                        {p.user.id === me ? `${displayName(p.user)} (${t('you')})` : displayName(p.user)}
                                    </option>
                                ))}
                            </select>
                        ) : task.assignee && <span className={styles.assignedChip}>{displayName(task.assignee)}</span>}
                        {total > 0 && <span className={styles.meta}>{formatDuration(total)}</span>}
                        {task.addedBy && <span className={styles.addedBy}>{t('addedBy')} {displayName(task.addedBy)}</span>}
                    </span>
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
                            ? <button className={styles.secondaryBtn} onClick={() => dispatch(stopWork())}>{t('pause')}</button>
                            : <button className={styles.acceptBtn} onClick={() => dispatch(startWork(session, task))}>{t('workOnThis')}</button>}
                        {canRemove && (
                            <button className={styles.quietBtn} onClick={() => run(removeSharedTask(id, task.id))} aria-label={`${t('taskDeleteBtn')}: ${task.name}`} title={t('taskDeleteBtn')}>✕</button>
                        )}
                    </div>
                )}
            </li>
        );
    };

    return (
        <section className={styles.card}>
            <div className={styles.cardHead}>
                <h2 className={styles.cardTitle}>{t('sharedTasks')}</h2>
                {session.tasks.length > 0 && (
                    <div className={styles.filters} role="group" aria-label={t('filter')}>
                        {FILTERS.map(key => (
                            <button
                                key={key}
                                className={filter === key ? styles.filterOn : styles.filter}
                                aria-pressed={filter === key}
                                onClick={() => setFilter(key)}
                            >
                                {t(`filter_${key}`)} <span className={styles.filterCount}>{counts[key]}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {isOpen && (
                <div className={styles.addTask}>
                    <form className={styles.addRow} onSubmit={handleAdd}>
                        <input
                            value={newTask}
                            maxLength={200}
                            onChange={(e) => setNewTask(e.target.value)}
                            placeholder={t('newSharedTask')}
                            aria-label={t('newSharedTask')}
                        />
                        <button type="submit" className={styles.primaryBtn} disabled={!newTask.trim()}>{t('add')}</button>
                    </form>
                    {showShareSelect && shareable.length > 0 && (
                        <select defaultValue="" onChange={handleShareOwn} aria-label={t('addFromMyTasks')} className={styles.select}>
                            <option value="" disabled>{t('addFromMyTasks')}</option>
                            {shareable.map(task => <option key={task.id} value={task.id}>{task.name}</option>)}
                        </select>
                    )}
                </div>
            )}

            {session.tasks.length === 0 ? <p className={styles.emptyLine}>{t('noSharedTasks')}</p> : (
                <>
                    {open.length === 0
                        ? <p className={styles.emptyLine}>{t(filter === 'all' ? 'allTasksDone' : 'noTasksInFilter')}</p>
                        : <ul className={styles.list}>{open.map(row)}</ul>}
                    {done.length > 0 && (
                        <>
                            <button className={styles.doneToggle} aria-expanded={showDone} onClick={() => setShowDone(v => !v)}>
                                {showDone ? '▾' : '▸'} {t('done')} ({done.length})
                            </button>
                            {showDone && <ul className={styles.list}>{done.map(row)}</ul>}
                        </>
                    )}
                </>
            )}
        </section>
    );
}
