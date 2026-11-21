import { COMMUNITY_PATHS } from '../community/paths.js';

// The app's routes as data (no imports of pages: features/auth/gate.js reads the guest paths from
// here, so this file stays light). pages.js has the lazy loaders, routes.jsx makes the <Route>s.

// The signed-in app's pages. guest: true = a visitor without an account may look at it too (the
// rest renders GuestLocked). guard: a condition on top of being signed in (routes.jsx GUARDS).
export const ROUTES = [
  { path: '/', page: 'Home', guest: true }, // Home, or TeamHome in the team layout (signed in)
  { path: '/calendar', page: 'Calendar', guest: true },
  { path: '/focus', page: 'FocusRoom', guest: true },
  { path: '/routines', page: 'Routines' },
  { path: '/routines/:id/run', page: 'Routines' },
  { path: '/notes', page: 'NotesPage' },
  { path: '/collections', page: 'Collections' },
  { path: '/collections/:id', page: 'Collections' },
  { path: '/study', page: 'StudyPage' },
  { path: '/study/goals/:id', page: 'StudyPage' },
  { path: '/study/:subjectId', page: 'StudyPage' },
  { path: '/stats', page: 'Stats' },
  { path: '/profile', page: 'Profile' },
  { path: '/settings', page: 'Settings' },
  { path: '/community', page: 'Community' },
  { path: '/community/:tab', page: 'Community' },
  { path: '/u/:username', page: 'UserProfile' },
  { path: '/inbox', page: 'Inbox' },
  { path: '/feedback', page: 'Feedback' },
  { path: '/together/:id', page: 'SharedSession' },
  { path: '/family/:id', page: 'FamilyPage' },
  { path: '/admin', page: 'Admin', guard: 'admin' },
  { path: '/tester', page: 'Tester', guard: 'tester' },
  { path: '/arcade', page: 'ArcadePage' },
  { path: '/pro', page: 'ProPage', guard: 'pro' },
  { path: '/beta', page: 'BetaGate', guard: 'beta' },
];

// The old addresses (bookmarks, links in mails and toasts); search: the query string comes along
export const REDIRECTS = [
  { from: '/history', to: '/stats', search: true },
  { from: '/social', to: COMMUNITY_PATHS.friends, search: true },
  { from: '/together', to: COMMUNITY_PATHS.sessions, search: true },
  { from: '/family', to: COMMUNITY_PATHS.family },
  { from: '/fun', to: '/arcade' },
];

// Where the landing page sends people to sign in or up, and where Google's sign-in page sends the
// browser back (googleReturn). A guest gets GuestEntry, signed in goes straight to the start page.
export const ENTRY_ROUTES = [
  { path: '/signin', mode: 'signin' },
  { path: '/signup', mode: 'signup' },
  { path: '/auth/google', mode: 'signin', googleReturn: true },
];

export const GUEST_PATHS = ROUTES.filter((route) => route.guest).map((route) => route.path);
