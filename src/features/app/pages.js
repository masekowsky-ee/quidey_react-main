// The pages load when first opened, so the first screen (and the sign-in for visitors)
// doesn't carry the whole app. Once the app is idle the rest is fetched in the background
// (preloadPages), so switching pages stays instant. preload: false = not part of that
// (the sign-in's mail link and the legal texts).
export const PAGES = {
  LegalPage: { load: () => import('../../legal/LegalPage.jsx'), preload: false },
  VerifyEmail: { load: () => import('../../components/VerifyEmail.jsx'), preload: false },
  TeamHome: { load: () => import('../../components/TeamHome.jsx') },
  Calendar: { load: () => import('../../components/Calendar.jsx') },
  Stats: { load: () => import('../../components/Stats.jsx') },
  Profile: { load: () => import('../../components/Profile.jsx') },
  Settings: { load: () => import('../../components/Settings.jsx') },
  UserProfile: { load: () => import('../../components/UserProfile.jsx') },
  Inbox: { load: () => import('../../components/Inbox.jsx') },
  Feedback: { load: () => import('../../components/Feedback.jsx') },
  Community: { load: () => import('../../components/community/Community.jsx') },
  SharedSession: { load: () => import('../../components/SharedSession.jsx') },
  Admin: { load: () => import('../../components/Admin.jsx') },
  FamilyPage: { load: () => import('../../components/family/FamilyPage.jsx') },
  ArcadePage: { load: () => import('../../components/arcade/ArcadePage.jsx') },
  Tester: { load: () => import('../../components/tester/Tester.jsx') },
  FocusRoom: { load: () => import('../../components/focus/FocusRoom.jsx') },
  Routines: { load: () => import('../../components/routines/Routines.jsx') },
  NotesPage: { load: () => import('../../components/notes/NotesPage.jsx') },
  Collections: { load: () => import('../../components/collections/Collections.jsx') },
  StudyPage: { load: () => import('../../components/study/StudyPage.jsx') },
  ProPage: { load: () => import('../../components/pro/ProPage.jsx') },
};

// the app's pages (not the sign-in or legal texts) in the background, when nothing else runs
export function preloadPages() {
  const load = () => {
    for (const { load: page, preload } of Object.values(PAGES)) {
      if (preload !== false) page().catch(() => {});
    }
  };
  const id = window.requestIdleCallback ? window.requestIdleCallback(load, { timeout: 5000 }) : setTimeout(load, 2000);
  return () => (window.cancelIdleCallback ? window.cancelIdleCallback(id) : clearTimeout(id));
}
