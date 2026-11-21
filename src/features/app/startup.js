import { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setUser, fetchAccess, logout } from '../auth/authAction';
import { PRO_REQUIRED_EVENT, SIGNED_OUT_EVENT } from '../api/api';
import { fetchTaskState, fetchTaskInvites, refreshTasks } from '../tasks/taskAction.js';
import { SET_TASK_STATE } from '../tasks/taskActionTypes.js';
import { SET_COLLECTIONS } from '../collections/collections.js';
import { PROGRESS_FAILED, useProgressWatcher } from '../progress/progress.js';
import { useTaskReminders } from '../tasks/reminders.js';
import { useEventEnds } from '../tasks/kinds.js';
import { useAccountLocale } from '../settings/accountLocale.js';
import { usePushSync } from '../pwa/push.js';
import { fetchSessions } from '../session/sessionAction.js';
import { fetchFriendRequests, fetchFriends } from '../friends/friendsAction.js';
import { usePresenceRealtime } from '../presence/presence.js';
import { fetchSharedSessions, fetchMySharedTasks } from '../together/togetherAction.js';
import { useFocusNotification } from '../session/focusNotification';
import { useFocusTitle } from '../session/focusTitle';
import { useFocusAway } from '../focus/useFocusAway';
import { useRoutineReminders } from '../routines/routines.js';
import { useReminders } from '../reminders/reminders.js';
import { useAvatarRealtime } from '../profile/avatars.js';
import { useTabSwipe } from '../layout/tabSwipe.js';
import { useSlidingActive } from '../layout/slidingActive.js';
import { useKeyboardInset } from '../layout/keyboardInset.js';
import { fetchInboxUnread } from '../inbox/inbox.js';
import { useInboxRealtime } from '../inbox/useInboxRealtime.js';
import { connectRealtime, disconnectRealtime, useRealtime, useSafetyPoll, REALTIME_REJECTED } from '../realtime/socket.js';
import { useLiveLists } from '../realtime/useLiveLists.js';
import { useClearNews } from '../realtime/useClearNews.js';
import { useFamilyList } from '../family/family.js';
import { useFeedRealtime } from '../feed/feed.js';
import { restorePlayPurchases } from '../pro/pro.js';
import { trackView } from '../usage/track.js';
import { setUsageEnabled } from '../usage/usage.js';
import { useActiveMinutes, useAppOpen } from '../usage/useActiveMinutes.js';
import { preloadPages } from './pages.js';

const REQUEST_REFRESH_MS = 60 * 1000;

// a guest has nothing to load: the lists count as loaded (empty) and there is no progress to show,
// so Home draws no skeletons that would never fill
export function useGuestSeed(guest) {
  const dispatch = useDispatch();
  useEffect(() => {
    if (!guest) return;
    dispatch({ type: SET_TASK_STATE, payload: { tasks: [], groups: [], notes: [] } });
    dispatch({ type: SET_COLLECTIONS, payload: [] });
    dispatch({ type: PROGRESS_FAILED });
  }, [guest, dispatch]);
}

// What the app loads once I may use it, and the sign-out when the server no longer accepts my login
// (expired, password changed on another device, "sign out everywhere")
export function useSignedInStart(allowed) {
  const dispatch = useDispatch();
  useEffect(() => {
    if (allowed) {
      dispatch(setUser());
      dispatch(fetchTaskState());
      dispatch(fetchSessions());
    }
  }, [allowed, dispatch]);

  useEffect(() => {
    const signOut = () => dispatch(logout());
    window.addEventListener(SIGNED_OUT_EVENT, signOut);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, signOut);
  }, [dispatch]);
}

