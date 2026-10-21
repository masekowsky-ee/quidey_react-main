import { useDispatch, useStore } from 'react-redux';
import { fetchFriends, fetchFriendRequests } from '../friends/friendsAction';
import { fetchSharedSessions, fetchMySharedTasks } from '../together/togetherAction';
import { refreshTasks, fetchTaskInvites } from '../tasks/taskAction';
import { showToast } from '../toast/toast';
import { displayName, fill } from '../helperFunction';
import { useTranslation } from '../../i18n/useTranslation';
import { markNews } from './news';
import { useRealtime, useRealtimeRefresh } from './socket';

// what's in `after` but wasn't in `before` (by id)
const added = (before = [], after = []) => {
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
        for (const request of added(before.incoming, after.incoming)) {
            popup(fill(t('liveFriendRequest'), { name: displayName(request.user) }), '/social?tab=requests');
        }
        const newFriends = added(before.friends, after.friends);
        for (const friend of newFriends) popup(fill(t('liveNewFriend'), { name: displayName(friend) }), '/social');
        if (newFriends.length > 0 || (after.friends?.length ?? 0) < (before.friends?.length ?? 0)) dispatch(markNews('social'));
    });
    useRealtimeRefresh(['invites:changed', 'session:changed'], async () => {
        const before = store.getState().together;
        await Promise.all([quietly(fetchSharedSessions()),
            // the running sessions' tasks in the solo view
            quietly(fetchMySharedTasks())]);
        const after = store.getState().together;
        for (const invite of added(before.invites, after.invites)) {
            popup(fill(t('liveSessionInvite'), { name: displayName(invite.invitedBy ?? invite.owner) }), '/together', invite.name);
        }
    });
    // something happened in one of my sessions (tasks, members, who works on what)
    useRealtime('session:changed', () => dispatch(markNews('together')));
    useRealtimeRefresh(['tasks:changed'], async () => {
        const before = store.getState().task.invites;
        await Promise.all([quietly(refreshTasks()), quietly(fetchTaskInvites())]);
        for (const invite of added(before, store.getState().task.invites)) {
            popup(fill(t('liveTaskInvite'), { name: displayName(invite.from) }), '/calendar', invite.task?.name);
        }
    });
}
