import { useSelector } from 'react-redux';

// Testers see features that aren't released to everyone yet. Admins make someone a tester in the
// admin panel; admins always count as testers. Only for showing or hiding things: anything that
// must really stay closed has to be checked by the server as well.

export const selectIsTester = (state) => state.auth.access.isTester;

export const useIsTester = () => useSelector(selectIsTester);

// who is signed in, and what the server says they may do (state.auth, from /api/me)
export const selectUser = (state) => state.auth.user;
export const selectUsername = (state) => state.auth.user?.username;
export const selectAccess = (state) => state.auth.access;
export const selectIsAdmin = (state) => state.auth.access.isAdmin;
