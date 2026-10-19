import { useState } from 'react'
import styles from './TaskContainer.module.css';
import { Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {deleteTask, deleteGroupTasks, editGroup, updateTaskProps, editDisplaygroup, leaveTask, isSharedWithMe} from '../features/tasks/taskAction'
import TaskMeta from './task/TaskMeta.jsx'
import { createPortal } from 'react-dom';
import {useTranslation} from '../i18n/useTranslation'
import { formatDate, toInputDate, formatDuration, isOverdue } from '../features/helperFunction'
import { selectSharedGroups, selectSharedSoloTasks, setSharedTaskDone, togetherErrorText } from '../features/together/togetherAction'
import { showToast } from '../features/toast/toast'
import GroupPicker from './GroupPicker.jsx'
import TaskLabels from './TaskLabels.jsx'

export default function TaskContainer(props){
    const { working, handlePointerDown, draggedTask, dragPosition, dragOffset, setCreateTask, activeTask } = props;

    // whether the Done list is shown; only this component uses it
    const [showDone, setShowDone] = useState(false);
    
    const {t} = useTranslation();
    const dispatch = useDispatch();

    const tasks = useSelector(state => state.task.tasks);
    const groups = useSelector(state => state.task.groups);
    const groupToDisplay = useSelector(state => state.task.groupToDisplay);

    // the task whose groups are being picked (dialog open), or null
    const [taskToAssign, setTaskToAssign] = useState(null);

    // Tasks from my shared sessions: one group per session, and part of the "all" view.
    // Their time goes to the session; they can't be edited, grouped or deleted here.
    const sharedGroups = useSelector(selectSharedGroups);
    const sharedTasks = useSelector(selectSharedSoloTasks);
    const shownGroup = groupToDisplay.group;
    const showingAll = !shownGroup?.id || shownGroup.name === 'all';
    const listTasks = shownGroup?.shared
        ? (sharedGroups.find(group => group.sessionId === shownGroup.sessionId)?.tasks ?? [])
        : showingAll ? [...groupToDisplay.tasks, ...sharedTasks] : groupToDisplay.tasks;

    // a click on a task's label opens that group (or the session's group)
    const openGroup = (group) => {
        const target = group.shared ? sharedGroups.find(g => g.sessionId === group.sessionId) : group;
        if (target) dispatch(editDisplaygroup(target, shownGroup?.id));
    };

    const toggleSharedDone = (task) => {
        dispatch(setSharedTaskDone(task.shared.sessionId, task.shared.taskId, !task.done))
            .catch(err => dispatch(showToast(togetherErrorText(t, err), 'error')));
    };
    const [taskToEdit, setTaskToEdit] = useState(null);
    const [editGroupDescription, setEditGroupDescription] = useState(false);

    // my task is deleted; a task a friend shared with me is only left (it stays theirs)
    const handleTaskDelete = (taskId) => {
        const task = tasks.find(t => t.id === taskId);
        if (task && isSharedWithMe(task)) {
            dispatch(leaveTask(task))
                .then(() => dispatch(showToast(t('taskLeft'), 'info')))
                .catch(() => dispatch(showToast(t('friendError_generic'), 'error')));
            return;
        }
        dispatch(deleteTask(taskId));
    }

    const [taskPropToEdit, setTaskPropToEdit] = useState(null);

    const changePropHandler = (event, taskProp, taskId) => {
        setTaskToEdit(tasks.find(t => t.id === taskId));
        setTaskPropToEdit(taskProp);
    }

    const setTaskPropHandler = (input, propToEdit, task) => {
        switch(propToEdit){
            case 'name': 
                dispatch(updateTaskProps({name: input}, task));
                break;
            case 'description':
                dispatch(updateTaskProps({description: input}, task));
                break;
            case 'due':
                dispatch(updateTaskProps({due: input}, task));
                break;
            case 'done':
                dispatch(updateTaskProps({done: input}, task));
                break;
            case 'prio':
                // An empty field would send "" to the integer column
                if (input !== '') dispatch(updateTaskProps({prio: Number(input)}, task));
                break;
        }
        setTaskToEdit(null);
        setTaskPropToEdit(null);
    }

    const handleAssignGroup = (task) => {
        setTaskToAssign(task);
    }

    const setGroupDescriptionHandler = (description) => {
        dispatch(editGroup(groupToDisplay.group.id, {description: description}, groupToDisplay.group));
        setEditGroupDescription(false);
    }

    const handleShowDone = () => {
        setShowDone(!showDone);
    }

    const doneCount = listTasks.filter(task => task.done === true).length;

    const handleTaskRemove = (taskId) => {
        dispatch(deleteGroupTasks(taskId, groupToDisplay.group.id))
    }

    return (
        <div>
            {taskToAssign && <GroupPicker task={taskToAssign} onClose={() => setTaskToAssign(null)} />}
            <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>{t('taskContainer')}</h2>
                <button className={styles.addBtn} onClick={()=>{setCreateTask(true)}} title={t('createTaskH2')} aria-label={t('createTaskH2')}>
                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M440-440H240q-17 0-28.5-11.5T200-480q0-17 11.5-28.5T240-520h200v-200q0-17 11.5-28.5T480-760q17 0 28.5 11.5T520-720v200h200q17 0 28.5 11.5T760-480q0 17-11.5 28.5T720-440H520v200q0 17-11.5 28.5T480-200q-17 0-28.5-11.5T440-240v-200Z"/></svg>
                </button>
                {doneCount > 0 &&
                    <button
                        className={`${styles.doneToggle} ${showDone ? styles.doneToggleOn : ''}`}
                        onClick={handleShowDone}
                        aria-pressed={showDone}
                    >
                        {t('done')}
                        <span className={styles.doneCount}>{doneCount}</span>
                    </button>
                }
            </div>
            {shownGroup?.shared &&
            <p className={styles.sharedGroupHint}>
                {t('sharedGroupHint')} <Link to={`/together/${shownGroup.sessionId}`}>{t('openSession')} →</Link>
            </p>
            }
            {!groupToDisplay ? null : !shownGroup?.shared && groupToDisplay.group?.description &&
            <div className={styles.groupDescriptionDiv}>
                {editGroupDescription ?
                    <input type="text" id="groupDescriptionInput" defaultValue={groups.find(g => g.id === groupToDisplay.group.id).description} onBlur={(e) => {setGroupDescriptionHandler(e.target.value);}} />
                    :
                    <p onClick={() => {setEditGroupDescription(true); document.getElementById('groupDescriptionInput')?.focus();}}>
                        {groups.find(g => g.id === groupToDisplay.group.id).description}
                    </p>
                }
            </div>
            }
            <div className={styles.outerUlDiv}>
                <div className={styles.ulDiv}>
                    <ul className={styles.ul}>
                        <h3 className={styles.ulH3}>{t('toDo')}</h3>
                    {listTasks.find(task => task.done !== true) && listTasks
                            .map((task) => {
                                // Check if this specific task is the one currently being dragged
                                const isBeingDragged = draggedTask?.id === task.id;

                                if(!task.done && task.id !== activeTask?.id && task.shared){
                                    // from a shared session: same cells as an own task, but read-only
                                    return (
                                        <li
                                            key={`${task.id}li`}
                                            className={`${styles.taskLi} ${styles.sharedLi}`}
                                            style={isBeingDragged ? { visibility: 'hidden' } : null}
                                        >
                                            <svg onPointerDown={(e) => handlePointerDown(e, task)} className={styles.dragSvg} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor" style={{ touchAction: "none" }}><path d="M360-160q-33 0-56.5-23.5T280-240q0-33 23.5-56.5T360-320q33 0 56.5 23.5T440-240q0 33-23.5 56.5T360-160Zm240 0q-33 0-56.5-23.5T520-240q0-33 23.5-56.5T600-320q33 0 56.5 23.5T680-240q0 33-23.5 56.5T600-160ZM360-400q-33 0-56.5-23.5T280-480q0-33 23.5-56.5T360-560q33 0 56.5 23.5T440-480q0 33-23.5 56.5T360-400Zm240 0q-33 0-56.5-23.5T520-480q0-33 23.5-56.5T600-560q33 0 56.5 23.5T680-480q0 33-23.5 56.5T600-400ZM360-640q-33 0-56.5-23.5T280-720q0-33 23.5-56.5T360-800q33 0 56.5 23.5T440-720q0 33-23.5 56.5T360-640Zm240 0q-33 0-56.5-23.5T520-720q0-33 23.5-56.5T600-800q33 0 56.5 23.5T680-720q0 33-23.5 56.5T600-640Z"/></svg>
                                            <div className={styles.taskHeader}>
                                                <p>{task.name}</p>
                                                <TaskLabels task={task} onOpenGroup={openGroup} />
                                            </div>
                                            <button onClick={() => toggleSharedDone(task)} title={t('markDone')} aria-label={`${t('markDone')}: ${task.name}`}>
                                                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="m382-354 339-339q12-12 28-12t28 12q12 12 12 28.5T777-636L410-268q-12 12-28 12t-28-12L182-440q-12-12-11.5-28.5T183-497q12-12 28.5-12t28.5 12l142 143Z"/></svg>
                                            </button>
                                            <p className={styles.sharedTime} title={t('myTimeInSession')}>{task.myMs > 0 ? formatDuration(task.myMs) : ''}</p>
                                            <div className={styles.prioDiv} />
                                            <p className={styles.sharedDesc}>{task.description || ''}</p>
                                            <div className={styles.btnDiv}>
                                                <Link to={`/together/${task.shared.sessionId}`} className={styles.assignBtn}>{t('openSession')}</Link>
                                            </div>
                                        </li>
                                    )
                                }
                                if(!task.done && task.id !== activeTask?.id){
                                    return (
                                        <li
                                            key={`${task.id}li`}
                                            className={styles.taskLi}
                                            style={isBeingDragged ? { visibility: 'hidden' } : null}
                                        >
                                            <svg onPointerDown={(e) => handlePointerDown(e, task)} className={styles.dragSvg} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor" style={{ touchAction: "none" }}><path d="M360-160q-33 0-56.5-23.5T280-240q0-33 23.5-56.5T360-320q33 0 56.5 23.5T440-240q0 33-23.5 56.5T360-160Zm240 0q-33 0-56.5-23.5T520-240q0-33 23.5-56.5T600-320q33 0 56.5 23.5T680-240q0 33-23.5 56.5T600-160ZM360-400q-33 0-56.5-23.5T280-480q0-33 23.5-56.5T360-560q33 0 56.5 23.5T440-480q0 33-23.5 56.5T360-400Zm240 0q-33 0-56.5-23.5T520-480q0-33 23.5-56.5T600-560q33 0 56.5 23.5T680-480q0 33-23.5 56.5T600-400ZM360-640q-33 0-56.5-23.5T280-720q0-33 23.5-56.5T360-800q33 0 56.5 23.5T440-720q0 33-23.5 56.5T360-640Zm240 0q-33 0-56.5-23.5T520-720q0-33 23.5-56.5T600-800q33 0 56.5 23.5T680-720q0 33-23.5 56.5T600-640Z"/></svg>
                                            <div className={styles.taskHeader}>
                                                {
                                                taskToEdit && taskPropToEdit === 'name' && taskToEdit.id === task.id
                                                    ? <input autoFocus type="text" defaultValue={task.name} onBlur={(e) => {setTaskPropHandler(e.target.value, 'name', task);}} onKeyDown={(e) => {if(e.key === 'Enter'){setTaskPropHandler(e.target.value, 'name', task)}}}/>
                                                    : <p onClick={(e) => changePropHandler(e, 'name', task.id)}>{task.name}</p>
                                                }
                                                <TaskMeta task={task} showTime={false} />
                                                <TaskLabels task={task} onOpenGroup={openGroup} />
                                            </div>
                                            <button onClick={()=>{setTaskPropHandler(!task.done, 'done', task)}}>
                                                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="m382-354 339-339q12-12 28-12t28 12q12 12 12 28.5T777-636L410-268q-12 12-28 12t-28-12L182-440q-12-12-11.5-28.5T183-497q12-12 28.5-12t28.5 12l142 143Z"/></svg>
                                            </button>
                                            { taskToEdit && taskPropToEdit === 'due' && taskToEdit.id === task.id
                                                ? <input autoFocus type="date" defaultValue={toInputDate(task.due)} onBlur={(e) => {setTaskPropHandler(e.target.value, 'due', task);}} onKeyDown={(e) => {if(e.key === 'Enter'){setTaskPropHandler(e.target.value, 'due', task)}}}/>
                                                : <p style={isOverdue(task) ? { color: 'var(--danger)' } : {}} onClick={(e) => changePropHandler(e, 'due', task.id)}>
                                                    {formatDate(task.due)}{task.due_time && <span className={styles.dueTime}> {task.due_time}</span>}
                                                </p>
                                            }
                                            <div className={styles.prioDiv}>
                                                <label>{t('prioritise')}:</label>
                                                <input type="number" name="prio" placeholder={task.prio} min="0" max="100" onKeyDown={(e) => {if(e.key === 'Enter'){setTaskPropHandler(e.target.value, 'prio', task)}}} onBlur={(e)=>setTaskPropHandler(e.target.value, 'prio', task)} />
                                            </div>
                                            {
                                                taskToEdit && taskPropToEdit === 'description' && taskToEdit.id === task.id
                                                ? <input style={{width: '100%', marginLeft: '0.5rem',}} autoFocus type="text" defaultValue={task.description || null} onKeyDown={(e) => {if(e.key === 'Enter'){setTaskPropHandler(e.target.value, 'description', task)}}} onBlur={(e) => {setTaskPropHandler(e.target.value, 'description', task);}} />
                                                : <p style={{textAlign: 'left', marginLeft: '0.5rem',}} onClick={(e) => changePropHandler(e, 'description', task.id)}>{task.description || t('description')}</p>
                                            }
                                            <div className={styles.btnDiv}>
                                                <button className={styles.assignBtn} onClick={() => handleAssignGroup(task)}>{t('assignGroup')}</button>
                                                {groupToDisplay.group.name && !showingAll && !shownGroup?.shared &&
                                                <button key={`${task.id}btn`} onClick={() => handleTaskRemove(task.id)} title={t('removeFromGroup')} aria-label={t('removeFromGroup')}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M480-424 284-228q-11 11-28 11t-28-11q-11-11-11-28t11-28l196-196-196-196q-11-11-11-28t11-28q11-11 28-11t28 11l196 196 196-196q11-11 28-11t28 11q11 11 11 28t-11 28L536-480l196 196q11 11 11 28t-11 28q-11 11-28 11t-28-11L480-424Z"/></svg>
                                                </button>
                                                }
                                                <button className={styles.deleteBtn} onClick={() => handleTaskDelete(task.id)}
                                                    title={t(isSharedWithMe(task) ? 'leaveTask' : 'deleteTask')} aria-label={`${t(isSharedWithMe(task) ? 'leaveTask' : 'deleteTask')}: ${task.name}`}>{<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520q-17 0-28.5-11.5T160-760q0-17 11.5-28.5T200-800h160q0-17 11.5-28.5T400-840h160q17 0 28.5 11.5T600-800h160q17 0 28.5 11.5T800-760q0 17-11.5 28.5T760-720v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM428.5-291.5Q440-303 440-320v-280q0-17-11.5-28.5T400-640q-17 0-28.5 11.5T360-600v280q0 17 11.5 28.5T400-280q17 0 28.5-11.5Zm160 0Q600-303 600-320v-280q0-17-11.5-28.5T560-640q-17 0-28.5 11.5T520-600v280q0 17 11.5 28.5T560-280q17 0 28.5-11.5ZM280-720v520-520Z"/></svg>}</button>
                                            </div>
                                            {working && (<div className={styles.dragDiv}><svg className={styles.dragSvg} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M360-160q-33 0-56.5-23.5T280-240q0-33 23.5-56.5T360-320q33 0 56.5 23.5T440-240q0 33-23.5 56.5T360-160Zm240 0q-33 0-56.5-23.5T520-240q0-33 23.5-56.5T600-320q33 0 56.5 23.5T680-240q0 33-23.5 56.5T600-160ZM360-400q-33 0-56.5-23.5T280-480q0-33 23.5-56.5T360-560q33 0 56.5 23.5T440-480q0 33-23.5 56.5T360-400Zm240 0q-33 0-56.5-23.5T520-480q0-33 23.5-56.5T600-560q33 0 56.5 23.5T680-480q0 33-23.5 56.5T600-400ZM360-640q-33 0-56.5-23.5T280-720q0-33 23.5-56.5T360-800q33 0 56.5 23.5T440-720q0 33-23.5 56.5T360-640Zm240 0q-33 0-56.5-23.5T520-720q0-33 23.5-56.5T600-800q33 0 56.5 23.5T680-720q0 33-23.5 56.5T600-640Z"/></svg></div>) }
                                        </li>
                                    )
                                }
                            })
                    }
                    </ul>
                </div>
                {showDone && listTasks.find(task => task.done === true) &&
                <div className={styles.ulDiv}>
                    <ul className={styles.ul}>
                        <h3 className={styles.ulH3}>{t('done')}</h3>
                    {listTasks
                        .map((task) => {
                            if(task.done && task.shared){
                                return (<li key={task.id} className={`${styles.taskLi} ${styles.doneLi}`}>
                                    <div className={styles.taskHeader}>
                                        <div className={styles.doneHeadDiv}>
                                            <p style={{textDecoration: 'line-through'}}>{task.name}</p>
                                            <input type="checkbox" checked onChange={() => toggleSharedDone(task)} aria-label={`${t('reopen')}: ${task.name}`} />
                                        </div>
                                        <TaskLabels task={task} onOpenGroup={openGroup} />
                                    </div>
                                </li>)
                            }
                            if(task.done && task.id !== activeTask?.id){
                                return (<li key={task.id} className={`${styles.taskLi} ${styles.doneLi}`}>
                                    <div className={styles.taskHeader}>
                                        <div className={styles.doneHeadDiv}>
                                            <p style={{textDecoration: 'line-through'}} onClick={(e) => changePropHandler(e, 'name', task.id)}>{task['name']}</p>
                                            <input type="checkbox" checked onChange={()=>{setTaskPropHandler(!task.done, 'done', task)}} />
                                        </div>
                                        <TaskLabels task={task} onOpenGroup={openGroup} />
                                    </div>
                                    <button className={styles.deleteBtn} onClick={() => handleTaskDelete(task.id)}
                                                    title={t(isSharedWithMe(task) ? 'leaveTask' : 'deleteTask')} aria-label={`${t(isSharedWithMe(task) ? 'leaveTask' : 'deleteTask')}: ${task.name}`}>{<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520q-17 0-28.5-11.5T160-760q0-17 11.5-28.5T200-800h160q0-17 11.5-28.5T400-840h160q17 0 28.5 11.5T600-800h160q17 0 28.5 11.5T800-760q0 17-11.5 28.5T760-720v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM428.5-291.5Q440-303 440-320v-280q0-17-11.5-28.5T400-640q-17 0-28.5 11.5T360-600v280q0 17 11.5 28.5T400-280q17 0 28.5-11.5Zm160 0Q600-303 600-320v-280q0-17-11.5-28.5T560-640q-17 0-28.5 11.5T520-600v280q0 17 11.5 28.5T560-280q17 0 28.5-11.5ZM280-720v520-520Z"/></svg>}</button>
                                </li>)
                            }
                        })
                    }
                    </ul>
                </div>
                }
            </div>

            {/* Ghost-Klon: schwebt per Portal direkt in document.body, unabhängig
                von transform/filter-Vorfahren, damit position:fixed wirklich
                relativ zum Viewport wirkt. Rendert nur, wenn gedraggt wird. */}
            
                {draggedTask && createPortal(
                <li
                    className={styles.taskLi}
                    style={{
                        visibility: 'visible',
                        position: 'fixed',
                        left: dragPosition.x - dragOffset.x,
                        top: dragPosition.y - dragOffset.y,
                        zIndex: 'var(--z-drag)',
                        pointerEvents: 'none',
                        margin: 0,
                        listStyle: 'none',
                        width: '5rem',
                        maxWidth: '8rem',
                        transition: 'none',
                        display: 'flex',
                        justifyContent: 'center',
                    }}
                >
                    <p style={{width: '100%', alignSelf: 'center'}}>{draggedTask.name}</p>
                </li>,
                document.body
            )}
        </div>
    );
}
