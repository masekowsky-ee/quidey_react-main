import { useEffect, Suspense } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MotionConfig, motion } from 'motion/react'
import Header from './components/Header.jsx';
import { LegalPage, VerifyEmail, GuestRoutes, AppRoutes, WaitingRoutes } from './features/app/routes.jsx';
import Menu from './components/Menu.jsx'
import TabBar from './components/TabBar.jsx'
import shell from './components/AppShell.module.css'
import CustomError from './components/CustomError.jsx';
import { useDispatch, useSelector } from "react-redux";
import { checkAuth } from "./features/auth/authAction";
import AppSkeleton from "./components/skeleton/AppSkeleton.jsx";
import { GateSkeleton, RouteSkeleton } from "./components/skeleton/PageSkeletons.jsx";
import { useFocusClock } from './features/session/useFocusClock.js'
import { useWorkReporter } from './features/together/work.js'
import { useLinkedWork } from './features/together/linkedWork.js'
import { useCalm } from './features/focus/calm';
import ReminderAlert from './components/reminders/ReminderAlert.jsx'
import Toaster from './components/Toaster.jsx';
import OfflineStatus from './components/offline/OfflineStatus.jsx';
import UpdatePrompt from './components/update/UpdatePrompt.jsx';
import Tutorial from './components/Tutorial.jsx';
import FeatureTips from './components/tips/FeatureTips.jsx';
import DeleteScopeDialog from './components/task/DeleteScopeDialog.jsx';
import PushOffer from './components/PushOffer.jsx';
import OnboardingPrompts from './components/onboarding/OnboardingPrompts.jsx';
import QuickAdd from './components/QuickAdd.jsx';
import AddFab from './components/home/AddFab.jsx';
import AssistantFab from './components/assistant/AssistantFab.jsx';
import { showsAddFab } from './features/layout/addFab.js';
import { COMMUNITY_PATHS } from './features/community/paths.js';
import { LegalFooter } from './legal/LegalFooter.jsx';
import AuthDialog from './components/auth/AuthDialog.jsx';
import GuestTourInvite from './components/guest/GuestTourInvite.jsx';
import { LEGAL_PATHS } from './legal/paths.js';
import { useApplyTheme } from './features/settings/theme.js';
import { MOTION, pageSwipeMotion, useApplyMotion, useMotionLevel } from './features/settings/motion.js';
import { useApplyUiVariant, useNavModel } from './features/tester/variants.js';
import CommandPalette from './components/variants/CommandPalette.jsx';
import ShortcutsDialog from './components/ShortcutsDialog.jsx';
import LimitDialog from './components/pro/LimitDialog.jsx';
import { useProOn } from './features/pro/flag.js';
import {
  useGuestSeed, useSignedInStart, useAccessGuard, useSignedInData, useAppServices, useUsage,
} from './features/app/startup.js';

// while the mail link's page is on its way: its shape
const gateLoading = <GateSkeleton />;

