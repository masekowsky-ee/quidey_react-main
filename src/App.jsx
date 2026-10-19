import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Header from './components/Header.jsx';
import Home from './components/home.jsx'
import Menu from './components/menu.jsx'
import Profile from './components/profile.jsx'
import Settings from './components/Settings.jsx'
import CustomError from './components/CustomError.jsx';
import History from './components/History.jsx';
import Calendar from  './components/Calendar.jsx';
import { useDispatch, useSelector } from "react-redux";
import { checkAuth, setUser, fetchAccess } from "./features/auth/authAction";
import { PRO_REQUIRED_EVENT, SIGNED_OUT_EVENT } from "./features/helperFunction";
import { logout } from "./features/auth/authAction";
import BetaGate, { AccessPending } from "./components/BetaGate.jsx";
import { fetchTaskState } from "./features/tasks/taskAction.js"
import { fetchSessions } from "./features/session/sessionAction.js"
import { fetchFriendRequests } from "./features/friends/friendsAction.js"
import Social from './components/Social.jsx';
import Together from './components/Together.jsx';
import SharedSession from './components/SharedSession.jsx';
import { fetchSharedSessions, fetchMySharedTasks } from './features/together/togetherAction.js'
import { useWorkReporter } from './features/together/work.js'
import TeamHome from './components/TeamHome.jsx';
import Toaster from './components/Toaster.jsx';
import Admin from './components/Admin.jsx';
import { useApplyTheme } from './features/settings/theme.js';

const REQUEST_REFRESH_MS = 60 * 1000;

function App(){
  const dispatch = useDispatch();
  useApplyTheme();
  // the team stopwatch keeps running on every page
  useWorkReporter();
  const homeLayout = useSelector((state) => state.settings.homeLayout);

  useEffect(() => {
    dispatch(checkAuth());
  }, [dispatch]);

  const token = useSelector((state) => state.auth.token);
  const signedIn = Boolean(token);
  // closed beta: only pro users get into the app, the others see the beta screen
  const access = useSelector((state) => state.auth.access);
  const allowed = signedIn && access.checked && access.isPro;

  useEffect(() => {
    if (allowed) {
      dispatch(setUser());
      dispatch(fetchTaskState());
      dispatch(fetchSessions());
    }
  }, [allowed, dispatch]);

  // The server no longer accepts my login (expired, password changed on another device,
  // "sign out everywhere"): sign out here too
  useEffect(() => {
    const signOut = () => dispatch(logout());
    window.addEventListener(SIGNED_OUT_EVENT, signOut);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, signOut);
  }, [dispatch]);

  // Access can change while the app is open (pro granted or taken away): checked again when the tab
  // gets focus, once a minute, and when the server refuses a request for lack of pro
  useEffect(() => {
    if (!signedIn) return;
    const check = () => dispatch(fetchAccess()).catch(() => {});
    window.addEventListener('focus', check);
    window.addEventListener(PRO_REQUIRED_EVENT, check);
    const interval = setInterval(check, REQUEST_REFRESH_MS);
    return () => {
      window.removeEventListener('focus', check);
      window.removeEventListener(PRO_REQUIRED_EVENT, check);
      clearInterval(interval);
    };
  }, [signedIn, dispatch]);

  // Keeps the friend request and session invite badges current: on sign-in, when the tab gets focus again, and once a minute
  useEffect(() => {
    if (!allowed) return;
    const refresh = () => {
      dispatch(fetchFriendRequests()).catch(() => {});
      dispatch(fetchSharedSessions()).catch(() => {});
      // the shared sessions' tasks for the solo view
      dispatch(fetchMySharedTasks()).catch(() => {});
    };
    refresh();
    window.addEventListener('focus', refresh);
    const interval = setInterval(refresh, REQUEST_REFRESH_MS);
    return () => {
      window.removeEventListener('focus', refresh);
      clearInterval(interval);
    };
  }, [allowed, dispatch]);

  const [activeTimer, setActiveTimer] = useState(false);

  if (signedIn && !access.checked) return <AccessPending />;
  if (signedIn && !access.isPro) {
    return (
      <Routes>
        <Route path="/beta" element={<BetaGate />} />
        <Route path="*" element={<Navigate to="/beta" replace />} />
      </Routes>
    );
  }


  return (
    <div>
      {!signedIn && <Profile/>}
        <div>
          <Header activeTimer={activeTimer}/>
        </div>
        {signedIn && <section>
        <Menu/>
        <CustomError/>
        <Toaster/>
        <Routes>
          <Route path="/" element={homeLayout === 'team' ? <TeamHome/> : <Home setActiveTimer={setActiveTimer}/>} />
          <Route path="/calendar" element={<Calendar/>} />
          <Route path="/history" element={<History  />} />
          <Route path="/profile" element={<Profile/>} />
          <Route path="/settings" element={<Settings/>} />
          <Route path="/social" element={<Social/>} />
          <Route path="/together" element={<Together/>} />
          <Route path="/together/:id" element={<SharedSession/>} />
          <Route path="/admin" element={access.isAdmin ? <Admin/> : <Navigate to="/" replace />} />
          <Route path="/beta" element={<Navigate to="/" replace />} />
        </Routes>
      </section>
      }
    </div>
  );
}

export default App;
