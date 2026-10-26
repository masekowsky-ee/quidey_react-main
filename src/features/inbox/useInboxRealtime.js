import { useDispatch } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { displayName, fill } from '../helperFunction';
import { showToast } from '../toast/toast';
import { playSound } from '../settings/sound';
import { REALTIME_RECONNECT, useRealtime } from '../realtime/socket';
import { fetchInboxUnread, noticeView } from './inbox';

// App-wide: keeps the inbox badge current as messages and notices come in live, and tells me
// about them with a toast that opens the conversation (or the notices) on a click, unless I'm
// already looking at it.
export function useInboxRealtime() {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const location = useLocation();

    const refreshBadge = () => dispatch(fetchInboxUnread()).catch(() => {});
    const onInbox = location.pathname === '/inbox';
    const params = new URLSearchParams(location.search);

    useRealtime('message:new', ({ user, message } = {}) => {
        refreshBadge();
        if (!user || !message || message.fromMe) return;
        const reading = onInbox && Number(params.get('with')) === user.id;
        playSound('message');
        if (!reading) dispatch(showToast(fill(t('inboxLiveMessage'), { name: displayName(user) }), 'info',
            { to: `/inbox?with=${user.id}`, detail: message.body }));
    });
    useRealtime('notification:new', (notice) => {
        refreshBadge();
        const reading = onInbox && params.get('tab') === 'notices';
        if (!notice?.title || reading) return;
        const view = noticeView(t, notice);
        playSound('notify');
        // a task given to me opens its session; a notice from the team the notices
        if (view.to) dispatch(showToast(view.title, 'info', { to: view.to, detail: view.body }));
        else dispatch(showToast(fill(t('inboxLiveNotice'), { title: view.title }), 'info', { to: '/inbox?tab=notices', detail: view.body }));
    });
    useRealtime('inbox:read', refreshBadge);
    useRealtime(REALTIME_RECONNECT, refreshBadge);
}
