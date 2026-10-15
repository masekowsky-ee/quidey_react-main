import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Header from './components/Header.jsx';
import Home from './components/home.jsx'
import Menu from './components/menu.jsx'
import Profile from './components/profile.jsx'
import Settings from './components/Settings.jsx'
import CustomError from './components/CustomError.jsx';
import History from './components/History.jsx';
import Calendar from  './components/Calendar.jsx';
import { useDispatch, useSelector } from "react-redux";
import { checkAuth, setUser } from "./features/auth/authAction";
import { fetchTaskState } from "./features/tasks/taskAction.js"
import { fetchSessions } from "./features/session/sessionAction.js"
import {useTranslation} from './i18n/LanguageContext'

function App(){
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(checkAuth());
  }, [dispatch]);

  const token = useSelector((state) => state.auth.token);
  const signedIn = Boolean(token);

  const [percentWidth, setPercentWidth] = useState(0);

  useEffect(() => {
    if (signedIn) {
      dispatch(setUser());
      dispatch(fetchTaskState());
      dispatch(fetchSessions());
    }
  }, [signedIn, dispatch]);

  useEffect(() => {
    fetch("http://localhost:3000/api/hello")
      .then((res) => res.json())
      .then((data) => console.log("Backend sagt:", data))
      .catch((err) => console.error("Fehler:", err));
  }, []);

  const [activeTimer, setActiveTimer] = useState(false);

  const { setLanguage } = useTranslation();


  return (
    <div>
      {!signedIn && <Profile/>}
        <div>
          <Header activeTimer={activeTimer} percentWidth={percentWidth}/>
        </div>
        {signedIn && <section>
        <Menu/>
        <CustomError/>
        <Routes>
          <Route path="/" element={<Home setActiveTimer={setActiveTimer} setPercentWidth={setPercentWidth} percentWidth={percentWidth}/>} />
          {/*<Route path="/working" element={<WorkingPage t={t}  />} /> */}
          <Route path="/calendar" element={<Calendar/>} />
          <Route path="/history" element={<History  />} />
          <Route path="/profile" element={<Profile/>} />
          <Route path="/settings" element={<Settings setLanguage={setLanguage}/>} />
        </Routes>
      </section>
      }
    </div>
  );
}

export default App;
