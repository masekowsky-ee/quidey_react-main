import styles from '../Together.module.css';
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { formatDuration, displayName, formatDate, toInputDate } from '../../features/helperFunction';
import { isEvent } from '../../features/tasks/kinds';
import { fetchTaskState } from '../../features/tasks/taskAction';
import {
    addSharedTask, setSharedTaskDone, removeSharedTask, assignSharedTask, addSessionSubGroup, removeSessionSubGroup,
} from '../../features/together/togetherAction';
import { createdText } from '../../features/tasks/created';
import { inSubGroup, openCounts, shownSubGroup } from '../../features/tasks/subGroups';
import SubGroupBar from '../subgroups/SubGroupBar.jsx';
import { selectWork, startWork, stopWork, localMs, othersRunningMs, othersWorking, useNow } from '../../features/together/work';
import { useTogetherRun } from '../../features/together/hooks';
import { taskColorAttr } from '../../features/tasks/taskColors';
import Avatar from './Avatar';
import TaskMeta from '../task/TaskMeta.jsx';
import TaskEditDialog from '../task/TaskEditDialog.jsx';
import Icon from '../calendar/icons.jsx';

const FILTERS = ['all', 'mine', 'free'];

// The session's tasks and events: add new ones or my own, mark tasks done, assign, edit their
// details (day, time, priority, colour, ... all optional) and work on them. An event needs a day
// and is done once it's over (the server ticks it off); nobody works on it or is assigned to it.
// Testers also sort them into sub-groups (experimental): a row of chips filters the list, and
// what is added while one is shown goes into it.
export default function SharedTaskList({ session, showShareSelect = true }) {
    const { t, language } = useTranslation();
    const dispatch = useDispatch();
    const run = useTogetherRun();
    const work = useSelector(selectWork);
    const myTasks = useSelector(state => state.task.tasks);
    const myUsername = useSelector(state => state.auth.user?.username);
    const now = useNow(Boolean(work.taskId) || othersWorking(session));
    const subGroups = session.groups ?? [];
    const [subGroupPick, setSubGroupPick] = useState(null);
    const subGroup = shownSubGroup(subGroups, subGroupPick);
    const intoSubGroup = subGroup ? { group_id: subGroup } : {};

    const [newTask, setNewTask] = useState('');
    // what the field adds: a task, or an event on a day (today unless another is picked)
    const [newKind, setNewKind] = useState('task');
    const [newDay, setNewDay] = useState(() => toInputDate(new Date()));
    const [newTime, setNewTime] = useState('');
    // "add one of my tasks" stays a quiet link until it's wanted
    const [pickOwn, setPickOwn] = useState(false);
    const [filter, setFilter] = useState('all');
    const [showDone, setShowDone] = useState(false);
    // the dialog shows the task as the session has it now (it may change while open)
    const [editTaskId, setEditTaskId] = useState(null);

    const id = session.id;
    const me = session.me;
    const isOpen = !session.endedAt;
    const members = session.people.filter(p => p.status === 'joined');
    const workingOn = work.sessionId === id ? work.taskId : null;

    const totalOn = (task) => task.totalMs + localMs(work, task.id, now)
        + session.people.reduce((sum, p) => sum + othersRunningMs(session, p.user.id, task.id, now), 0);
    // who works on a task right now: me from my own stopwatch, the others from the server
    const workersOn = (taskId) => session.people.filter(p =>
        p.user.id === me ? workingOn === taskId : p.workingOn === taskId);

    const handleAdd = async (e) => {
        e.preventDefault();
        const name = newTask.trim();
        if (!name) return;
        const fields = newKind === 'event'
            ? { name, kind: 'event', due: newDay || toInputDate(new Date()), ...(newTime ? { due_time: newTime } : {}), ...intoSubGroup }
            : { name, ...intoSubGroup };
        if (await run(addSharedTask(id, fields))) {
            setNewTask('');
            setNewTime('');
        }
    };

    const sharedMine = new Set(session.tasks.map(task => task.sourceTaskId).filter(Boolean));
    const shareable = myTasks.filter(task => !task.done && !sharedMine.has(task.id));
    const handleShareOwn = (e) => {
        const taskId = Number(e.target.value);
        e.target.value = '';
        setPickOwn(false);
        if (taskId) run(addSharedTask(id, { taskId, ...intoSubGroup }), 'toast_taskShared');
    };

    const handleDone = async (task) => {
        if (!task.done && workingOn === task.id) await dispatch(stopWork());
        if (await run(setSharedTaskDone(id, task.id, !task.done)) && task.sourceTaskId) {
            // it's one of my own tasks, which was marked too
            dispatch(fetchTaskState()).catch(() => {});
        }
    };

    // events belong to everybody: they stay in every filter
    const matches = (task) =>
        filter === 'all' || isEvent(task) || (filter === 'mine' ? task.assignee?.id === me : !task.assignee);
    const shownTasks = inSubGroup(session.tasks, subGroup);
    const open = shownTasks.filter(task => !task.done && matches(task));
    const done = shownTasks.filter(task => task.done);
    const counts = {
        all: shownTasks.filter(task => !task.done).length,
        mine: shownTasks.filter(task => !task.done && task.assignee?.id === me).length,
        free: shownTasks.filter(task => !task.done && !task.assignee).length,
    };

    const canRemove = (task) => isOpen && totalOn(task) === 0 && (session.isOwner || task.addedBy?.id === me);
    const taskInEditor = isOpen && editTaskId !== null ? session.tasks.find(task => task.id === editTaskId) : null;

    const row = (task) => {
        const workers = workersOn(task.id);
        const mine = workingOn === task.id;
        const total = totalOn(task);
        const event = isEvent(task);
        return (
            <li key={task.id} className={`${styles.taskRow} ${task.done ? styles.taskDone : ''} ${mine ? styles.taskMine : ''} ${event ? styles.taskEvent : ''}`}
                data-task-color={taskColorAttr(task)} title={createdText(task, t, language, myUsername) || undefined}>
                {/* an event isn't ticked off: it's done once it's over */}
                {event
                    ? <span className={styles.eventMark} title={t(task.done ? 'eventOver' : 'kind_event')}>
                        <Icon name="calendar" size={18} />
                    </span>
                    : <input
                        type="checkbox"
                        className={styles.check}
                        checked={task.done}
                        disabled={!isOpen}
                        onChange={() => handleDone(task)}
                        aria-label={`${t('markDone')}: ${task.name}`}
                    />}
                <div className={styles.who}>
                    <span className={styles.name}>{task.name}</span>
                    {task.description && <span className={styles.desc}>{task.description}</span>}
                    {(task.due || task.duration_minutes || task.location || task.link) && (
                        <span className={styles.taskMeta}>
                            {task.due && <span className={styles.meta}>{formatDate(task.due)}</span>}
                            <TaskMeta task={task} />
                        </span>
                    )}
                    <span className={styles.taskMeta}>
                        {isOpen && !task.done && !event ? (
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
                        {!event && (mine
                            ? <button className={styles.secondaryBtn} onClick={() => dispatch(stopWork())}>{t('pause')}</button>
                            : <button className={styles.acceptBtn} onClick={() => dispatch(startWork(session, task))}>{t('workOnThis')}</button>)}
                        <button className={styles.quietBtn} onClick={() => setEditTaskId(task.id)} aria-label={`${t('editTask')}: ${task.name}`} title={t('editTask')}>
                            <Icon name="edit" size={18} />
                        </button>
                        {canRemove(task) && (
                            <button className={styles.quietBtn} onClick={() => run(removeSharedTask(id, task.id))} aria-label={`${t('taskDeleteBtn')}: ${task.name}`} title={t('taskDeleteBtn')}><Icon name="close" size={18} /></button>
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

            {(isOpen || subGroups.length > 0) && (
                <SubGroupBar groups={subGroups} value={subGroup} onChange={setSubGroupPick}
                    counts={openCounts(session.tasks)}
                    onAdd={isOpen ? (name) => run(addSessionSubGroup(id, name)) : undefined}
                    onRemove={isOpen ? (groupId) => run(removeSessionSubGroup(id, groupId)) : undefined} />
            )}

            {isOpen && (
                <div className={styles.addTask}>
                    <form className={styles.addRow} onSubmit={handleAdd}>
                        <div className={styles.kindToggle} role="radiogroup" aria-label={t('kindLegend')}>
                            {['task', 'event'].map(kind => (
                                <button key={kind} type="button" role="radio" aria-checked={newKind === kind}
                                    className={newKind === kind ? styles.kindOn : undefined} onClick={() => setNewKind(kind)}>
                                    {t(`kind_${kind}`)}
                                </button>
                            ))}
                        </div>
                        <input
                            value={newTask}
                            maxLength={200}
                            onChange={(e) => setNewTask(e.target.value)}
                            placeholder={t(newKind === 'event' ? 'newSharedEvent' : 'newSharedTask')}
                            aria-label={t(newKind === 'event' ? 'newSharedEvent' : 'newSharedTask')}
                        />
                        {newKind === 'event' && <>
                            <input type="date" className={styles.dayInput} value={newDay} required
                                onChange={(e) => setNewDay(e.target.value)} aria-label={t('eventDay')} />
                            <input type="time" className={styles.timeInput} value={newTime}
                                onChange={(e) => setNewTime(e.target.value)} aria-label={`${t('eventStart')} (${t('allDay')}: –)`} title={t('eventStart')} />
                        </>}
                        <button type="submit" className={styles.primaryBtn} disabled={!newTask.trim()}>{t('add')}</button>
                    </form>
                    {showShareSelect && shareable.length > 0 && (pickOwn
                        ? <select autoFocus defaultValue="" onChange={handleShareOwn} onBlur={() => setPickOwn(false)}
                            aria-label={t('addFromMyTasks')} className={styles.select}>
                            <option value="" disabled>{t('addFromMyTasks')}</option>
                            {shareable.map(task => <option key={task.id} value={task.id}>{task.name}</option>)}
                        </select>
                        : <button type="button" className={styles.linkAction} onClick={() => setPickOwn(true)}>
                            <Icon name="add" size={16} /> {t('shareOwnTask')}
                        </button>
                    )}
                </div>
            )}

            {session.tasks.length === 0 ? <p className={styles.emptyLine}>{t('noSharedTasks')}</p> : (
                <>
                    {open.length === 0
                        ? <p className={styles.emptyLine}>{t(filter === 'all' ? 'allTasksDone' : 'noTasksInFilter')}</p>
                        : <ul className={styles.scrollList}>{open.map(row)}</ul>}
                    {done.length > 0 && (
                        <>
                            <button className={styles.doneToggle} aria-expanded={showDone} onClick={() => setShowDone(v => !v)}>
                                <span className={`${styles.doneChevron} ${showDone ? styles.doneChevronOpen : ''}`} aria-hidden="true"><Icon name="next" size={16} /></span> {t('done')} ({done.length})
                            </button>
                            {showDone && <ul className={styles.scrollList}>{done.map(row)}</ul>}
                        </>
                    )}
                </>
            )}
            {taskInEditor && (
                <TaskEditDialog
                    task={taskInEditor}
                    shared={{ sessionId: id, canRemove: canRemove(taskInEditor), subGroups }}
                    onClose={() => setEditTaskId(null)}
                />
            )}
        </section>
    );
}
