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

function App(){
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(checkAuth());
  }, [dispatch]);

  const token = useSelector((state) => state.auth.token);
  const signedIn = Boolean(token);

  useEffect(() => {
    if (signedIn) {
      dispatch(setUser());
      dispatch(fetchTaskState());
      dispatch(fetchSessions());
    }
  }, [signedIn, dispatch]);

  const [activeTimer, setActiveTimer] = useState(false);


  return (
    <div>
      {!signedIn && <Profile/>}
        <div>
          <Header activeTimer={activeTimer}/>
        </div>
        {signedIn && <section>
        <Menu/>
        <CustomError/>
        <Routes>
          <Route path="/" element={<Home setActiveTimer={setActiveTimer}/>} />
          <Route path="/calendar" element={<Calendar/>} />
          <Route path="/history" element={<History  />} />
          <Route path="/profile" element={<Profile/>} />
          <Route path="/settings" element={<Settings/>} />
        </Routes>
      </section>
      }
    </div>
  );
}

export default App;
