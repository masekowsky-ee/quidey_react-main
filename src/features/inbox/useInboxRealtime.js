import { useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { displayName, fill } from '../helperFunction';
import { showToast } from '../toast/toast';
import { playSound } from '../settings/sound';
import { useRealtime } from '../realtime/socket';
import { REALTIME_RECONNECT, MESSAGE_NEW, NOTIFICATION_NEW, INBOX_READ } from '../realtime/events';
import { fetchInboxUnread, noticeView } from './inbox';
import { quietly } from '../api/quietly';

// App-wide: keeps the inbox badge current as messages and notices come in live, and tells me
// about them with a toast that opens the conversation (or the notices) on a click, unless I'm
// already looking at it.
export function useInboxRealtime() {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const location = useLocation();

    const refreshBadge = () => quietly(dispatch(fetchInboxUnread()));
    const onInbox = location.pathname === '/inbox';
    const params = new URLSearchParams(location.search);

    useRealtime(MESSAGE_NEW, ({ user, message } = {}) => {
        refreshBadge();
        if (!user || !message || message.fromMe) return;
        const reading = onInbox && Number(params.get('with')) === user.id;
        playSound('message');
        if (!reading) dispatch(showToast(fill(t('inboxLiveMessage'), { name: displayName(user) }), 'info',
            { to: `/inbox?with=${user.id}`, detail: message.body }));
    });
    // a notice that grows ("Ann added 3 entries") comes again with the same id: it pops up once
    const shown = useRef(new Set());
    useRealtime(NOTIFICATION_NEW, (notice) => {
        refreshBadge();
        const reading = onInbox && params.get('tab') === 'notices';
        if (!notice?.title || reading) return;
        if (shown.current.has(notice.id)) return;
        shown.current.add(notice.id);
        const view = noticeView(t, notice);
        playSound('notify');
        // a task given to me opens its session; a notice from the team the notices
        if (view.to) dispatch(showToast(view.title, 'info', { to: view.to, detail: view.body }));
        else dispatch(showToast(fill(t('inboxLiveNotice'), { title: view.title }), 'info', { to: '/inbox?tab=notices', detail: view.body }));
    });
    useRealtime(INBOX_READ, refreshBadge);
    useRealtime(REALTIME_RECONNECT, refreshBadge);
}
