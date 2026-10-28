import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { MotionConfig, motion } from 'motion/react'
import Header from './components/Header.jsx';
import Home from './components/Home.jsx'
import Menu from './components/Menu.jsx'
import TabBar from './components/TabBar.jsx'
import shell from './components/AppShell.module.css'
import CustomError from './components/CustomError.jsx';
import { useDispatch, useSelector } from "react-redux";
import { checkAuth, setUser, fetchAccess } from "./features/auth/authAction";
import { PRO_REQUIRED_EVENT, SIGNED_OUT_EVENT } from "./features/helperFunction";
import { logout } from "./features/auth/authAction";
import BetaGate from "./components/BetaGate.jsx";
import AppSkeleton from "./components/skeleton/AppSkeleton.jsx";
import { GateSkeleton, RouteSkeleton } from "./components/skeleton/PageSkeletons.jsx";
import { fetchTaskState, fetchTaskInvites, refreshTasks } from "./features/tasks/taskAction.js"
import { useTaskReminders } from "./features/tasks/reminders.js"
import { useEventEnds } from "./features/tasks/kinds.js"
import { useAccountLocale } from "./features/settings/accountLocale.js"
import { usePushSync } from "./features/pwa/push.js"
import { fetchSessions } from "./features/session/sessionAction.js"
import { fetchFriendRequests, fetchFriends } from "./features/friends/friendsAction.js"
import { usePresenceRealtime } from "./features/presence/presence.js"
import { fetchSharedSessions, fetchMySharedTasks } from './features/together/togetherAction.js'
import { useWorkReporter } from './features/together/work.js'
import { useSoloSharedWork } from './features/together/useSoloSharedWork.js'
import { useFocusClock } from './features/session/useFocusClock.js'
import { selectFocusTask } from './features/session/sessionAction.js'
import { useRoutineReminders } from './features/routines/routines.js'
import Toaster from './components/Toaster.jsx';
import Tutorial from './components/Tutorial.jsx';
import DeleteScopeDialog from './components/task/DeleteScopeDialog.jsx';
import PushOffer from './components/PushOffer.jsx';
import OnboardingPrompts from './components/onboarding/OnboardingPrompts.jsx';
import QuickAdd from './components/QuickAdd.jsx';
import { fetchInboxUnread } from './features/inbox/inbox.js';
import { useInboxRealtime } from './features/inbox/useInboxRealtime.js';
import { connectRealtime, disconnectRealtime, useRealtime, useSafetyPoll, REALTIME_REJECTED } from './features/realtime/socket.js';
import { useLiveLists } from './features/realtime/useLiveLists.js';
import { useClearNews } from './features/realtime/useClearNews.js';
import { useFamilyList } from './features/family/family.js';
import { useProgressWatcher } from './features/progress/progress.js';
import { useFeedRealtime } from './features/feed/feed.js';
import { COMMUNITY_PATHS } from './features/community/paths.js';
import { LegalFooter } from './legal/LegalFooter.jsx';
import { LEGAL_PATHS } from './legal/paths.js';
import { useApplyTheme } from './features/settings/theme.js';
import { MOTION, useApplyMotion, useMotionLevel } from './features/settings/motion.js';
import { useApplyUiVariant, useNavModel } from './features/tester/variants.js';
import TesterOnly from './components/TesterOnly.jsx';
import CommandPalette from './components/variants/CommandPalette.jsx';
import ShortcutsDialog from './components/ShortcutsDialog.jsx';

const REQUEST_REFRESH_MS = 60 * 1000;

// The pages load when first opened, so the first screen (and the sign-in for visitors)
// doesn't carry the whole app. Once the app is idle the rest is fetched in the background
// (preloadPages), so switching pages stays instant.
const PAGES = {
  SignIn: () => import('./components/SignIn.jsx'),
  LegalPage: () => import('./legal/LegalPage.jsx'),
  VerifyEmail: () => import('./components/VerifyEmail.jsx'),
  TeamHome: () => import('./components/TeamHome.jsx'),
  Calendar: () => import('./components/Calendar.jsx'),
  Stats: () => import('./components/Stats.jsx'),
  Profile: () => import('./components/Profile.jsx'),
  Settings: () => import('./components/Settings.jsx'),
  UserProfile: () => import('./components/UserProfile.jsx'),
  Inbox: () => import('./components/Inbox.jsx'),
  Feedback: () => import('./components/Feedback.jsx'),
  Community: () => import('./components/community/Community.jsx'),
  SharedSession: () => import('./components/SharedSession.jsx'),
  Admin: () => import('./components/Admin.jsx'),
  FamilyPage: () => import('./components/family/FamilyPage.jsx'),
  FunPage: () => import('./components/fun/FunPage.jsx'),
  Tester: () => import('./components/tester/Tester.jsx'),
  FocusRoom: () => import('./components/focus/FocusRoom.jsx'),
  Routines: () => import('./components/routines/Routines.jsx'),
};
const SignIn = lazy(PAGES.SignIn);
const LegalPage = lazy(PAGES.LegalPage);
const VerifyEmail = lazy(PAGES.VerifyEmail);
const TeamHome = lazy(PAGES.TeamHome);
const Calendar = lazy(PAGES.Calendar);
const Stats = lazy(PAGES.Stats);
const Profile = lazy(PAGES.Profile);
const Settings = lazy(PAGES.Settings);
const UserProfile = lazy(PAGES.UserProfile);
const Inbox = lazy(PAGES.Inbox);
const Feedback = lazy(PAGES.Feedback);
const Community = lazy(PAGES.Community);
const SharedSession = lazy(PAGES.SharedSession);
const Admin = lazy(PAGES.Admin);
const FamilyPage = lazy(PAGES.FamilyPage);
const FunPage = lazy(PAGES.FunPage);
const Tester = lazy(PAGES.Tester);
const FocusRoom = lazy(PAGES.FocusRoom);
const Routines = lazy(PAGES.Routines);

