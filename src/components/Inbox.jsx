import styles from './Inbox.module.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../i18n/useTranslation';
import { displayName, fill, formatDate, getInitials } from '../features/helperFunction';
import {
    fetchConversations, fetchConversation, sendMessage, fetchNotifications, markNotificationsRead,
    deleteNotification, fetchInboxUnread, markConversationRead, noticeView,
} from '../features/inbox/inbox';
import { REALTIME_RECONNECT, useRealtime } from '../features/realtime/socket';
import { acceptFriendRequest, removeFriendRequest, fetchFriends } from '../features/friends/friendsAction';
import { joinSharedSession, removeSharedMember } from '../features/together/togetherAction';
import { reminderAt } from '../features/tasks/reminders';
import { dateKey, taskStart, timeText } from '../features/calendar/calendar';
import { showToast } from '../features/toast/toast';
import TaskInvites from './task/TaskInvites.jsx';

const TABS = ['messages', 'requests', 'notices', 'reminders'];
const SEEN_DELAY_MS = 1500;
const REMINDER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const errorText = (t, err) => {
    const key = `inboxError_${err?.code}`;
    return t(key) !== key ? t(key) : t('friendError_generic');
};

function Avatar({ user }) {
    return <span className={styles.avatar} aria-hidden="true">{getInitials(displayName(user))}</span>;
}

// "14:05" today, otherwise the date
function useWhen() {
    const language = useSelector(state => state.settings.language);
    const locale = language === 'de' ? 'de-DE' : 'en-GB';
    return (value) => {
        const date = new Date(value);
        return date.toDateString() === new Date().toDateString()
            ? date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
            : date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    };
}

// ---------- messages ----------

