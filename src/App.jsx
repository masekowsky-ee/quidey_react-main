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
import { fetchFriendRequests } from "./features/friends/friendsAction.js"
import Social from './components/Social.jsx';
import Together from './components/Together.jsx';
import SharedSession from './components/SharedSession.jsx';
import { fetchSharedSessions } from './features/together/togetherAction.js'
import { useApplyTheme } from './features/settings/theme.js';

const REQUEST_REFRESH_MS = 60 * 1000;

function App(){
  const dispatch = useDispatch();
  useApplyTheme();

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

  // Keeps the friend request and session invite badges current: on sign-in, when the tab gets focus again, and once a minute
  useEffect(() => {
    if (!signedIn) return;
    const refresh = () => {
      dispatch(fetchFriendRequests()).catch(() => {});
      dispatch(fetchSharedSessions()).catch(() => {});
    };
    refresh();
    window.addEventListener('focus', refresh);
    const interval = setInterval(refresh, REQUEST_REFRESH_MS);
    return () => {
      window.removeEventListener('focus', refresh);
      clearInterval(interval);
    };
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
          <Route path="/social" element={<Social/>} />
          <Route path="/together" element={<Together/>} />
          <Route path="/together/:id" element={<SharedSession/>} />
        </Routes>
      </section>
      }
    </div>
  );
}

export default App;