// Access can change while the app is open (pro granted or taken away): checked when the server
// refuses a request or the live connection for lack of it, and as a safety net once a minute
// (every few minutes while connected: taking pro away closes the connection right away).
// On the beta screen there is no connection, so a granted beta shows up within a minute.
export function useAccessGuard({ signedIn, proOn, token }) {
  const dispatch = useDispatch();
  const checkAccess = useCallback(() => dispatch(fetchAccess()).catch(() => {}), [dispatch]);
  useEffect(() => {
    if (!signedIn) return;
    window.addEventListener(PRO_REQUIRED_EVENT, checkAccess);
    return () => window.removeEventListener(PRO_REQUIRED_EVENT, checkAccess);
  }, [signedIn, checkAccess]);
  useRealtime(REALTIME_REJECTED, checkAccess);
  // a payment went through or a subscription ended (the server says so live)
  useRealtime('pro:changed', checkAccess);
  // Android app: purchases Google Play knows on this phone are handed to the server again (a new
  // install, another phone, an answer that got lost), then access is looked at again
  useEffect(() => {
    if (signedIn && proOn) restorePlayPurchases().then(({ accepted }) => { if (accepted) checkAccess(); });
  }, [signedIn, proOn, token, checkAccess]);
  useSafetyPoll(checkAccess, { everyMs: REQUEST_REFRESH_MS, enabled: signedIn });
}

// The friend request and session invite badges: loaded on sign-in, then kept current by the
// live connection (useLiveLists); polled only as the safety net
export function useSignedInData(allowed) {
  const dispatch = useDispatch();
  useSafetyPoll(() => {
    dispatch(fetchFriendRequests()).catch(() => {});
    dispatch(fetchFriends()).catch(() => {});
    dispatch(fetchSharedSessions()).catch(() => {});
    dispatch(fetchMySharedTasks()).catch(() => {});
    dispatch(fetchTaskInvites()).catch(() => {});
    dispatch(fetchInboxUnread()).catch(() => {});
  }, { everyMs: REQUEST_REFRESH_MS, enabled: allowed, immediately: true });
}

// Everything that runs while I may use the app: the live connection (open while signed in with
// access, opened again with a new token (password changed), closed on sign-out), its lists and
// the reminders, notifications and layout helpers
export function useAppServices(allowed, token, navigate) {
  const dispatch = useDispatch();
  useEffect(() => {
    if (!allowed) return;
    connectRealtime();
    return () => disconnectRealtime();
  }, [allowed, token]);
  useInboxRealtime();
  useLiveLists();
  usePresenceRealtime(dispatch);
  useClearNews();
  useFamilyList(allowed);
  // XP, levels and challenges: looked at again after every session and ticked-off task;
  // the feed reloads when a friend's entry comes
  useProgressWatcher(allowed);
  useFeedRealtime();
  useAvatarRealtime();

  // tasks shared with friends change on their side (announced live, see useLiveLists), my own
  // ones maybe on another device: read again as a safety net (not right at the start,
  // fetchTaskState just loaded them)
  useSafetyPoll(() => dispatch(refreshTasks()).catch(() => {}), { everyMs: REQUEST_REFRESH_MS, enabled: allowed });

  useTaskReminders(allowed);
  // ...and by mail when a task asks for it: the server needs my time zone and language
  useAccountLocale(allowed);
  useEventEnds(allowed);
  // push notifications on this device: checked on every start, a click opens their page
  usePushSync(allowed, token, navigate);
  useRoutineReminders(allowed);
  // reminders: loaded, live, handed to the Android app's alarm clock
  useReminders(allowed);
  // a lasting notification with the time while a focus session is on (features/session/focusNotification.js)
  useFocusNotification(allowed);
  useFocusTitle(allowed);
  // leaving the app during focus: counted, nudged, welcomed back (only where a screen turned off can be told apart)
  useFocusAway(allowed);
  useTabSwipe({ enabled: allowed });
  useSlidingActive();
  // phones: the on-screen keyboard's height, so sheets (the add form) stand above it
  useKeyboardInset();

  useEffect(() => { if (allowed) return preloadPages(); }, [allowed]);
}

// Quidey's own anonymous statistics: counting follows my answer (access.usageConsent). Declared before
// the page view below: effects run in order, so the first view finds counting already on. Nothing is
// decided before the server answered (a reload keeps its queue); sign-out and account switches switch it off themselves.
export function useUsage(allowed, access, pathname) {
  const usageOn = allowed && access.usageConsent.choice === 'granted';
  useEffect(() => { if (access.checked) setUsageEnabled(usageOn, access.userId); }, [access.checked, usageOn, access.userId]);
  // the pages by name: Android's Firebase analytics and Quidey's statistics, each with its own consent (usage/track.js)
  useEffect(() => { if (allowed) trackView(pathname); }, [allowed, pathname]);
  useAppOpen(usageOn);
  useActiveMinutes(usageOn);
}
