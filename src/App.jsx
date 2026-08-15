import { useState, useEffect } from 'react'
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
import Calendar from  './components/Calendar.jsx';
import { useDispatch, useSelector } from "react-redux";
import { checkAuth } from "./features/auth/authAction";

function App(){
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(checkAuth());
  }, [dispatch]);

  const token = useSelector((state) => state.auth.token);
  const signedIn = Boolean(token);

  const { t, language, setLanguage } = useTranslation();

  const [groups, setGroups] = useState(() => {
    try {
      const stored = localStorage.getItem("groups");
      return stored ? JSON.parse(stored) : mockData.groups;
    } catch {
      return mockData.groups;
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

  const [sessionParams, setSessionParams] = useState({ group: null, time: null, breaks: null });

  const [customError, setCustomError] = useState({ bool: false, message: '' });

  const [showDone, setShowDone] = useState(false);

  useEffect(()=>{
    localStorage.setItem("tasks", JSON.stringify(tasks));
  },[tasks]);
  useEffect(()=>{
    localStorage.setItem("groups", JSON.stringify(groups));
  },[groups]);
  useEffect(()=>{
    localStorage.setItem("workedSessions", JSON.stringify(workedSessions));
  },[workedSessions]);

  useEffect(() => {
    fetch("http://localhost:3000/api/hello")
      .then((res) => res.json())
      .then((data) => console.log("Backend sagt:", data))
      .catch((err) => console.error("Fehler:", err));
  }, []);

  return (
    <div>
      {!signedIn && <Profile t={t} />}
      {signedIn && <section>
        <div className={styles.header}>
          <Header t={t} showMenu={() => setShowMenu(true)} />
        </div>
        <Menu t={t} isOpen={showMenu} onClose={() => setShowMenu(false)} />
        <CustomError t={t} customError={customError} setCustomError={setCustomError} />
        <Routes>
          <Route path="/" element={<Home t={t} showDone={showDone} setShowDone={setShowDone} tasks={tasks} setTasks={setTasks} groups={groups} setGroups={setGroups} setSessionParams={setSessionParams} setCustomError={setCustomError} />} />
          <Route path="/working" element={<WorkingPage setWorkedSessions={setWorkedSessions} sessionParams={sessionParams} t={t} showDone={showDone} setShowDone={setShowDone} tasks={tasks} setTasks={setTasks} groups={groups} setGroups={setGroups} setSessionParams={setSessionParams} setCustomError={setCustomError} />} />
          <Route path="/calendar" element={<Calendar t={t} setCustomError={setCustomError} tasks={tasks} />} />
          <Route path="/history" element={<History workedSessions={workedSessions} t={t} tasks={tasks} groups={groups} setCustomError={setCustomError} />} />
          <Route path="/profile" element={<Profile t={t} />} />
          <Route path="/settings" element={<Settings t={t} setLanguage={setLanguage} language={language} setCustomError={setCustomError} />} />
        </Routes>
      </section>
      }
    </div>
  );
}

export default App;
