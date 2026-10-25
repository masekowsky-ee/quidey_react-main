// Gemeinschaft: one page for everything with other people. The feed is its start; my progress
// (level, challenges, the week among friends), the shared sessions, friends and families are
// its tabs. The old addresses (/together, /social, /family) lead here; one session
// (/together/:id) and one family (/family/:id) keep theirs.
export const COMMUNITY_PATHS = {
    feed: '/community',
    progress: '/community/progress',
    sessions: '/community/sessions',
    friends: '/community/friends',
    family: '/community/family',
};

export const COMMUNITY_TABS = ['feed', 'progress', 'sessions', 'friends', 'family'];

// the friends tab with its own sub tab (add, requests)
export const friendsPath = (tab) => (tab ? `${COMMUNITY_PATHS.friends}?tab=${tab}` : COMMUNITY_PATHS.friends);

// Everything that belongs to the page, for the menu's highlight: its tabs, one session, one
// family and somebody's profile (reached from the friends)
export const isCommunityPath = (pathname) =>
    pathname === COMMUNITY_PATHS.feed || /^\/(community|together|family|u)\//.test(pathname);
