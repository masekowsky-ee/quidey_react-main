import styles from './Social.module.css';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../i18n/useTranslation';
import { formatDate, displayName, fill } from '../features/helperFunction';
import ProfileAvatar from './profile/ProfileAvatar.jsx';
import { createSharedSession } from '../features/together/togetherAction';
import { useTogetherRun } from '../features/together/hooks';
import { setCustomError } from '../features/settings/settingsAction';
import {
    fetchFriends, fetchFriendRequests, sendFriendRequest,
    acceptFriendRequest, removeFriendRequest, removeFriend,
} from '../features/friends/friendsAction';

const TABS = ['friends', 'add', 'requests'];

// Translated message for an API error, using the error code the backend sends
function errorText(t, err) {
    const key = `friendError_${err?.code}`;
    const text = t(key);
    return text === key ? t('friendError_generic') : text;
}

// A person with a link to their profile (friends see all of it, others only the names)
function UserRow({ user, meta, children }) {
    return (
        <li className={styles.row}>
            <ProfileAvatar user={user} />
            <div className={styles.who}>
                <Link className={styles.name} to={`/u/${user.username}`}>{displayName(user)}</Link>
                <span className={styles.meta}>@{user.username}{meta && ` · ${meta}`}</span>
                {user.status && <span className={styles.status}>{user.status}</span>}
            </div>
            <div className={styles.actions}>{children}</div>
        </li>
    );
}

