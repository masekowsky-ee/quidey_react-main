import React, { useState, useEffect } from 'react'
import TaskContainer from './TaskContainer.jsx'
import TaskForm from './TaskForm.jsx'
import styles from './Home.module.css';
import GroupForm from './GroupForm.jsx';
import { Outlet } from 'react-router-dom';
import WeekDaysContainer from './WeekDaysContainer.jsx';
import GroupBtnContainer from './GroupBtnContainer.jsx';

export default function Home(props){
    const {t, tasks, groups, setGroups, setSessionParams, setCustomError, showDone, setShowDone} = props;

    const [groupToDisplayName, setGroupToDisplayName] = useState('all');

    const [showForms, setShowForms] = useState(true);

    console.log(props.tasks);
    return (
        <div className={styles.div}>
            <WeekDaysContainer t={t} tasks={tasks} />
            <div className={styles.formsDiv}>
                <TaskForm setCustomError={setCustomError} showForms={showForms} setTasks={props.setTasks} t={props.t} setGroups={props.setGroups} taskIndexCounter={props.taskIndexCounter} setTaskIndexCounter={props.setTaskIndexCounter} />
                <GroupForm showForms={showForms} t={props.t} setGroups={props.setGroups} groups={props.groups} setCustomError={setCustomError} />
                <button className={`${styles.sizeBtn} ${showForms ? '' : styles.collapsed}`} onClick={()=>{setShowForms(!showForms)}}>{showForms ? <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M480-264 324-108q-11 11-28 11t-28-11q-11-11-11-28t11-28l155-155q23-23 57-23t57 23l155 155q11 11 11 28t-11 28q-11 11-28 11t-28-11L480-264Zm0-432 156-156q11-11 28-11t28 11q11 11 11 28t-11 28L537-641q-23 23-57 23t-57-23L268-796q-11-11-11-28t11-28q11-11 28-11t28 11l156 156Z"/></svg> : <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="m480-194 155-155q12-12 28-12t28 12q12 12 12 28.5T691-292L537-137q-23 23-57 23t-57-23L268-292q-12-12-11.5-28.5T269-349q12-12 28.5-12t28.5 12l154 155Zm0-572L326-612q-12 12-28 11.5T270-612q-12-12-12.5-28.5T269-669l154-154q23-23 57-23t57 23l154 154q12 12 11.5 28.5T690-612q-12 11-28 11.5T634-612L480-766Z"/></svg>}</button>
            </div>
            <GroupBtnContainer t={t} groups={groups} setGroups={setGroups} setGroupToDisplayName={setGroupToDisplayName} groupToDisplayName={groupToDisplayName} />
            <div className={styles.tcc}>
            <TaskContainer working={false} showDone={showDone} setShowDone={setShowDone} setSessionParams={setSessionParams} tasks={props.tasks} groupToDisplayName={groupToDisplayName} setGroupToDisplayName={setGroupToDisplayName} setTasks={props.setTasks} t={props.t} groups={props.groups} setGroups={props.setGroups} setCustomError={setCustomError} />
            </div>
            <Outlet />
        </div>
    );
}