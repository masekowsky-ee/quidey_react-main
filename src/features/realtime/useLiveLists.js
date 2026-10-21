import { useDispatch, useStore } from 'react-redux';
import { fetchFriends, fetchFriendRequests } from '../friends/friendsAction';
import { fetchSharedSessions, fetchMySharedTasks } from '../together/togetherAction';
import { refreshTasks, fetchTaskInvites } from '../tasks/taskAction';
import { showToast } from '../toast/toast';
import { displayName, fill } from '../helperFunction';
import { useTranslation } from '../../i18n/useTranslation';
import { markNews } from './news';
import { useRealtime, useRealtimeRefresh } from './socket';

// what's in `after` but wasn't in `before` (by id). Nothing when `before` was never loaded:
// after a reconnect (e.g. the server restarted) the first load would otherwise announce every
// friend and request as new.
const added = (before = [], after = [], loadedBefore = true) => {
    if (!loadedBefore) return [];
    const known = new Set(before.map(item => item.id));
    return after.filter(item => !known.has(item.id));
};

// App-wide: the lists behind the badges and pages load again when the server says they changed
// (friend requests, session invites and sessions, tasks shared with me), once per burst.
// Whatever is new for me comes with a toast that opens it; other changes (a friend accepted,
// something happened in one of my sessions) put a dot on the menu entry (see news.js).
// App's once-a-minute refresh stays as the safety net.
export function useLiveLists() {
    const dispatch = useDispatch();
    const store = useStore();
    const { t } = useTranslation();
    const quietly = (action) => dispatch(action).catch(() => {});
    const popup = (text, to, detail) => dispatch(showToast(text, 'info', { to, detail }));

    useRealtimeRefresh(['friends:changed'], async () => {
        const before = store.getState().friends;
        await Promise.all([quietly(fetchFriendRequests()), quietly(fetchFriends())]);
        const after = store.getState().friends;
        for (const request of added(before.incoming, after.incoming, before.requestsLoaded)) {
            popup(fill(t('liveFriendRequest'), { name: displayName(request.user) }), '/social?tab=requests');
        }
        const newFriends = added(before.friends, after.friends, before.friendsLoaded);
        for (const friend of newFriends) popup(fill(t('liveNewFriend'), { name: displayName(friend) }), '/social');
        if (newFriends.length > 0 || (before.friendsLoaded && after.friends.length < before.friends.length)) dispatch(markNews('social'));
    });
    useRealtimeRefresh(['invites:changed', 'session:changed'], async () => {
        const before = store.getState().together;
        await Promise.all([quietly(fetchSharedSessions()),
            // the running sessions' tasks in the solo view
            quietly(fetchMySharedTasks())]);
        const after = store.getState().together;
        for (const invite of added(before.invites, after.invites, before.listLoaded)) {
            popup(fill(t('liveSessionInvite'), { name: displayName(invite.invitedBy ?? invite.owner) }), '/together', invite.name);
        }
    });
    // something happened in one of my sessions (tasks, members, who works on what)
    useRealtime('session:changed', () => dispatch(markNews('together')));
    useRealtimeRefresh(['tasks:changed'], async () => {
        const { invites: before, invitesLoaded } = store.getState().task;
        await Promise.all([quietly(refreshTasks()), quietly(fetchTaskInvites())]);
        for (const invite of added(before, store.getState().task.invites, invitesLoaded)) {
            popup(fill(t('liveTaskInvite'), { name: displayName(invite.from) }), '/calendar', invite.task?.name);
        }
    });
}