export default function Social() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { friends, incoming, outgoing } = useSelector(state => state.friends);
    const me = useSelector(state => state.auth.user);
    const homeLayout = useSelector(state => state.settings.homeLayout);
    const navigate = useNavigate();
    const runTogether = useTogetherRun();

    // one click from a friend to a shared session with them ("Ann & Ben")
    const workTogether = async (friend) => {
        setBusyId(friend.id);
        const myName = me?.display_name || me?.username || t('you');
        let created = null;
        const ok = await runTogether(async (dispatch) => {
            created = await dispatch(createSharedSession(fill(t('sessionWithFriend'), { me: myName, friend: displayName(friend) }), [friend.id]));
        }, 'toast_sessionStarted');
        setBusyId(null);
        if (!ok) return;
        if (homeLayout === 'team') {
            try { localStorage.setItem('teamSessionId', String(created.id)); } catch { /* opens the newest instead */ }
            navigate('/');
        } else {
            navigate(`/together/${created.id}`);
        }
    };

    const [searchParams, setSearchParams] = useSearchParams();
    const tab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'friends';
    const setTab = (next) => setSearchParams(next === 'friends' ? {} : { tab: next }, { replace: true });

    // which row is busy (button disabled) and which friend is waiting for "really remove?"
    const [busyId, setBusyId] = useState(null);
    const [confirmRemoveId, setConfirmRemoveId] = useState(null);

    // fresh lists whenever the page is opened
    useEffect(() => {
        dispatch(fetchFriends()).catch(() => {});
        dispatch(fetchFriendRequests()).catch(() => {});
    }, [dispatch]);

    const run = async (id, action) => {
        setBusyId(id);
        try {
            await dispatch(action);
        } catch (err) {
            dispatch(setCustomError({ bool: true, message: errorText(t, err) }));
        } finally {
            setBusyId(null);
        }
    };

    // ---------- add ----------
    const [username, setUsername] = useState('');
    const [sending, setSending] = useState(false);
    const [feedback, setFeedback] = useState(null); // { ok: boolean, text }

    const handleSend = async (e) => {
        e.preventDefault();
        const name = username.trim().replace(/^@/, '');
        if (!name) return;
        setSending(true);
        setFeedback(null);
        try {
            const status = await dispatch(sendFriendRequest(name));
            setFeedback({ ok: true, text: `${t(status === 'accepted' ? 'nowFriendsWith' : 'requestSentTo')} @${name}` });
            setUsername('');
        } catch (err) {
            setFeedback({ ok: false, text: errorText(t, err) });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className={styles.page}>
            <h1 className={styles.title}>{t('social')}</h1>

            <div className={styles.tabs} role="tablist" aria-label={t('social')}>
                {TABS.map(key => (
                    <button
                        key={key}
                        role="tab"
                        aria-selected={tab === key}
                        className={tab === key ? styles.tabActive : undefined}
                        onClick={() => setTab(key)}
                    >
                        {t({ friends: 'friends', add: 'addFriend', requests: 'friendRequests' }[key])}
                        {key === 'friends' && friends.length > 0 && <span className={styles.count}>{friends.length}</span>}
                        {key === 'requests' && incoming.length > 0 && <span className={styles.badge}>{incoming.length}</span>}
                    </button>
                ))}
            </div>

            {tab === 'friends' && (
                <section className={styles.card} role="tabpanel">
                    {friends.length === 0 ? (
                        <div className={styles.empty}>
                            <p>{t('noFriends')}</p>
                            <p className={styles.emptyHint}>{t('noFriendsHint')}</p>
                            <button className={styles.primaryBtn} onClick={() => setTab('add')}>{t('addFriend')}</button>
                        </div>
                    ) : (
                        <ul className={styles.list}>
                            {friends.map(friend => (
                                <UserRow key={friend.id} user={friend} meta={friend.since && `${t('friendsSince')} ${formatDate(friend.since)}`}>
                                    {confirmRemoveId === friend.id ? (
                                        <>
                                            <span className={styles.confirmText}>{t('confirmRemoveFriend')}</span>
                                            <button className={styles.dangerBtn} disabled={busyId === friend.id}
                                                onClick={() => run(friend.id, removeFriend(friend.id)).then(() => setConfirmRemoveId(null))}>
                                                {t('removeFriend')}
                                            </button>
                                            <button onClick={() => setConfirmRemoveId(null)}>{t('cancel')}</button>
                                        </>
                                    ) : (
                                        <>
                                            {/* one per friend, so outlined, not the page's primary */}
                                            <button className={styles.rowActionBtn} disabled={busyId === friend.id} onClick={() => workTogether(friend)}>
                                                {t('workTogether')}
                                            </button>
                                            <button className={`${styles.quietBtn} ${styles.revealBtn}`} onClick={() => setConfirmRemoveId(friend.id)}>{t('removeFriend')}</button>
                                        </>
                                    )}
                                </UserRow>
                            ))}
                        </ul>
                    )}
                </section>
            )}

            {tab === 'add' && (
                <section className={styles.card} role="tabpanel">
                    <form className={styles.addForm} onSubmit={handleSend}>
                        <label htmlFor="friendUsername" className={styles.label}>{t('userName')}</label>
                        <div className={styles.addRow}>
                            <input
                                id="friendUsername"
                                value={username}
                                onChange={(e) => { setUsername(e.target.value); setFeedback(null); }}
                                placeholder="@username"
                                autoComplete="off"
                                autoCapitalize="none"
                                spellCheck={false}
                            />
                            <button type="submit" className={styles.primaryBtn} disabled={sending || !username.trim()}>
                                {t('sendRequest')}
                            </button>
                            <button type="button" className={styles.quietBtn} disabled={!username.trim()}
                                onClick={() => navigate(`/u/${encodeURIComponent(username.trim().replace(/^@/, ''))}`)}>
                                {t('profileView')}
                            </button>
                        </div>
                        <p className={styles.hint}>{t('addFriendHint')}</p>
                        <p className={feedback ? (feedback.ok ? styles.success : styles.error) : styles.feedbackEmpty} role="status" aria-live="polite">
                            {feedback?.text}
                        </p>
                    </form>
                </section>
            )}

            {tab === 'requests' && (
                <>
                    <section className={styles.card} role="tabpanel">
                        <h2 className={styles.cardTitle}>{t('incomingRequests')}</h2>
                        {incoming.length === 0 ? <p className={styles.emptyLine}>{t('noRequests')}</p> : (
                            <ul className={styles.list}>
                                {incoming.map(request => (
                                    <UserRow key={request.id} user={request.user} meta={formatDate(request.createdAt)}>
                                        <button className={styles.acceptBtn} disabled={busyId === request.id}
                                            onClick={() => run(request.id, acceptFriendRequest(request.id))}>
                                            {t('accept')}
                                        </button>
                                        <button className={styles.quietBtn} disabled={busyId === request.id}
                                            onClick={() => run(request.id, removeFriendRequest(request.id))}>
                                            {t('decline')}
                                        </button>
                                    </UserRow>
                                ))}
                            </ul>
                        )}
                    </section>
                    <section className={styles.card}>
                        <h2 className={styles.cardTitle}>{t('outgoingRequests')}</h2>
                        {outgoing.length === 0 ? <p className={styles.emptyLine}>{t('noRequests')}</p> : (
                            <ul className={styles.list}>
                                {outgoing.map(request => (
                                    <UserRow key={request.id} user={request.user} meta={t('pending')}>
                                        <button className={styles.quietBtn} disabled={busyId === request.id}
                                            onClick={() => run(request.id, removeFriendRequest(request.id))}>
                                            {t('withdrawRequest')}
                                        </button>
                                    </UserRow>
                                ))}
                            </ul>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}
