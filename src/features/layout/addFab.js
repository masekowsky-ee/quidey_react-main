import { matchPath } from 'react-router-dom';
import { COMMUNITY_PATHS } from '../community/paths';

// The pages with the round add button (components/home/AddFab.jsx): where planning happens and
// nothing sits in the bottom right corner. Start, Kalender, Fokusraum, a family, a shared
// session, and their lists under Sozial. Not on the others.
const FAB_PATHS = ['/', '/calendar', '/focus', '/family/:id', '/together/:id',
    COMMUNITY_PATHS.sessions, COMMUNITY_PATHS.family];

export const showsAddFab = (pathname) => FAB_PATHS.some(path => matchPath(path, pathname));
