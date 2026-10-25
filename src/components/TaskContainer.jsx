import { useCallback, useState } from 'react'
import styles from './TaskContainer.module.css';
import { Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {deleteTaskAsking, deleteGroup, deleteGroupTasks, editGroup, updateTaskProps, editDisplaygroup, leaveTask, isSharedWithMe} from '../features/tasks/taskAction'
import TaskColorButton from './task/TaskColorButton.jsx'
import TaskRow from './task/TaskRow.jsx'
import ConfirmDeleteButton from './ConfirmDeleteButton.jsx'
import Icon from './icons.jsx'
import { createPortal } from 'react-dom';
import {useTranslation} from '../i18n/useTranslation'
import { fill } from '../features/helperFunction'
import { selectSharedGroups, selectSharedSoloTasks, setSharedTaskDone, togetherErrorText } from '../features/together/togetherAction'
import { showToast } from '../features/toast/toast'
import TaskEditDialog from './task/TaskEditDialog.jsx'
import { AnimatePresence } from 'motion/react'
import { MOTION, useMotionLevel, burstFrom } from '../features/settings/motion'
import { setShowSharedTasks } from '../features/settings/settingsAction'
import { isEvent } from '../features/tasks/kinds'
import { dateKey, minutesOfDay } from '../features/calendar/calendar'
import TodayEvents from './task/TodayEvents.jsx'

// seconds between two rows when the list cascades in
const CASCADE_STEP = { minimal: 0.025, normal: 0.035, extreme: 0.045 };

// The task list on Home: the open tasks of the shown group (or all of them, with the tasks of
// my shared sessions), then, when asked for, the done ones. The task in focus is left out.
export default function TaskContainer(props){
    const { handlePointerDown, draggedTask, dragPosition, dragOffset, setCreateTask, activeTask, releasedIds = [], onActivate } = props;

    // whether the Done list is shown; only this component uses it
    const [showDone, setShowDone] = useState(false);
    // the whole list folded away (the title stays, with the number of open tasks)
    const [collapsed, setCollapsed] = useState(false);

    const {t} = useTranslation();
    const dispatch = useDispatch();
    const motionLevel = useMotionLevel();
    const extreme = motionLevel === 'extreme';
    // rows animate in, out and to a new place, and cascade in one after another when the list
    // appears (gently on "minimal", livelier on "normal", wildly on "extreme")
    const rowMotion = (index = 0) => {
        const preset = MOTION.row[motionLevel];
        const step = CASCADE_STEP[motionLevel];
        return { ...preset, transition: { ...preset.transition, delay: Math.min(index, 12) * step } };
    };
    // a finished task earns confetti on "normal" (a little) and "extreme"
    const celebrate = (e) => {
        if (motionLevel !== 'minimal') burstFrom(e.currentTarget, extreme ? undefined : 12);
    };
    const reportError = () => dispatch(showToast(t('friendError_generic'), 'error'));

    const tasks = useSelector(state => state.task.tasks);
    const groups = useSelector(state => state.task.groups);
    const groupToDisplay = useSelector(state => state.task.groupToDisplay);

    // the task open in the full editor (all options), or null; looked up live so changes show
    const [editTaskId, setEditTaskId] = useState(null);
    const taskInEditor = editTaskId === null ? null : tasks.find(task => task.id === editTaskId);
    const closeEditor = useCallback(() => setEditTaskId(null), []);

    // Tasks from my shared sessions: one group per session, and part of the "all" view.
    // Their time goes to the session; they can't be edited, grouped or deleted here.
    const sharedGroups = useSelector(selectSharedGroups);
    const sharedTasks = useSelector(selectSharedSoloTasks);
    const shownGroup = groupToDisplay.group;
    const showingAll = !shownGroup?.id || shownGroup.name === 'all';
    // they can be taken out of "All" (remembered); the session's own group always shows them
    const showSharedTasks = useSelector(state => state.settings.showSharedTasks);
    const sharedInAll = showSharedTasks ? sharedTasks : [];
    const hiddenSharedCount = showingAll && !showSharedTasks ? sharedTasks.filter(task => !task.done).length : 0;
    const toggleSharedTasks = () => dispatch(setShowSharedTasks(!showSharedTasks));
    // the shown group as stored (one of my own, not "all" or a session's), or undefined
    const shownGroupRow = showingAll || shownGroup?.shared ? undefined : groups.find(g => g.id === shownGroup.id);
    const groupTasks = shownGroup?.shared
        ? (sharedGroups.find(group => group.sessionId === shownGroup.sessionId)?.tasks ?? [])
        : showingAll ? [...groupToDisplay.tasks, ...sharedInAll] : groupToDisplay.tasks;
    // tasks put back from the work area go to the end, in the order they were put back
    const releasedRank = (task) => releasedIds.indexOf(task.id);
    const listTasks = releasedIds.length === 0 ? groupTasks : [
        ...groupTasks.filter(task => releasedRank(task) === -1),
        ...groupTasks.filter(task => releasedRank(task) !== -1).sort((a, b) => releasedRank(a) - releasedRank(b)),
    ];
    // events aren't to-dos: today's show in their own strip above the list, all of them in the calendar
    const todoTasks = listTasks.filter(task => !isEvent(task));
    const openTasks = todoTasks.filter(task => !task.done && task.id !== activeTask?.id);
    const doneTasks = todoTasks.filter(task => task.done && task.id !== activeTask?.id);
    const todayKey = dateKey(new Date());
    const todayEvents = listTasks
        .filter(task => isEvent(task) && dateKey(task.due) === todayKey)
        .sort((a, b) => (minutesOfDay(a.due_time) ?? -1) - (minutesOfDay(b.due_time) ?? -1));

    // a click on a task's label opens that group (or the session's group)
    const openGroup = (group) => {
        const target = group.shared ? sharedGroups.find(g => g.sessionId === group.sessionId) : group;
        if (target) dispatch(editDisplaygroup(target, shownGroup?.id));
    };

    const toggleSharedDone = (task) => {
        dispatch(setSharedTaskDone(task.shared.sessionId, task.shared.taskId, !task.done))
            .catch(err => dispatch(showToast(togetherErrorText(t, err), 'error')));
    };

    const update = (task, changes) => dispatch(updateTaskProps(changes, task)).catch(reportError);

    // my task is deleted; a task a friend shared with me is only left (it stays theirs)
    const handleTaskDelete = (task) => {
        if (isSharedWithMe(task)) {
            dispatch(leaveTask(task))
                .then(() => dispatch(showToast(t('taskLeft'), 'info')))
                .catch(reportError);
            return;
        }
        // a repeating one asks first what goes; cancelled, nothing happens
        dispatch(deleteTaskAsking(task))
            .then((deleted) => { if (deleted) dispatch(showToast(t('taskDeleted'), 'info')); })
            .catch(reportError);
    }

    const [editGroupDescription, setEditGroupDescription] = useState(false);
    const setGroupDescriptionHandler = (description) => {
        dispatch(editGroup(groupToDisplay.group.id, {description: description}, groupToDisplay.group));
        setEditGroupDescription(false);
    }
    const groupDescription = shownGroupRow?.description;

    const inOwnGroup = Boolean(groupToDisplay.group.name) && !showingAll && !shownGroup?.shared;

    // the props of a row, by kind of task
    const rowProps = (task, index) => {
        const base = { task, motionProps: rowMotion(index), onOpenGroup: openGroup };
        if (task.shared) {
            return {
                ...base,
                hidden: draggedTask?.id === task.id,
                onToggleDone: (e) => { if (!task.done) celebrate(e); toggleSharedDone(task); },
                onFocus: task.done ? undefined : () => onActivate?.(task),
                onDragStart: (e) => handlePointerDown(e, task),
            };
        }
        const leaving = isSharedWithMe(task);
        return {
            ...base,
            hidden: draggedTask?.id === task.id,
            onToggleDone: (e) => { if (!task.done) celebrate(e); update(task, { done: !task.done }); },
            onRename: (name) => update(task, { name }),
            onChangeDue: (due) => update(task, { due }),
            onEdit: () => setEditTaskId(task.id),
            onDelete: () => handleTaskDelete(task),
            deleteLabel: t(leaving ? 'leaveTask' : 'deleteTask'),
            onFocus: onActivate ? () => onActivate(task) : undefined,
            onDragStart: (e) => handlePointerDown(e, task),
            onRemoveFromGroup: inOwnGroup ? () => dispatch(deleteGroupTasks(task.id, groupToDisplay.group.id)) : undefined,
        };
    };

    return (
        <section className={styles.section} aria-labelledby="tasks-title" data-part="task-list">
            {taskInEditor && <TaskEditDialog task={taskInEditor} onClose={closeEditor} />}
            <div className={styles.sectionHead}>
                <button className={styles.collapseBtn} onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed}
                    title={t(collapsed ? 'expandTasks' : 'collapseTasks')} aria-label={t(collapsed ? 'expandTasks' : 'collapseTasks')}>
                    <Icon name="chevronDown" className={collapsed ? styles.chevronClosed : styles.chevron} />
                </button>
                <h2 id="tasks-title" className={styles.sectionTitle}>
                    {shownGroup?.name && !showingAll ? shownGroup.name : t('taskContainer')}
                </h2>
                {/* "All" has its count in the page's title row */}
                {!showingAll && <span className={styles.openCount}>{fill(t('openTasksCount'), { count: openTasks.length })}</span>}
                {/* the shown group's colour (one of my own groups) */}
                {shownGroupRow &&
                    <TaskColorButton task={shownGroupRow} label={t('groupColor')}
                        onChange={(color) => dispatch(editGroup(shownGroupRow.id, { color }, shownGroupRow)).catch(reportError)} />}
                {/* the group goes, its tasks stay */}
                {shownGroupRow &&
                    <ConfirmDeleteButton label={`${t('deleteGroup')}: ${shownGroupRow.name}`} title={t('deleteGroup')}
                        onConfirm={() => dispatch(deleteGroup(shownGroupRow.id)).catch(reportError)} />}
                <div className={styles.headActions}>
                    {showingAll && sharedTasks.length > 0 &&
                        <button className={`${styles.sharedToggle} ${showSharedTasks ? '' : styles.sharedToggleOff}`}
                            onClick={toggleSharedTasks} aria-pressed={showSharedTasks}
                            title={t(showSharedTasks ? 'hideSessionTasks' : 'showSessionTasks')}
                            aria-label={t(showSharedTasks ? 'hideSessionTasks' : 'showSessionTasks')}>
                            <Icon name={showSharedTasks ? 'eye' : 'eyeOff'} className={styles.sharedToggleIcon} />
                            <span className={styles.sharedToggleLabel}>{t('sessionTasks')}</span>
                        </button>}
                    {doneTasks.length > 0 && !collapsed &&
                        <button className={`${styles.doneToggle} ${showDone ? styles.doneToggleOn : ''}`}
                            onClick={() => setShowDone(!showDone)} aria-pressed={showDone}>
                            {t('done')}
                            <span className={styles.doneCount}>{doneTasks.length}</span>
                        </button>}
                    <button className={styles.addBtn} onClick={() => setCreateTask(true)}>
                        <Icon name="plus" className={styles.addIcon} strokeWidth={2} />
                        {t('createTaskH2')}
                    </button>
                </div>
            </div>
            {hiddenSharedCount > 0 &&
                <p className={styles.hiddenNote}>
                    {fill(t('sessionTasksHidden'), { count: hiddenSharedCount })}
                    <button className={styles.linkBtn} onClick={toggleSharedTasks}>{t('showAgain')}</button>
                </p>}
            {shownGroup?.shared &&
                <p className={styles.groupNote}>
                    {t('sharedGroupHint')} <Link to={`/together/${shownGroup.sessionId}`}>{t('openSession')} →</Link>
                </p>}
            {groupDescription && (editGroupDescription
                ? <input className={styles.groupDescriptionInput} autoFocus defaultValue={groupDescription} aria-label={t('description')}
                    onBlur={(e) => setGroupDescriptionHandler(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
                : <p className={styles.groupNote} onClick={() => setEditGroupDescription(true)} title={t('description')}>
                    {groupDescription}
                </p>)}

            {!collapsed && <>
                {todayEvents.length > 0 && <TodayEvents events={todayEvents} onOpen={(task) => setEditTaskId(task.id)} />}
                <div className={styles.panel}>
                    {openTasks.length === 0
                        ? <div className={styles.empty}>
                            <p className={styles.emptyTitle}>{t('noOpenTasks')}</p>
                            <p className={styles.emptyText}>{t('noOpenTasksHint')}</p>
                        </div>
                        : <ul className={styles.list} aria-label={t('toDo')}>
                            <AnimatePresence>
                                {openTasks.map((task, index) => <TaskRow key={task.id} {...rowProps(task, index)} />)}
                            </AnimatePresence>
                        </ul>}
                </div>

                {showDone && doneTasks.length > 0 &&
                    <div className={styles.donePanel}>
                        <h3 className={styles.listTitle}>{t('done')}</h3>
                        <ul className={styles.list} aria-label={t('done')}>
                            <AnimatePresence>
                                {doneTasks.map((task, index) => <TaskRow key={task.id} {...rowProps(task, index)} />)}
                            </AnimatePresence>
                        </ul>
                    </div>}
            </>}

            {/* The dragged task follows the pointer. In a portal on document.body, so no
                transformed ancestor turns position: fixed into something else */}
            {draggedTask && createPortal(
                <div className={styles.dragGhost}
                    style={{ left: dragPosition.x - Math.min(dragOffset.x, 24), top: dragPosition.y - Math.min(dragOffset.y, 20) }}>
                    {draggedTask.name}
                </div>,
                document.body
            )}
        </section>
    );
}
