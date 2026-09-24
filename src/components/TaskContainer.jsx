import { useState } from 'react'
import styles from './TaskContainer.module.css';
import { useSelector, useDispatch } from 'react-redux';
import {deleteTask, deleteGroupTasks, addGroupTasks, editGroup, updateTaskProps} from '../features/tasks/taskAction'
import { createPortal } from 'react-dom';


export default function TaskContainer(props){
    const { t, showDone, setShowDone, working, handlePointerDown, draggedTask, dragPosition, dragOffset, setCreateTask } = props;

    const dispatch = useDispatch();

    const tasks = useSelector(state => state.task.tasks);
    const groups = useSelector(state => state.task.groups);
    const groupToDisplay = useSelector(state => state.task.groupToDisplay);
    console.log(groupToDisplay);

    const [assignGroups, setAssignGroups] = useState(false);
    const [taskToAssign, setTaskToAssign] = useState(null);
    const [taskToEdit, setTaskToEdit] = useState(null);
    const [editGroupDescription, setEditGroupDescription] = useState(false);

    const handleTaskDelete = (taskId) => {
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
                dispatch(updateTaskProps({prio: input}, task));
                break;
        }
        setTaskToEdit(null);
        setTaskPropToEdit(null);
    }

    const handleAssignGroup = (task) => {
        setAssignGroups(true);
        setTaskToAssign(task);
    }

    const handleAddToGroup = (groupId) => {
        dispatch(addGroupTasks(groupId, taskToAssign.id))
        setAssignGroups(false);
        setTaskToAssign(null);
    }

    const setGroupDescriptionHandler = (description) => {
        dispatch(editGroup(groupToDisplay.group.id, {description: description}, groupToDisplay.group));
        setEditGroupDescription(false);
    }

    function toDateOnly(date) {
        return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    }

    function compareDate(dueDate){
        const today = toDateOnly(new Date());
        const due = toDateOnly(new Date(dueDate));
        return today > due;
    }

    const handleShowDone = () => {
        setShowDone(!showDone);
    }

    const handleTaskRemove = (taskId) => {
        dispatch(deleteGroupTasks(taskId, groupToDisplay.group.id))
    }

    return (
        <div>
            {assignGroups && (
                <div style={{position:'absolute', zIndex:"1000", width: '100%', height: 'auto', backgroundColor:'black', display: 'flex', flexDirection: 'column'}}>
                    {groups.map(group => group.name !== 'all' ? (
                        <button key={group.name} style={{margin: '10px'}} onClick={() => handleAddToGroup(group.id)}>
                            {group.name}
                        </button>
                    ) : null)}
                </div>
            )}
            <div className={styles.outerUlDiv}>
                <h2 className={styles.h2}>{t('taskContainer')}</h2>
                <button onClick={()=>{setCreateTask(true)}}> 
                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M440-440v120q0 17 11.5 28.5T480-280q17 0 28.5-11.5T520-320v-120h120q17 0 28.5-11.5T680-480q0-17-11.5-28.5T640-520H520v-120q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640v120H320q-17 0-28.5 11.5T280-480q0 17 11.5 28.5T320-440h120Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/></svg>
                </button>
            </div>
            {!groupToDisplay ? null : groupToDisplay.group?.description &&
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
                        <h3 className={styles.ulH3}>To Do</h3>
                    {groupToDisplay.tasks.find(task => task.done !== true) && groupToDisplay.tasks
                            .map((task) => {
                                // Check if this specific task is the one currently being dragged
                                console.log(task.id)
                                const isBeingDragged = draggedTask?.id === task.id;

                                if(!task.done){
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
                                            </div>
                                            <input type="checkbox" onChange={()=>{setTaskPropHandler(!task.done, 'done', task)}} />
                                            { taskToEdit && taskPropToEdit === 'due' && taskToEdit.id === task.id
                                                ? <input autoFocus type="date" defaultValue={task.due ?? null} onBlur={(e) => {setTaskPropHandler(e.target.value, 'due', task);}} onKeyDown={(e) => {if(e.key === 'Enter'){setTaskPropHandler(e.target.value, 'due', task)}}}/>
                                                : <p style={compareDate(task.due) ? { color: 'red' } : {}} onClick={(e) => changePropHandler(e, 'due', task.id)}>{`${new Date(task.due).getUTCDate()}.${new Date(task.due).getUTCMonth()+1}.${new Date(task.due).getUTCFullYear()}`}</p>
                                            }
                                            <div>
                                                <label>{t('prioritise')}:</label>
                                                <input type="number" name="prio" placeholder={task.prio} min="0" max="100" onKeyDown={(e) => {if(e.key === 'Enter'){setTaskPropHandler(e.target.value, 'prio', task)}}} onBlur={(e)=>setTaskPropHandler(e.target.value, 'prio', task)} />
                                            </div>
                                            {
                                                taskToEdit && taskPropToEdit === 'description' && taskToEdit.id === task.id
                                                ? <input style={{width: '100%', marginLeft: '0.5rem',}} autoFocus type="text" defaultValue={task.description || null} onKeyDown={(e) => {if(e.key === 'Enter'){setTaskPropHandler(e.target.value, 'description', task)}}} onBlur={(e) => {setTaskPropHandler(e.target.value, 'description', task);}} />
                                                : <p style={{textAlign: 'left', marginLeft: '0.5rem',}} onClick={(e) => changePropHandler(e, 'description', task.id)}>{task.description || t('description')}</p>
                                            }
                                            <div className={styles.btnDiv}>
                                                <button className={styles.btn} onClick={() => handleAssignGroup(task)}>{t('assignGroup')}</button>
                                                {groupToDisplay.group.name &&
                                                <button key={`${task.id}btn`} className={styles.btn} onClick={() => handleTaskRemove(task.id)}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M480-424 284-228q-11 11-28 11t-28-11q-11-11-11-28t11-28l196-196-196-196q-11-11-11-28t11-28q11-11 28-11t28 11l196 196 196-196q11-11 28-11t28 11q11 11 11 28t-11 28L536-480l196 196q11 11 11 28t-11 28q-11 11-28 11t-28-11L480-424Z"/></svg>
                                                </button>
                                                }
                                                <button className={styles.btn} onClick={() => handleTaskDelete(task.id)}>{<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520q-17 0-28.5-11.5T160-760q0-17 11.5-28.5T200-800h160q0-17 11.5-28.5T400-840h160q17 0 28.5 11.5T600-800h160q17 0 28.5 11.5T800-760q0 17-11.5 28.5T760-720v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM428.5-291.5Q440-303 440-320v-280q0-17-11.5-28.5T400-640q-17 0-28.5 11.5T360-600v280q0 17 11.5 28.5T400-280q17 0 28.5-11.5Zm160 0Q600-303 600-320v-280q0-17-11.5-28.5T560-640q-17 0-28.5 11.5T520-600v280q0 17 11.5 28.5T560-280q17 0 28.5-11.5ZM280-720v520-520Z"/></svg>}</button>
                                            </div>
                                            {working && (<div className={styles.dragDiv}><svg className={styles.dragSvg} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M360-160q-33 0-56.5-23.5T280-240q0-33 23.5-56.5T360-320q33 0 56.5 23.5T440-240q0 33-23.5 56.5T360-160Zm240 0q-33 0-56.5-23.5T520-240q0-33 23.5-56.5T600-320q33 0 56.5 23.5T680-240q0 33-23.5 56.5T600-160ZM360-400q-33 0-56.5-23.5T280-480q0-33 23.5-56.5T360-560q33 0 56.5 23.5T440-480q0 33-23.5 56.5T360-400Zm240 0q-33 0-56.5-23.5T520-480q0-33 23.5-56.5T600-560q33 0 56.5 23.5T680-480q0 33-23.5 56.5T600-400ZM360-640q-33 0-56.5-23.5T280-720q0-33 23.5-56.5T360-800q33 0 56.5 23.5T440-720q0 33-23.5 56.5T360-640Zm240 0q-33 0-56.5-23.5T520-720q0-33 23.5-56.5T600-800q33 0 56.5 23.5T680-720q0 33-23.5 56.5T600-640Z"/></svg></div>) }
                                        </li>
                                    )
                                }
                            })
                    }
                    </ul>
                </div>
                {showDone && groupToDisplay.tasks.find(task => task.done === true) &&
                <div className={styles.ulDiv}>
                    <ul className={styles.ul}>
                        <h3 className={styles.ulH3}>Done</h3>
                    {groupToDisplay.tasks
                        .map((task) => {
                            if(task.done){
                                return (<li key={task.id} className={`${styles.taskLi} ${styles.doneLi}`}>
                                    <div className={styles.taskHeader}>
                                        <div className={styles.doneHeadDiv}>
                                            <p style={{textDecoration: 'line-through'}} onClick={(e) => changePropHandler(e, task.id, 'name')}>{task['name']}</p>
                                            <input type="checkbox" checked onChange={()=>{setTaskPropHandler(!task.done, 'done', task)}} />
                                        </div>
                                    </div>
                                    <button className={styles.btn + ' ' + styles.delete} onClick={() => handleTaskDelete(task.id)}>{<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520q-17 0-28.5-11.5T160-760q0-17 11.5-28.5T200-800h160q0-17 11.5-28.5T400-840h160q17 0 28.5 11.5T600-800h160q17 0 28.5 11.5T800-760q0 17-11.5 28.5T760-720v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM428.5-291.5Q440-303 440-320v-280q0-17-11.5-28.5T400-640q-17 0-28.5 11.5T360-600v280q0 17 11.5 28.5T400-280q17 0 28.5-11.5Zm160 0Q600-303 600-320v-280q0-17-11.5-28.5T560-640q-17 0-28.5 11.5T520-600v280q0 17 11.5 28.5T560-280q17 0 28.5-11.5ZM280-720v520-520Z"/></svg>}</button>
                                </li>)
                            }
                        })
                    }
                    </ul>
                </div>
                }
            </div>
            { groupToDisplay.tasks.find(task => task.done === true) &&
                <div>{
                    !showDone ? 
                    <button className={styles.expandDone} onClick={handleShowDone}>
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M280-280h120q17 0 28.5 11.5T440-240q0 17-11.5 28.5T400-200H240q-17 0-28.5-11.5T200-240v-160q0-17 11.5-28.5T240-440q17 0 28.5 11.5T280-400v120Zm400-400H560q-17 0-28.5-11.5T520-720q0-17 11.5-28.5T560-760h160q17 0 28.5 11.5T760-720v160q0 17-11.5 28.5T720-520q-17 0-28.5-11.5T680-560v-120Z"/></svg>
                    </button> 
                    :
                    <button className={styles.collapseDone} onClick={handleShowDone}>
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M360-360H240q-17 0-28.5-11.5T200-400q0-17 11.5-28.5T240-440h160q17 0 28.5 11.5T440-400v160q0 17-11.5 28.5T400-200q-17 0-28.5-11.5T360-240v-120Zm240-240h120q17 0 28.5 11.5T760-560q0 17-11.5 28.5T720-520H560q-17 0-28.5-11.5T520-560v-160q0-17 11.5-28.5T560-760q17 0 28.5 11.5T600-720v120Z"/></svg>
                    </button>}
                </div>}

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
                        zIndex: 1000,
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