// the app's pages (not the sign-in or legal texts) in the background, when nothing else runs
function preloadPages() {
  const load = () => {
    for (const [name, page] of Object.entries(PAGES)) {
      if (!['SignIn', 'LegalPage', 'VerifyEmail'].includes(name)) page().catch(() => {});
    }
  };
  const id = window.requestIdleCallback ? window.requestIdleCallback(load, { timeout: 5000 }) : setTimeout(load, 2000);
  return () => (window.cancelIdleCallback ? window.cancelIdleCallback(id) : clearTimeout(id));
}

// while the sign-in's code is on its way: its shape
const gateLoading = <GateSkeleton />;

function App(){
  const dispatch = useDispatch();
  useApplyTheme();
  useApplyMotion();
  // testers: the interface variant they picked (<html data-ui>), its way of navigating
  useApplyUiVariant();
  const navModel = useNavModel();
  const motionLevel = useMotionLevel();
  // the team stopwatch keeps running on every page
  useWorkReporter();
  // the focus timer runs on every page, by the wall clock (also while the phone is off); time on
  // a task from a shared session is booked in that session too
  useFocusClock();
  useSoloSharedWork(useSelector(selectFocusTask));
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

  // Access can change while the app is open (pro granted or taken away): checked when the server
  // refuses a request or the live connection for lack of it, and as a safety net once a minute
  // (every few minutes while connected: taking pro away closes the connection right away).
  // On the beta screen there is no connection, so a granted beta shows up within a minute.
  const checkAccess = () => dispatch(fetchAccess()).catch(() => {});
  useEffect(() => {
    if (!signedIn) return;
    const check = () => dispatch(fetchAccess()).catch(() => {});
    window.addEventListener(PRO_REQUIRED_EVENT, check);
    return () => window.removeEventListener(PRO_REQUIRED_EVENT, check);
  }, [signedIn, dispatch]);
  useRealtime(REALTIME_REJECTED, checkAccess);
  useSafetyPoll(checkAccess, { everyMs: REQUEST_REFRESH_MS, enabled: signedIn });

  // The friend request and session invite badges: loaded on sign-in, then kept current by the
  // live connection (useLiveLists); polled only as the safety net
  useSafetyPoll(() => {
    dispatch(fetchFriendRequests()).catch(() => {});
    // friends (with who of them is online, for the menu and Home)
    dispatch(fetchFriends()).catch(() => {});
    dispatch(fetchSharedSessions()).catch(() => {});
    // the shared sessions' tasks for the solo view
    dispatch(fetchMySharedTasks()).catch(() => {});
    // tasks friends sent me
    dispatch(fetchTaskInvites()).catch(() => {});
    // unread messages and notices for the inbox badge
    dispatch(fetchInboxUnread()).catch(() => {});
  }, { everyMs: REQUEST_REFRESH_MS, enabled: allowed, immediately: true });

  // The live connection for chats and notices: open while signed in with access, opened
  // again with a new token (password changed), closed on sign-out
  useEffect(() => {
    if (!allowed) return;
    connectRealtime();
    return () => disconnectRealtime();
  }, [allowed, token]);
  useInboxRealtime();
  useLiveLists();
  // friends coming online or going away
  usePresenceRealtime(dispatch);
  useClearNews();
  // Quidey Family (testers): my families and invites
  useFamilyList(allowed);
  // XP, levels and challenges: looked at again after every session and ticked-off task;
  // the feed reloads when a friend's entry comes
  useProgressWatcher(allowed);
  useFeedRealtime();

  // tasks shared with friends change on their side (announced live, see useLiveLists), my own
  // ones maybe on another device: read again as a safety net (not right at the start,
  // fetchTaskState just loaded them)
  useSafetyPoll(() => dispatch(refreshTasks()).catch(() => {}), { everyMs: REQUEST_REFRESH_MS, enabled: allowed });

  // reminders of tasks with a time, while the app is open
  useTaskReminders(allowed);
  // ...and by mail when a task asks for it: the server needs my time zone and language
  useAccountLocale(allowed);
  // an event that ends while the app is open shows as done right then
  useEventEnds(allowed);
  // push notifications on this device: checked on every start, a click opens their page
  const navigate = useNavigate();
  usePushSync(allowed, token, navigate);
  // routines planned for a time of day: a toast while the app is open
  useRoutineReminders(allowed);

  useEffect(() => { if (allowed) return preloadPages(); }, [allowed]);

  const location = useLocation();
  // while a page's code is on its way (only the first time, and briefly): that page's shape
  const pageLoading = <RouteSkeleton pathname={location.pathname} fade />;

  // the link from the verification mail works signed in or not, and before beta access
  if (location.pathname === '/verify-email') return <Suspense fallback={gateLoading}><VerifyEmail /></Suspense>;
  // Impressum, Datenschutz and terms must open for everybody, signed in or not
  if (LEGAL_PATHS.includes(location.pathname)) return <Suspense fallback={pageLoading}><LegalPage /></Suspense>;
  // signed out: the way in (sign in / sign up). The landing page is its own site on quidey.com
  if (!signedIn) return <Suspense fallback={gateLoading}><SignIn /></Suspense>;
  // the app's frame until the server says whether I may use it
  if (signedIn && !access.checked) return <AppSkeleton />;
  if (signedIn && !access.isPro) {
    return (
      <>
        <Routes>
          <Route path="/beta" element={<BetaGate />} />
          <Route path="*" element={<Navigate to="/beta" replace />} />
        </Routes>
        <LegalFooter />
      </>
    );
  }


  return (
    // the amount of motion is chosen in the settings (the system's "reduce motion" picks
    // "minimal" as the default there), so it isn't applied a second time here
    <MotionConfig reducedMotion="never">
    {/* the frame: sidebar (desktop) or drawer, header, tab bar (phones); see AppShell.module.css */}
    <div className={shell.shell} data-nav={navModel} data-part="shell">
        <Header/>
        <Menu/>
        <TabBar/>
        <CustomError/>
        <Toaster/>
        <Tutorial/>
        <DeleteScopeDialog/>
        <PushOffer/>
        <OnboardingPrompts/>
        <QuickAdd/>
        {/* Ctrl/⌘ K or "/": search tasks, jump, do; "?": the keyboard shortcuts */}
        <CommandPalette/>
        <ShortcutsDialog/>
        <main className={shell.main} data-part="main">
        {/* each page comes in as the motion setting says */}
        {/* ...the tabs of the Gemeinschaft page are one page: switching them doesn't */}
        <motion.div key={location.pathname.startsWith(COMMUNITY_PATHS.feed) ? COMMUNITY_PATHS.feed : location.pathname} {...MOTION.page[motionLevel]}>
        <Suspense fallback={pageLoading}>
        <Routes location={location}>
          <Route path="/" element={homeLayout === 'team' ? <TeamHome/> : <Home/>} />
          <Route path="/calendar" element={<Calendar/>} />
          {/* Fokusraum: the big timer, Pomodoro, notes and study tools */}
          <Route path="/focus" element={<FocusRoom/>} />
          <Route path="/routines" element={<Routines/>} />
          <Route path="/routines/:id/run" element={<Routines/>} />
          <Route path="/stats" element={<Stats />} />
          {/* the old address of the statistics (bookmarks, ?tab=done links) */}
          <Route path="/history" element={<Navigate to={{ pathname: '/stats', search: location.search }} replace />} />
          <Route path="/profile" element={<Profile/>} />
          <Route path="/settings" element={<Settings/>} />
          {/* Gemeinschaft: the feed, then sessions, friends and families as tabs */}
          <Route path="/community" element={<Community/>} />
          <Route path="/community/:tab" element={<Community/>} />
          {/* the old addresses of the lists (bookmarks, links in mails and toasts) */}
          <Route path="/social" element={<Navigate to={{ pathname: COMMUNITY_PATHS.friends, search: location.search }} replace />} />
          <Route path="/together" element={<Navigate to={{ pathname: COMMUNITY_PATHS.sessions, search: location.search }} replace />} />
          <Route path="/family" element={<Navigate to={COMMUNITY_PATHS.family} replace />} />
          <Route path="/u/:username" element={<UserProfile/>} />
          <Route path="/inbox" element={<Inbox/>} />
          <Route path="/feedback" element={<Feedback/>} />
          <Route path="/together/:id" element={<SharedSession/>} />
          <Route path="/family/:id" element={<FamilyPage/>} />
          <Route path="/admin" element={access.isAdmin ? <Admin/> : <Navigate to="/" replace />} />
          {/* testers: interface variants and the features in test, with their ratings */}
          <Route path="/tester" element={<TesterOnly fallback={<Navigate to="/" replace />}><Tester/></TesterOnly>} />
          {/* hidden: only reachable through the daily line in the header */}
          <Route path="/fun" element={<FunPage/>} />
          <Route path="/beta" element={<Navigate to="/" replace />} />
          {/* where the landing page sends people to sign in or up */}
          <Route path="/signin" element={<Navigate to="/" replace />} />
          <Route path="/signup" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        </motion.div>
        <LegalFooter />
        </main>
    </div>
    </MotionConfig>
  );
}

export default App;
