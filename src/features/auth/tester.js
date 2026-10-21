import { useSelector } from 'react-redux';

// Testers see features that aren't released to everyone yet. Admins make someone a tester in the
// admin panel; admins always count as testers. Only for showing or hiding things: anything that
// must really stay closed has to be checked by the server as well.

export const selectIsTester = (state) => state.auth.access.isTester;

export const useIsTester = () => useSelector(selectIsTester);