function App(){
  const dispatch = useDispatch();
  useApplyTheme();
  useApplyMotion();
  // <html lang>: German or English, as the app speaks (screen readers, hyphenation)
  const language = useSelector((state) => state.settings.language);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  // testers: the interface variant they picked (<html data-ui>), its way of navigating
  useApplyUiVariant();
  const navModel = useNavModel();
  const motionLevel = useMotionLevel();
  // the team stopwatch keeps running on every page
  useWorkReporter();
  // the focus timer runs on every page, by the wall clock (also while the phone is off); on a
  // task from a shared session the session's stopwatch follows it (one timer for both)
  useFocusClock();
  useLinkedWork();
  const homeLayout = useSelector((state) => state.settings.homeLayout);

  useEffect(() => {
    dispatch(checkAuth());
  }, [dispatch]);

  const token = useSelector((state) => state.auth.token);
  const signedIn = Boolean(token);
  // nobody signed in: the app opens anyway, empty, and asks for an account when one is needed
  // (features/auth/gate.js, components/auth/AuthDialog.jsx)
  const guest = !signedIn;
  useGuestSeed(guest);
  // closed beta: only pro users get into the app, the others see the beta screen
  const access = useSelector((state) => state.auth.access);
  const allowed = signedIn && access.checked && access.isPro;
  // Quidey Pro is switched off until both switches are on (features/pro/flag.js)
  const proOn = useProOn();

  useSignedInStart(allowed);
  useAccessGuard({ signedIn, proOn, token });
  useSignedInData(allowed);
  const navigate = useNavigate();
  useAppServices(allowed, token, navigate);

  const location = useLocation();
  // calm mode: while a focus round runs in the Fokusraum, the navigation steps back (features/focus/calm.js)
  const calm = useCalm(location.pathname);
  useUsage(allowed, access, location.pathname);
  // while a page's code is on its way (only the first time, and briefly): that page's shape
  const pageLoading = <RouteSkeleton pathname={location.pathname} fade />;

  // the link from the verification mail works signed in or not, and before beta access
  if (location.pathname === '/verify-email') return <Suspense fallback={gateLoading}><VerifyEmail /></Suspense>;
  // Impressum, Datenschutz and terms must open for everybody, signed in or not
  if (LEGAL_PATHS.includes(location.pathname)) return <Suspense fallback={pageLoading}><LegalPage /></Suspense>;
  // signed out: the app itself, as a guest (below); the landing page is its own site on quidey.com
  // the app's frame until the server says whether I may use it
  if (signedIn && !access.checked) return <AppSkeleton />;
  if (signedIn && !access.isPro) {
    return (
      <>
        <WaitingRoutes proOn={proOn} pageLoading={pageLoading} />
        <LegalFooter />
      </>
    );
  }


  return (
    // the amount of motion is chosen in the settings (the system's "reduce motion" picks
    // "minimal" as the default there), so it isn't applied a second time here
    <MotionConfig reducedMotion="never">
    {/* the frame: sidebar (desktop) or drawer, header, tab bar (phones); see AppShell.module.css */}
    <div className={shell.shell} data-nav={navModel} data-part="shell" data-calm={calm || undefined}>
        <Header/>
        <Menu/>
        <TabBar/>
        <CustomError/>
        <Toaster/>
        <UpdatePrompt/>
        {/* a guest gets no tour, tips, push question or account dialogs: the sign-in window instead */}
        {guest ? <><AuthDialog/><Tutorial/></> : <>
        <OfflineStatus/>
        <Tutorial/>
        <FeatureTips/>
        <DeleteScopeDialog/>
        <PushOffer/>
        <OnboardingPrompts/>
        </>}
        <QuickAdd/>
        {!guest && <ReminderAlert/>}
        {/* the round add button, bottom right, on the planning pages */}
        <AddFab/>
        {/* Quidey Max: the AI assistant, round at the bottom left, on the same pages */}
        {!guest && <AssistantFab/>}
        {/* Ctrl/⌘ K or "/": search tasks, jump, do; "?": the keyboard shortcuts */}
        <CommandPalette/>
        <ShortcutsDialog/>
        {/* the free plan is full (after the beta): the way to Quidey Pro */}
        {proOn && !guest && <LimitDialog/>}
        <main className={shell.main} data-part="main" data-fab={showsAddFab(location.pathname) || undefined}>
        {/* a visitor without an account: the quiet offer of the short tour, on the start page */}
        {guest && location.pathname === '/' && <GuestTourInvite/>}
        {/* each page comes in as the motion setting says */}
        {/* ...the tabs of the Gemeinschaft page are one page: switching them doesn't */}
        {/* ...a tab reached by a sideways swipe (phones) slides in from that side */}
        <motion.div key={location.pathname.startsWith(COMMUNITY_PATHS.feed) ? COMMUNITY_PATHS.feed : location.pathname}
            {...(location.state?.tabSwipe ? pageSwipeMotion(location.state.tabSwipe, motionLevel) : MOTION.page[motionLevel])}>
        <Suspense fallback={pageLoading}>
        {guest
          ? <GuestRoutes location={location} />
          : <AppRoutes location={location} access={access} proOn={proOn} homeLayout={homeLayout} />}
        </Suspense>
        </motion.div>
        <LegalFooter />
        </main>
    </div>
    </MotionConfig>
  );
}

export default App;
