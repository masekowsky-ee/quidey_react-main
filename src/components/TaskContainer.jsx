import { useState } from 'react'
import StartSettingsContainer from './StartSettingsContainer.jsx';
import styles from './TaskContainer.module.css';
import { useSelector, useDispatch } from 'react-redux';
import {deleteTask, deleteGroupTasks, addGroupTasks, editGroupDes, updateTaskTitle, updateTaskDescription, updateTaskDue, updateTaskCompleted, updateTaskPriority} from '../features/tasks/taskAction'


export default function TaskContainer(props){
    const { t, setSessionParams, setCustomError, showDone, setShowDone, working} = props;

    const dispatch = useDispatch();

    const tasks = useSelector(state => state.task.tasks);
    const groups = useSelector(state => state.task.groups);
    const groupToDisplayName = useSelector(state => state.task.groupToDisplayName);

    const [assignGroups, setAssignGroups] = useState(false);
    const [taskToAssign, setTaskToAssign] = useState(null);
    const [taskToEdit, setTaskToEdit] = useState(null);
    const [showStartSettings, setShowStartSettings] = useState(false);
    const [editGroupDescription, setEditGroupDescription] = useState(false);

    const handleTaskDelete = (taskIndex) => {
        dispatch(deleteTask(taskIndex));
    }

    const [taskPropToEdit, setTaskPropToEdit] = useState(null);

    const changePropHandler = (event, taskProp, taskIndex) => {
        setTaskToEdit(tasks.find(t => t.index === taskIndex));
        setTaskPropToEdit(taskProp);
    }

    const setTaskPropHandler = (input, propToEdit) => {
        switch(propToEdit){
            case 'name': 
                dispatch(updateTaskTitle(taskToEdit.index, input));
                break;
            case 'description':
                dispatch(updateTaskDescription(taskToEdit.index, input));
                break;
            case 'due':
                dispatch(updateTaskDue(taskToEdit.index, input));
                break;
        }
        setTaskToEdit(null);
        setTaskPropToEdit(null);
    }

    const handleAssignGroup = (task) => {
        setAssignGroups(true);
        setTaskToAssign(task);
    }

    const handleAddToGroup = (groupName) => {
        dispatch(addGroupTasks(groupName, taskToAssign.index))
        setAssignGroups(false);
        setTaskToAssign(null);
    }

    const setGroupDescriptionHandler = (description) => {
        dispatch(editGroupDes(groupToDisplayName, description));
        setEditGroupDescription(false);
    }

    const handleTaskDone = (taskIndex) => {
        dispatch(updateTaskCompleted(taskIndex));
    }

    function toDateOnly(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    function compareDate(dueDate){
        const today = toDateOnly(new Date());
        const due = toDateOnly(new Date(dueDate));
        return today > due; 
    }

    const handlePrioChange = (taskIndex, e) => {
        dispatch(updateTaskPriority(taskIndex, e.target.value))
    }

    const handleShowDone = () => {
        setShowDone(!showDone);
    }

    const handleTaskRemove = (taskIndex) => {
        dispatch(deleteGroupTasks(taskIndex, groupToDisplayName))
    }

    return (
        <div>
            {assignGroups && (
                <div style={{position:'absolute', zIndex:"1000", width: '100%', height: 'auto', backgroundColor:'black', display: 'flex', flexDirection: 'column'}}>
                    {groups.map(group => group.name !== 'all' ? (
                        <button key={group.name} style={{margin: '10px'}} onClick={() => handleAddToGroup(group.name)}>
                            {group.name}
                        </button>
                    ) : null)}
                </div>
            )}
            <h2 className={styles.h2}>{t('taskContainer')}</h2>
            {groups.find(g => g.name === groupToDisplayName || g.name === 'all')?.description &&
            <div className={styles.groupDescriptionDiv}>
                {editGroupDescription ?
                    <input type="text" id="groupDescriptionInput" defaultValue={groups.find(g => g.name === groupToDisplayName).description} onBlur={(e) => {setGroupDescriptionHandler(e.target.value);}} />
                    :
                    <p onClick={() => {setEditGroupDescription(true); document.getElementById('groupDescriptionInput')?.focus();}}>
                        {groups.find(g => g.name === groupToDisplayName || g.name === 'all').description}
                    </p>
                }
            </div>
            }
            <div className={styles.outerUlDiv}>
                <div className={styles.ulDiv}>
                    <ul className={styles.ul}>
                    {tasks.filter(task => task.groups.includes(groupToDisplayName)).length > 0 &&
                        tasks
                            .filter(task => task.groups.includes(groupToDisplayName))
                            .map((task) => {
                                if(!task.done){
                                    return (<li key={task.index} className={styles.taskLi}>
                                        <div className={styles.taskHeader}>
                                            {
                                            taskToEdit && taskPropToEdit === 'name' && taskToEdit.index === task.index
                                                ? <input autoFocus type="text" defaultValue={task.name} onBlur={(e) => {setTaskPropHandler(e.target.value, 'name');}} onKeyDown={(e) => {if(e.key === 'Enter'){setTaskPropHandler(e.target.value, 'name')}}}/>
                                                : <p onClick={(e) => changePropHandler(e, 'name', task.index)}>{task.name}</p>
                                            }
                                            <input type="checkbox" onChange={()=>{handleTaskDone(task.index)}} />
                                        </div>
                                        { taskToEdit && taskPropToEdit === 'due' && taskToEdit.index === task.index
                                            ? <input autoFocus type="date" defaultValue={task.due ?? null} onBlur={(e) => {setTaskPropHandler(e.target.value, 'due');}} onKeyDown={(e) => {if(e.key === 'Enter'){setTaskPropHandler(e.target.value, 'due')}}}/>
                                            : <p style={compareDate(task.due) ? { color: 'red' } : {}} onClick={(e) => changePropHandler(e, 'due', task.index)}>{task.due}</p>
                                        }
                                        <div>
                                            <label>{t('prioritise')}:</label>
                                            <input type="number" name="prio" placeholder={task.prio} min="0" max="100" onKeyDown={(e) => {if(e.key === 'Enter'){handlePrioChange(task.index, e)}}} onBlur={(e)=>handlePrioChange(task.index, e)} />
                                        </div>
                                        {
                                            taskToEdit && taskPropToEdit === 'description' && taskToEdit.index === task.index
                                            ? <input autoFocus type="text" defaultValue={task.description || null} onKeyDown={(e) => {if(e.key === 'Enter'){setTaskPropHandler(e.target.value, 'description')}}} onBlur={(e) => {setTaskPropHandler(e.target.value, 'description');}} />
                                            : <p onClick={(e) => changePropHandler(e, 'description', task.index)}>{task.description || t('description')}</p>
                                        }
                                        <div className={styles.btnDiv}>
                                            <button className={styles.btn} onClick={() => handleAssignGroup(task)}>{t('assignGroup')}</button>
                                            {groupToDisplayName !== 'all' &&
                                            <button className={styles.btn} onClick={() => handleTaskRemove(task.index)}>
                                                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M480-424 284-228q-11 11-28 11t-28-11q-11-11-11-28t11-28l196-196-196-196q-11-11-11-28t11-28q11-11 28-11t28 11l196 196 196-196q11-11 28-11t28 11q11 11 11 28t-11 28L536-480l196 196q11 11 11 28t-11 28q-11 11-28 11t-28-11L480-424Z"/></svg>
                                            </button>
                                            }
                                            <button className={styles.btn} onClick={() => handleTaskDelete(task.index)}>{<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520q-17 0-28.5-11.5T160-760q0-17 11.5-28.5T200-800h160q0-17 11.5-28.5T400-840h160q17 0 28.5 11.5T600-800h160q17 0 28.5 11.5T800-760q0 17-11.5 28.5T760-720v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM428.5-291.5Q440-303 440-320v-280q0-17-11.5-28.5T400-640q-17 0-28.5 11.5T360-600v280q0 17 11.5 28.5T400-280q17 0 28.5-11.5Zm160 0Q600-303 600-320v-280q0-17-11.5-28.5T560-640q-17 0-28.5 11.5T520-600v280q0 17 11.5 28.5T560-280q17 0 28.5-11.5ZM280-720v520-520Z"/></svg>}</button>
                                        </div>
                                        {working && (<div className={styles.dragDiv}><svg className={styles.dragSvg} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M360-160q-33 0-56.5-23.5T280-240q0-33 23.5-56.5T360-320q33 0 56.5 23.5T440-240q0 33-23.5 56.5T360-160Zm240 0q-33 0-56.5-23.5T520-240q0-33 23.5-56.5T600-320q33 0 56.5 23.5T680-240q0 33-23.5 56.5T600-160ZM360-400q-33 0-56.5-23.5T280-480q0-33 23.5-56.5T360-560q33 0 56.5 23.5T440-480q0 33-23.5 56.5T360-400Zm240 0q-33 0-56.5-23.5T520-480q0-33 23.5-56.5T600-560q33 0 56.5 23.5T680-480q0 33-23.5 56.5T600-400ZM360-640q-33 0-56.5-23.5T280-720q0-33 23.5-56.5T360-800q33 0 56.5 23.5T440-720q0 33-23.5 56.5T360-640Zm240 0q-33 0-56.5-23.5T520-720q0-33 23.5-56.5T600-800q33 0 56.5 23.5T680-720q0 33-23.5 56.5T600-640Z"/></svg></div>) }
                                    </li>)
                                }
                            })
                    }
                    </ul>
                </div>
                {showDone &&
                <div className={styles.ulDiv}>
                    <ul className={styles.ul}>
                    {tasks
                        .filter(task => task.groups.includes(groupToDisplayName))
                        .map((task) => {
                            if(task.done){
                                return (<li key={task.index} className={`${styles.taskLi} ${styles.doneLi}`}>
                                    <div className={styles.taskHeader}>
                                        <div className={styles.doneHeadDiv}>
                                            <p style={{textDecoration: 'line-through'}} onClick={(e) => changePropHandler(e, task.index, 'name')}>{task['name']}</p>
                                            <input type="checkbox" checked onChange={()=>{handleTaskDone(task.index)}} />
                                        </div>
                                    </div>
                                    <button className={styles.btn + ' ' + styles.delete} onClick={() => handleTaskDelete(task.index)}>{<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520q-17 0-28.5-11.5T160-760q0-17 11.5-28.5T200-800h160q0-17 11.5-28.5T400-840h160q17 0 28.5 11.5T600-800h160q17 0 28.5 11.5T800-760q0 17-11.5 28.5T760-720v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM428.5-291.5Q440-303 440-320v-280q0-17-11.5-28.5T400-640q-17 0-28.5 11.5T360-600v280q0 17 11.5 28.5T400-280q17 0 28.5-11.5Zm160 0Q600-303 600-320v-280q0-17-11.5-28.5T560-640q-17 0-28.5 11.5T520-600v280q0 17 11.5 28.5T560-280q17 0 28.5-11.5ZM280-720v520-520Z"/></svg>}</button>
                                </li>)
                            }
                        })
                    }
                    </ul>
                </div>
                }
            </div>
            {
                    !showDone ? 
                    <button className={styles.expandDone} onClick={handleShowDone}>
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M280-280h120q17 0 28.5 11.5T440-240q0 17-11.5 28.5T400-200H240q-17 0-28.5-11.5T200-240v-160q0-17 11.5-28.5T240-440q17 0 28.5 11.5T280-400v120Zm400-400H560q-17 0-28.5-11.5T520-720q0-17 11.5-28.5T560-760h160q17 0 28.5 11.5T760-720v160q0 17-11.5 28.5T720-520q-17 0-28.5-11.5T680-560v-120Z"/></svg>
                    </button> 
                    :
                    <button className={styles.collapseDone} onClick={handleShowDone}>
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M360-360H240q-17 0-28.5-11.5T200-400q0-17 11.5-28.5T240-440h160q17 0 28.5 11.5T440-400v160q0 17-11.5 28.5T400-200q-17 0-28.5-11.5T360-240v-120Zm240-240h120q17 0 28.5 11.5T760-560q0 17-11.5 28.5T720-520H560q-17 0-28.5-11.5T520-560v-160q0-17 11.5-28.5T560-760q17 0 28.5 11.5T600-720v120Z"/></svg>
                    </button>
                }
            {!showStartSettings && <button className={styles.startBtn} onClick={() => setShowStartSettings(true)}>{t('start')}</button>}
            {showStartSettings && <StartSettingsContainer setCustomError={setCustomError} setSessionParams={setSessionParams} setShowStartSettings={setShowStartSettings} t={t} groups={groups} />}
        </div>
    );
}