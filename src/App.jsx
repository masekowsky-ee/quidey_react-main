import React, { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import {useTranslation} from './i18n/LanguageContext'
import mockData from './components/mockData'
import styles from './App.module.css';
import Header from './components/Header.jsx';
import Home from './components/home.jsx'
import Menu from './components/menu.jsx'
import Profile from './components/profile.jsx'
import Settings from './components/Settings.jsx'
import WorkingPage from './components/WorkingPage.jsx';
import CustomError from './components/CustomError.jsx';
import History from './components/History.jsx';

function App(){
  const { t, language, setLanguage } = useTranslation();

  const [groups, setGroups] = useState(() => {
    try {
      const stored = localStorage.getItem("groups");
      return stored ? JSON.parse(stored) : mockData.groups;
    } catch {
      return mockData.groups;
    }
  });

  const [taskIndexCounter, setTaskIndexCounter] = useState(() => {
    try {
      const stored = localStorage.getItem("taskIndexCounter");
      const parsed = stored !== null ? JSON.parse(stored) : null;
      return typeof parsed === "number" ? parsed : mockData.taskIndexCounter;
    } catch {
      return mockData.taskIndexCounter;
    }
  });

  const [tasks, setTasks] = useState(() => {
    try {
      const stored = localStorage.getItem("tasks");
      return stored ? JSON.parse(stored) : mockData.tasks;
    } catch {
      return mockData.tasks;
    }
  });

  const [showMenu, setShowMenu] = useState(false);

  const [signedIn, setSignedIn] = useState(() => {
    try {
      const stored = localStorage.getItem("signedIn");
      return stored !== null ? JSON.parse(stored) : false;
    } catch {
      return false;
    }
  });

  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [workedSessions, setWorkedSessions] = useState(() => {
      try {
          const stored = localStorage.getItem("workedSessions");
          if (!stored) return [];
          const parsed = JSON.parse(stored);
          return parsed.map(session => ({ ...session, date: new Date(session.date) }));
      } catch {
          return [];
      }
  });

  const [users, setUsers] = useState(mockData.users);

  const [sessionParams, setSessionParams] = useState({ group: null, time: null, breaks: null });

  const [customError, setCustomError] = useState({ bool: false, message: '' });

  const [showDone, setShowDone] = useState(false);

  useEffect(()=>{
    localStorage.setItem("tasks", JSON.stringify(tasks));
  },[tasks]);
  useEffect(()=>{
    localStorage.setItem("taskIndexCounter", taskIndexCounter);
  },[taskIndexCounter]);
  useEffect(()=>{
    localStorage.setItem("groups", JSON.stringify(groups));
  },[groups]);
  useEffect(()=>{
    localStorage.setItem("signedIn", JSON.stringify(signedIn));
  },[signedIn]);
  useEffect(()=>{
    localStorage.setItem("user", JSON.stringify(user));
  },[user]);
  useEffect(()=>{
    localStorage.setItem("workedSessions", JSON.stringify(workedSessions));
  },[workedSessions]);

  console.log(tasks);
  return (
    <div>
      <div className={styles.header}>
        <Header t={t} showMenu={() => setShowMenu(true)} />
      </div>
      <Menu t={t} isOpen={showMenu} onClose={() => setShowMenu(false)} />
      <CustomError t={t} customError={customError} setCustomError={setCustomError} />
      <Routes>
        <Route path="/" element={<Home t={t} showDone={showDone} setShowDone={setShowDone} tasks={tasks} setTasks={setTasks} groups={groups} setGroups={setGroups} taskIndexCounter={taskIndexCounter} setSessionParams={setSessionParams} setTaskIndexCounter={setTaskIndexCounter} setCustomError={setCustomError} />} />
        <Route path="/working" element={<WorkingPage setWorkedSessions={setWorkedSessions} sessionParams={sessionParams} t={t} showDone={showDone} setShowDone={setShowDone} tasks={tasks} setTasks={setTasks} groups={groups} setGroups={setGroups} taskIndexCounter={taskIndexCounter} setSessionParams={setSessionParams} setTaskIndexCounter={setTaskIndexCounter} setCustomError={setCustomError} />} />
        <Route path="/history" element={<History workedSessions={workedSessions} t={t} tasks={tasks} groups={groups} setCustomError={setCustomError} />} />
        <Route path="/profile" element={<Profile t={t} users={users} setUsers={setUsers} signedIn={signedIn} setSignedIn={setSignedIn} user={user} setUser={setUser} setCustomError={setCustomError} />} />
        <Route path="/settings" element={<Settings t={t} setLanguage={setLanguage} language={language} setCustomError={setCustomError} />} />
      </Routes>
    </div>
  );
}

export default App;
