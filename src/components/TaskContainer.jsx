import { useCallback, useState } from 'react'
import styles from './TaskContainer.module.css';
import { Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {deleteTaskAsking, deleteGroup, deleteGroupTasks, editGroup, updateTaskProps, editDisplaygroup, leaveTask, isSharedWithMe, selectTasksLoaded} from '../features/tasks/taskAction'
import TaskColorButton from './task/TaskColorButton.jsx'
import TaskRow, { TaskRowSkeleton } from './task/TaskRow.jsx'
import { Bone, Skeleton } from './skeleton/Skeleton.jsx'
import ConfirmDeleteButton from './ConfirmDeleteButton.jsx'
import Icon from './icons.jsx'
import { createPortal } from 'react-dom';
import {useTranslation} from '../i18n/useTranslation'
import { fill } from '../features/helperFunction'
import { selectSharedGroups, selectSharedSoloTasks, setSharedTaskDone, togetherErrorText, addSessionSubGroup, removeSessionSubGroup } from '../features/together/togetherAction'
import { EDIT_DISPLAYGROUP } from '../features/tasks/taskActionTypes'
import { inSubGroup, openCounts, shownSubGroup } from '../features/tasks/subGroups'
import SubGroupBar from './subgroups/SubGroupBar.jsx'
import { showToast } from '../features/toast/toast'
import TaskEditDialog from './task/TaskEditDialog.jsx'
import { AnimatePresence } from 'motion/react'
import { MOTION, useMotionLevel, burstFrom } from '../features/settings/motion'
import { playSound } from '../features/settings/sound'
import { setShowSharedTasks } from '../features/settings/settingsAction'
import { isEvent } from '../features/tasks/kinds'
import { dateKey, minutesOfDay } from '../features/calendar/calendar'
import TodayEvents from './task/TodayEvents.jsx'
import KindChips from './home/KindChips.jsx'
import { selectCollections, taskIdsIn, updateCollection, deleteCollection, removeFromCollection } from '../features/collections/collections'

// seconds between two rows when the list cascades in
const CASCADE_STEP = { minimal: 0.025, normal: 0.035, extreme: 0.045 };

// The task list on Home: the open tasks of the shown group (or all of them, with the tasks of
// my shared sessions), then, when asked for, the done ones. The task in focus is left out.
// The list's shape while my tasks are on their way: open rows, grey where the tasks will be
function SkeletonPanel() {
    return (
        <Skeleton className={styles.panel}>
            <ul className={styles.list}>
                {[0, 1, 2, 3].map(i => <TaskRowSkeleton key={i} index={i} />)}
            </ul>
        </Skeleton>
    );
}

// The whole section before the app knows it may load anything (the start screen, see AppSkeleton)
export function TaskListSkeleton() {
    const { t } = useTranslation();
    return (
        <section className={styles.section}>
            <div className={styles.sectionHead}>
                <span className={styles.collapseBtn}><Icon name="chevronDown" className={styles.chevron} /></span>
                <h2 className={styles.sectionTitle}>{t('taskContainer')}</h2>
                <div className={styles.headActions}><Bone pill w="9.5rem" h="2.25rem" /></div>
            </div>
            <SkeletonPanel />
        </section>
    );
}

// open tasks shown at first on Home (own look)
const PLAIN_ROWS = 6;

export default function TaskContainer(props){
    const { handlePointerDown, draggedTask, dragPosition, dragOffset, setCreateTask, activeTask, releasedIds = [], onActivate } = props;
    // plain: the app's own Home (today's events are in "Dein Tag" beside it, the list doesn't fold,
    // "5 erledigt" and "Neue Aufgabe" are quiet text buttons; the add button in the corner is the loud one)
    const plain = Boolean(props.plain);
    // Home's labels (Aufgaben, Events, Erinnerungen, Notizen) in the head of "All": the kinds shown; tasks hidden when off
    const { kinds, onToggleKind } = props;
    const tasksOff = Boolean(kinds) && !kinds.includes('tasks');
    // Home's own look shows the first few open tasks, the rest one tap away, so the list stays
    // about as long as the column beside it
    const [expanded, setExpanded] = useState(false);
    // "All": the study plan's later sessions shown too (see plannedStudy)
    const [showPlanned, setShowPlanned] = useState(false);

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
    // a finished task earns its sound, and confetti on "normal" (a little) and "extreme"
    const celebrate = (e) => {
        playSound('done');
        if (motionLevel !== 'minimal') burstFrom(e.currentTarget, extreme ? undefined : 12);
    };
    const reportError = () => dispatch(showToast(t('friendError_generic'), 'error'));

    const tasks = useSelector(state => state.task.tasks);
    const loaded = useSelector(selectTasksLoaded);
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
    // the shown group as stored (one of my own, not "all", a session's or a collection), or undefined
    const shownGroupRow = showingAll || shownGroup?.shared || shownGroup?.collection ? undefined : groups.find(g => g.id === shownGroup.id);
    // testers: a collection in place of a group, its tasks (events among them) found in mine
    const collections = useSelector(selectCollections);
    const shownCollection = shownGroup?.collection ? collections.find(c => c.id === shownGroup.collectionId) : undefined;
    // a session's group: one of its sub-groups can be picked too (kept on the shown group, so
    // the new-task form puts new tasks there too; picking the session's chip again starts at all)
    const shownShared = shownGroup?.shared ? sharedGroups.find(group => group.sessionId === shownGroup.sessionId) : undefined;
    const subGroups = shownShared?.subGroups ?? [];
    const subGroup = shownShared ? shownSubGroup(subGroups, shownGroup.subGroupId ?? null) : null;
    const pickSubGroup = (id) => dispatch({ type: EDIT_DISPLAYGROUP, payload: { group: { ...shownGroup, subGroupId: id }, tasks: [] } });
    const runShared = (action) => dispatch(action).catch(err => {
        dispatch(showToast(togetherErrorText(t, err), 'error'));
        return null;
    });
    const collectionTaskIds = shownCollection ? taskIdsIn(shownCollection) : null;
    const groupTasks = shownGroup?.shared
        ? inSubGroup(shownShared?.tasks ?? [], subGroup)
        : shownGroup?.collection ? tasks.filter(task => collectionTaskIds?.has(task.id))
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
    // The study plan (Lernen) puts many sessions into the list, days ahead. In "All" only today's
    // and overdue ones are rows; the later ones wait behind one row that shows them. A subject's
    // own group (or any other one picked) shows everything.
    const plannedStudy = showingAll ? openTasks.filter(task => task.study && task.due && dateKey(task.due) > todayKey) : [];
    const listedOpen = showPlanned || plannedStudy.length === 0 ? openTasks : openTasks.filter(task => !plannedStudy.includes(task));
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

    // ticked off: for a few seconds it can be taken back from the toast (not a repeating one:
    // ticking it made the next one already)
    const tickOff = (task) => {
        dispatch(updateTaskProps({ done: true }, task))
            .then(() => {
                if (task.repeat) return;
                dispatch(showToast(fill(t('taskDoneToast'), { name: task.name }), 'info', {
                    action: { label: t('toastUndo'), run: () => { playSound('undo'); return update(task, { done: false }); } },
                }));
            })
            .catch(reportError);
    };

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
        if (shownCollection) dispatch(updateCollection(shownCollection.id, { description })).catch(reportError);
        else dispatch(editGroup(groupToDisplay.group.id, {description: description}, groupToDisplay.group));
        setEditGroupDescription(false);
    }
    const groupDescription = shownGroupRow?.description ?? shownCollection?.description;

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
            onToggleDone: (e) => {
                if (task.done) {
                    playSound('undo');
                    return update(task, { done: false });
                }
                celebrate(e);
                tickOff(task);
            },
            onRename: (name) => update(task, { name }),
            onChangeDue: (due) => update(task, { due }),
            onEdit: () => setEditTaskId(task.id),
            onDelete: () => handleTaskDelete(task),
            deleteLabel: t(leaving ? 'leaveTask' : 'deleteTask'),
            onFocus: onActivate ? () => onActivate(task) : undefined,
            onDragStart: (e) => handlePointerDown(e, task),
            onRemoveFromGroup: shownCollection
                ? () => dispatch(removeFromCollection(shownCollection.id, { kind: 'task', id: task.id })).catch(reportError)
                : inOwnGroup ? () => dispatch(deleteGroupTasks(task.id, groupToDisplay.group.id)) : undefined,
            removeLabel: shownCollection ? t('collectionRemoveTask') : undefined,
        };
    };

    return (
        <section className={styles.section} aria-labelledby="tasks-title" data-part="task-list" data-plain={plain || undefined}>
            {taskInEditor && <TaskEditDialog task={taskInEditor} onClose={closeEditor} />}
            <div className={styles.sectionHead}>
                {!plain && <button className={styles.collapseBtn} onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed}
                    title={t(collapsed ? 'expandTasks' : 'collapseTasks')} aria-label={t(collapsed ? 'expandTasks' : 'collapseTasks')}>
                    <Icon name="chevronDown" className={collapsed ? styles.chevronClosed : styles.chevron} />
                </button>}
                {plain && showingAll && !shownCollection && kinds && onToggleKind && <KindChips active={kinds} onToggle={onToggleKind} />}
                <h2 id="tasks-title" className={styles.sectionTitle} hidden={Boolean(plain && showingAll && !shownCollection && kinds && onToggleKind)}>
                    {shownCollection
                        ? `${shownCollection.emoji ? `${shownCollection.emoji} ` : ''}${shownCollection.name}`
                        : shownGroup?.name && !showingAll ? shownGroup.name : t('taskContainer')}
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
                {/* a collection: the same, and its own page (with its events and notes) */}
                {shownCollection && <>
                    <TaskColorButton task={shownCollection} label={t('collectionColor')}
                        onChange={(color) => dispatch(updateCollection(shownCollection.id, { color })).catch(reportError)} />
                    <Link to={`/collections/${shownCollection.id}`} className={styles.openCollection}
                        title={t('collectionOpenPage')} aria-label={`${t('collectionOpenPage')}: ${shownCollection.name}`}>
                        <Icon name="collection" />
                    </Link>
                    <ConfirmDeleteButton label={`${t('collectionDelete')}: ${shownCollection.name}`} title={t('collectionDeleteHint')}
                        onConfirm={() => dispatch(deleteCollection(shownCollection.id)).catch(reportError)} />
                </>}
                <div className={styles.headActions}>
                    {showingAll && sharedTasks.length > 0 &&
                        <button className={`${styles.sharedToggle} ${showSharedTasks ? '' : styles.sharedToggleOff}`}
                            onClick={toggleSharedTasks} aria-pressed={showSharedTasks}
                            title={t(showSharedTasks ? 'hideSessionTasks' : 'showSessionTasks')}
                            aria-label={t(showSharedTasks ? 'hideSessionTasks' : 'showSessionTasks')}>
                            <Icon name={showSharedTasks ? 'eye' : 'eyeOff'} className={styles.sharedToggleIcon} />
                            <span className={styles.sharedToggleLabel}>{t('sessionTasks')}</span>
                        </button>}
                    {doneTasks.length > 0 && !collapsed && (plain
                        ? <button className={`${styles.textBtn} ${showDone ? styles.textBtnOn : ''}`}
                            onClick={() => setShowDone(!showDone)} aria-pressed={showDone}>
                            {fill(t('homeListDone'), { count: doneTasks.length })}
                        </button>
                        : <button className={`${styles.doneToggle} ${showDone ? styles.doneToggleOn : ''}`}
                            onClick={() => setShowDone(!showDone)} aria-pressed={showDone}>
                            {t('done')}
                            <span className={styles.doneCount}>{doneTasks.length}</span>
                        </button>)}
                    {plain
                        ? <button className={styles.textBtn} onClick={() => setCreateTask(true)}>
                            <Icon name="plus" className={styles.addIcon} strokeWidth={2} />
                            {t('homeListAdd')}
                        </button>
                        : <button className={styles.addBtn} onClick={() => setCreateTask(true)}>
                            <Icon name="plus" className={styles.addIcon} strokeWidth={2} />
                            {t('createTaskH2')}
                        </button>}
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
            {shownShared &&
                <SubGroupBar groups={subGroups} value={subGroup} onChange={pickSubGroup}
                    counts={openCounts(shownShared.tasks)}
                    onAdd={(name) => runShared(addSessionSubGroup(shownShared.sessionId, name))}
                    onRemove={(groupId) => runShared(removeSessionSubGroup(shownShared.sessionId, groupId))} />}
            {groupDescription && (editGroupDescription
                ? <input className={styles.groupDescriptionInput} autoFocus defaultValue={groupDescription} aria-label={t('description')}
                    onBlur={(e) => setGroupDescriptionHandler(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
                : <p className={styles.groupNote} onClick={() => setEditGroupDescription(true)} title={t('description')}>
                    {groupDescription}
                </p>)}

            {!collapsed && !tasksOff && <>
                {todayEvents.length > 0 && !plain && <TodayEvents events={todayEvents} onOpen={(task) => setEditTaskId(task.id)} />}
                {!loaded ? <SkeletonPanel /> : <div className={plain ? styles.plainList : styles.panel}>
                    {listedOpen.length === 0 && plannedStudy.length === 0
                        ? <div className={styles.empty}>
                            <p className={styles.emptyTitle}>{t('noOpenTasks')}</p>
                            <p className={styles.emptyText}>{t('noOpenTasksHint')}</p>
                        </div>
                        : <ul className={styles.list} aria-label={t('toDo')} data-scrolls={!plain || expanded || undefined}>
                            <AnimatePresence>
                                {(plain && !expanded ? listedOpen.slice(0, PLAIN_ROWS) : listedOpen)
                                    .map((task, index) => <TaskRow key={task.id} {...rowProps(task, index)} />)}
                            </AnimatePresence>
                        </ul>}
                    {plain && listedOpen.length > PLAIN_ROWS &&
                        <button type="button" className={styles.moreRows} onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
                            {expanded ? t('homeListLess') : fill(t('homeListMore'), { count: listedOpen.length - PLAIN_ROWS })}
                        </button>}
                    {plannedStudy.length > 0 &&
                        <button type="button" className={styles.plannedRow} onClick={() => setShowPlanned(!showPlanned)} aria-expanded={showPlanned}>
                            <Icon name="book" size={16} />
                            <span>{showPlanned ? t('studyPlannedHide') : fill(t(plannedStudy.length === 1 ? 'studyPlannedOne' : 'studyPlannedShow'), { count: plannedStudy.length })}</span>
                        </button>}
                </div>}

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