function Conversations({ onOpen }) {
    const { t } = useTranslation();
    const when = useWhen();
    const friends = useSelector(state => state.friends.friends);
    const [conversations, setConversations] = useState(null);
    // the error itself; translated while rendering, so the effect doesn't depend on t
    const [error, setError] = useState(null);

    const load = useCallback(() => fetchConversations().then(setConversations).catch(setError), []);
    useEffect(() => { load(); }, [load]);
    // new messages move their conversation to the top, read ones lose their count
    useRealtime('message:new', load);
    useRealtime('inbox:read', load);
    useRealtime(REALTIME_RECONNECT, load);

    // friends I haven't written with yet, to start a conversation
    const talkedTo = new Set((conversations ?? []).map(c => c.user.id));
    const others = friends.filter(friend => !talkedTo.has(friend.id));

    if (error) return <p className={styles.error}>{errorText(t, error)}</p>;
    if (!conversations) return <p className={styles.empty} aria-busy="true">{t('loading')}</p>;

    return (
        <>
            {conversations.length === 0
                ? <p className={styles.empty}>{t('inboxNoMessages')}</p>
                : (
                    <ul className={styles.list}>
                        {conversations.map(({ user, lastMessage, unread }) => (
                            <li key={user.id}>
                                <button className={styles.row} onClick={() => onOpen(user.id)}>
                                    <Avatar user={user} />
                                    <span className={styles.rowText}>
                                        <span className={styles.rowTitle}>{displayName(user)}</span>
                                        <span className={`${styles.rowMeta} ${unread ? styles.unreadText : ''}`}>
                                            {lastMessage.fromMe && `${t('inboxYou')}: `}{lastMessage.body}
                                        </span>
                                    </span>
                                    <span className={styles.rowSide}>
                                        <span className={styles.rowMeta}>{when(lastMessage.createdAt)}</span>
                                        {unread > 0 && <span className={styles.badge}>{unread}</span>}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            <div className={styles.newChat}>
                <h3 className={styles.subTitle}>{t('inboxNewMessage')}</h3>
                {friends.length === 0
                    ? <p className={styles.empty}>{t('inboxNoFriends')} <Link to="/social?tab=add">{t('addFriend')}</Link></p>
                    : (
                        <div className={styles.chips}>
                            {(others.length > 0 ? others : friends).map(friend => (
                                <button key={friend.id} className={styles.chip} onClick={() => onOpen(friend.id)}>
                                    <Avatar user={friend} />{displayName(friend)}
                                </button>
                            ))}
                        </div>
                    )}
            </div>
        </>
    );
}

function Thread({ userId, onBack }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const when = useWhen();
    const [thread, setThread] = useState(null);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);
    const endRef = useRef(null);

    const load = useCallback(() => fetchConversation(userId)
        .then(data => { setThread(data); dispatch(fetchInboxUnread()).catch(() => {}); })
        .catch(setError), [userId, dispatch]);

    useEffect(() => { load(); }, [load]);

    // the same message can come back from sending and over the socket: keep it once
    const addMessage = (message) => setThread(prev => (
        !prev || prev.messages.some(m => m.id === message.id) ? prev : { ...prev, messages: [...prev.messages, message] }
    ));

    // new messages show up live while the conversation is open, and count as read
    useRealtime('message:new', ({ user, message } = {}) => {
        if (user?.id !== userId || !message) return;
        addMessage(message);
        if (!message.fromMe) markConversationRead(userId).catch(() => {});
    });
    // whatever came while the connection was down
    useRealtime(REALTIME_RECONNECT, load);

    const count = thread?.messages.length ?? 0;
    useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end' }); }, [count]);

    const send = async (e) => {
        e.preventDefault();
        const body = text.trim();
        if (!body) return;
        setSending(true);
        setError(null);
        try {
            addMessage(await sendMessage(userId, body));
            setText('');
        } catch (err) {
            setError(err);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className={styles.thread}>
            <div className={styles.threadHead}>
                <button className={styles.backBtn} onClick={onBack} aria-label={t('back')}>←</button>
                {thread && <><Avatar user={thread.user} /><h2 className={styles.threadName}>{displayName(thread.user)}</h2></>}
            </div>
            {!thread && !error && <p className={styles.empty} aria-busy="true">{t('loading')}</p>}
            {thread && (
                <ol className={styles.messages} aria-live="polite">
                    {thread.messages.length === 0 && <li className={styles.empty}>{t('inboxSayHello')}</li>}
                    {thread.messages.map(message => (
                        <li key={message.id} className={`${styles.bubble} ${message.fromMe ? styles.mine : ''}`}>
                            <span className={styles.bubbleText}>{message.body}</span>
                            <span className={styles.bubbleTime}>{when(message.createdAt)}</span>
                        </li>
                    ))}
                    <li ref={endRef} aria-hidden="true" />
                </ol>
            )}
            {error && <p className={styles.error} role="alert">{errorText(t, error)}</p>}
            {thread && (thread.canWrite ? (
                <form className={styles.compose} onSubmit={send}>
                    <textarea value={text} maxLength={2000} rows={2} placeholder={t('inboxWrite')} aria-label={t('inboxWrite')}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) send(e); }} />
                    <button type="submit" className={styles.sendBtn} disabled={sending || !text.trim()}>{t('inboxSend')}</button>
                </form>
            ) : <p className={styles.empty}>{t('inboxError_NOT_FRIENDS')}</p>)}
        </div>
    );
}

// ---------- requests ----------

function Requests() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const incoming = useSelector(state => state.friends.incoming);
    const invites = useSelector(state => state.together.invites);
    const taskInviteCount = useSelector(state => state.task.invites.length);
    const [busy, setBusy] = useState(null);

    const run = async (key, action, success) => {
        setBusy(key);
        try {
            await dispatch(action);
            if (success) success();
        } catch (err) {
            dispatch(showToast(errorText(t, err), 'error'));
        } finally {
            setBusy(null);
        }
    };

    if (incoming.length === 0 && invites.length === 0 && taskInviteCount === 0) {
        return <p className={styles.empty}>{t('inboxNoRequests')}</p>;
    }

    return (
        <>
            {incoming.length > 0 && (
                <section>
                    <h3 className={styles.subTitle}>{t('friendRequests')}</h3>
                    <ul className={styles.list}>
                        {incoming.map(request => (
                            <li key={request.id} className={styles.row}>
                                <Avatar user={request.user} />
                                <span className={styles.rowText}>
                                    <span className={styles.rowTitle}>{displayName(request.user)}</span>
                                    <span className={styles.rowMeta}>@{request.user.username} · {formatDate(request.createdAt)}</span>
                                </span>
                                <span className={styles.actions}>
                                    <button className={styles.primaryBtn} disabled={busy === `f${request.id}`}
                                        onClick={() => run(`f${request.id}`, acceptFriendRequest(request.id))}>{t('accept')}</button>
                                    <button className={styles.quietBtn} disabled={busy === `f${request.id}`}
                                        onClick={() => run(`f${request.id}`, removeFriendRequest(request.id))}>{t('decline')}</button>
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
            {invites.length > 0 && (
                <section>
                    <h3 className={styles.subTitle}>{t('sessionInvites')}</h3>
                    <ul className={styles.list}>
                        {invites.map(invite => (
                            <li key={invite.id} className={styles.row}>
                                <span className={styles.avatar} aria-hidden="true">◎</span>
                                <span className={styles.rowText}>
                                    <span className={styles.rowTitle}>{invite.name}</span>
                                    <span className={styles.rowMeta}>{t('invitedBy')} {displayName(invite.invitedBy ?? invite.owner)}</span>
                                </span>
                                <span className={styles.actions}>
                                    <button className={styles.primaryBtn} disabled={busy === `s${invite.id}`}
                                        onClick={() => run(`s${invite.id}`, joinSharedSession(invite.id), () => navigate(`/together/${invite.id}`))}>{t('join')}</button>
                                    <button className={styles.quietBtn} disabled={busy === `s${invite.id}`}
                                        onClick={() => run(`s${invite.id}`, removeSharedMember(invite.id, 'me', 'me'))}>{t('decline')}</button>
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
            {taskInviteCount > 0 && <TaskInvites />}
        </>
    );
}

// ---------- notices ----------

function Notices() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const when = useWhen();
    const [notices, setNotices] = useState(null);
    const [error, setError] = useState(null);
    const seenTimer = useRef(null);

    // seen once the tab is open for a moment
    const markSeenSoon = useCallback(() => {
        clearTimeout(seenTimer.current);
        seenTimer.current = setTimeout(() => markNotificationsRead()
            .then(() => dispatch(fetchInboxUnread()))
            .catch(() => {}), SEEN_DELAY_MS);
    }, [dispatch]);

    const load = useCallback(() => fetchNotifications()
        .then(list => {
            setNotices(list);
            if (list.some(n => !n.readAt)) markSeenSoon();
        })
        .catch(setError), [markSeenSoon]);

    useEffect(() => {
        load();
        return () => clearTimeout(seenTimer.current);
    }, [load]);

    // a new notice from the team shows up on top right away
    useRealtime('notification:new', (notice) => {
        if (!notice?.id) return;
        setNotices(prev => (!prev || prev.some(n => n.id === notice.id) ? prev : [notice, ...prev]));
        markSeenSoon();
    });
    useRealtime(REALTIME_RECONNECT, load);

    const remove = async (id) => {
        try {
            await deleteNotification(id);
            setNotices(prev => prev.filter(n => n.id !== id));
            dispatch(fetchInboxUnread()).catch(() => {});
        } catch (err) {
            dispatch(showToast(errorText(t, err), 'error'));
        }
    };

    if (error) return <p className={styles.error}>{errorText(t, error)}</p>;
    if (!notices) return <p className={styles.empty} aria-busy="true">{t('loading')}</p>;
    if (notices.length === 0) return <p className={styles.empty}>{t('inboxNoNotices')}</p>;

    return (
        <ul className={styles.list}>
            {notices.map(notice => {
                const view = noticeView(t, notice);
                return (
                    <li key={notice.id} className={`${styles.notice} ${notice.readAt ? '' : styles.noticeNew}`}>
                        <div className={styles.noticeHead}>
                            {view.to
                                ? <Link to={view.to} className={styles.rowTitle}>{view.title}</Link>
                                : <span className={styles.rowTitle}>{view.title}</span>}
                            <span className={styles.rowMeta}>{notice.kind === 'broadcast' ? t('inboxFromTeam') : ''} {when(notice.createdAt)}</span>
                            <button className={styles.deleteBtn} onClick={() => remove(notice.id)} aria-label={`${t('delete')}: ${view.title}`}>✕</button>
                        </div>
                        <p className={styles.noticeBody}>{view.body}</p>
                    </li>
                );
            })}
        </ul>
    );
}

// ---------- reminders (worked out from the tasks) ----------

function Reminders() {
    const { t } = useTranslation();
    const tasks = useSelector(state => state.task.tasks);
    const when = useWhen();
    // read the clock once per visit of the tab
    const [now] = useState(() => Date.now());

    const withReminder = tasks
        .map(task => ({ task, at: reminderAt(task), start: taskStart(task) }))
        .filter(({ at }) => at);
    const due = withReminder.filter(({ at, start }) => at.getTime() <= now && start.getTime() > now - REMINDER_WINDOW_MS)
        .sort((a, b) => b.at - a.at);
    const coming = withReminder.filter(({ at }) => at.getTime() > now && at.getTime() <= now + REMINDER_WINDOW_MS)
        .sort((a, b) => a.at - b.at);

    if (due.length === 0 && coming.length === 0) return <p className={styles.empty}>{t('inboxNoReminders')}</p>;

    const item = ({ task, at, start }) => {
        const key = dateKey(task.due);
        return (
            <li key={task.id} className={styles.row}>
                <span className={styles.avatar} aria-hidden="true">⏰</span>
                <span className={styles.rowText}>
                    <Link to={`/calendar?date=${key}&day=${key}`} className={styles.rowTitle}>{task.name}</Link>
                    <span className={styles.rowMeta}>
                        {fill(t('inboxReminderLine'), {
                            day: formatDate(task.due),
                            time: timeText(start.getHours() * 60 + start.getMinutes()),
                            remind: when(at),
                        })}
                    </span>
                </span>
            </li>
        );
    };

    return (
        <>
            {due.length > 0 && <section><h3 className={styles.subTitle}>{t('inboxRemindersDue')}</h3><ul className={styles.list}>{due.map(item)}</ul></section>}
            {coming.length > 0 && <section><h3 className={styles.subTitle}>{t('inboxRemindersComing')}</h3><ul className={styles.list}>{coming.map(item)}</ul></section>}
        </>
    );
}

// ---------- the page ----------

export default function Inbox() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [searchParams, setSearchParams] = useSearchParams();
    const tab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'messages';
    const openWith = Number(searchParams.get('with')) || null;

    const unread = useSelector(state => state.inbox);
    const requestCount = useSelector(state =>
        state.friends.incoming.length + state.together.invites.length + state.task.invites.length);

    // the friends (to write to) are otherwise only loaded on the Social page
    useEffect(() => {
        dispatch(fetchInboxUnread()).catch(() => {});
        dispatch(fetchFriends()).catch(() => {});
    }, [dispatch]);

    const go = (next, extra = {}) => setSearchParams(next === 'messages' && !extra.with ? {} : { tab: next, ...extra }, { replace: !extra.with });
    const counts = { messages: unread.messages, requests: requestCount, notices: unread.notifications, reminders: 0 };

    return (
        <div className={styles.page}>
            <h1 className={styles.title}>{t('inbox')}</h1>
            <div className={styles.tabs} role="tablist" aria-label={t('inbox')}>
                {TABS.map(key => (
                    <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? styles.tabActive : undefined}
                        onClick={() => go(key)}>
                        {t(`inboxTab_${key}`)}
                        {counts[key] > 0 && <span className={styles.badge}>{counts[key]}</span>}
                    </button>
                ))}
            </div>
            <section className={styles.card} role="tabpanel" aria-label={t(`inboxTab_${tab}`)}>
                {tab === 'messages' && (openWith
                    ? <Thread key={openWith} userId={openWith} onBack={() => go('messages')} />
                    : <Conversations onOpen={(id) => go('messages', { with: String(id) })} />)}
                {tab === 'requests' && <Requests />}
                {tab === 'notices' && <Notices />}
                {tab === 'reminders' && <Reminders />}
            </section>
        </div>
    );
}
