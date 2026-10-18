import styles from './Together.module.css';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../i18n/useTranslation';
import { formatDate, formatDuration, getInitials, displayName } from '../features/helperFunction';
import { setCustomError } from '../features/settings/settingsAction';
import { fetchFriends } from '../features/friends/friendsAction';
import {
    fetchSharedSessions, createSharedSession, joinSharedSession, removeSharedMember, togetherErrorText,
} from '../features/together/togetherAction';

// Friends as toggle chips, for choosing who to invite
export function FriendPicker({ friends, selected, onChange }) {
    const toggle = (id) => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
    return (
        <ul className={styles.chips}>
            {friends.map(friend => (
                <li key={friend.id}>
                    <button
                        type="button"
                        className={selected.includes(friend.id) ? styles.chipOn : styles.chip}
                        aria-pressed={selected.includes(friend.id)}
                        onClick={() => toggle(friend.id)}
                    >
                        <span className={styles.chipAvatar} aria-hidden="true">{getInitials(displayName(friend))}</span>
                        {displayName(friend)}
                    </button>
                </li>
            ))}
        </ul>
    );
}

function SessionRow({ session, t }) {
    return (
        <li>
            <Link to={`/together/${session.id}`} className={styles.sessionLink}>
                <div className={styles.who}>
                    <span className={styles.name}>{session.name}</span>
                    <span className={styles.meta}>
                        {session.endedAt
                            ? `${t('endedOn')} ${formatDate(session.endedAt)}`
                            : `${displayName(session.owner)} · ${session.memberCount} ${t(session.memberCount === 1 ? 'member' : 'members')}`}
                    </span>
                </div>
                {session.workingCount > 0 && (
                    <span className={styles.live}><span className={styles.liveDot} />{session.workingCount} {t('workingNow')}</span>
                )}
                <div className={styles.times}>
                    <span className={styles.timeMain}>{formatDuration(session.myMs)}</span>
                    <span className={styles.meta}>{t('ofTotal')} {formatDuration(session.totalMs)}</span>
                </div>
            </Link>
        </li>
    );
}

export default function Together() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { sessions, invites } = useSelector(state => state.together);
    const friends = useSelector(state => state.friends.friends);

    useEffect(() => {
        dispatch(fetchSharedSessions()).catch(() => {});
        dispatch(fetchFriends()).catch(() => {});
    }, [dispatch]);

    const showError = (err) => dispatch(setCustomError({ bool: true, message: togetherErrorText(t, err) }));

    // ---------- start ----------
    const [name, setName] = useState('');
    const [invitees, setInvitees] = useState([]);
    const [creating, setCreating] = useState(false);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setCreating(true);
        try {
            const session = await dispatch(createSharedSession(name.trim(), invitees));
            navigate(`/together/${session.id}`);
        } catch (err) {
            showError(err);
            setCreating(false);
        }
    };

    // ---------- invites ----------
    const [busyId, setBusyId] = useState(null);

    const handleJoin = async (id) => {
        setBusyId(id);
        try {
            await dispatch(joinSharedSession(id));
            navigate(`/together/${id}`);
        } catch (err) {
            showError(err);
            dispatch(fetchSharedSessions()).catch(() => {});
            setBusyId(null);
        }
    };

    const handleDecline = async (invite) => {
        setBusyId(invite.id);
        try {
            // my id isn't known here; declining is "remove me", which the server reads from the token
            await dispatch(removeSharedMember(invite.id, 'me', 'me'));
        } catch (err) {
            showError(err);
        } finally {
            setBusyId(null);
        }
    };

    const open = sessions.filter(s => !s.endedAt);
    const past = sessions.filter(s => s.endedAt);

    return (
        <div className={styles.page}>
            <h1 className={styles.title}>{t('together')}</h1>
            <p className={styles.intro}>{t('togetherIntro')}</p>

            {invites.length > 0 && (
                <section className={styles.card}>
                    <h2 className={styles.cardTitle}>{t('sessionInvites')}</h2>
                    <ul className={styles.list}>
                        {invites.map(invite => (
                            <li key={invite.id} className={styles.row}>
                                <div className={styles.avatar} aria-hidden="true">{getInitials(displayName(invite.invitedBy ?? invite.owner))}</div>
                                <div className={styles.who}>
                                    <span className={styles.name}>{invite.name}</span>
                                    <span className={styles.meta}>
                                        {t('invitedBy')} {displayName(invite.invitedBy ?? invite.owner)} · {invite.memberCount} {t(invite.memberCount === 1 ? 'member' : 'members')}
                                    </span>
                                </div>
                                <div className={styles.actions}>
                                    <button className={styles.acceptBtn} disabled={busyId === invite.id} onClick={() => handleJoin(invite.id)}>
                                        {t('join')}
                                    </button>
                                    <button className={styles.quietBtn} disabled={busyId === invite.id} onClick={() => handleDecline(invite)}>
                                        {t('decline')}
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <section className={styles.card}>
                <h2 className={styles.cardTitle}>{t('startSharedSession')}</h2>
                <form className={styles.form} onSubmit={handleCreate}>
                    <label htmlFor="sharedSessionName" className={styles.label}>{t('sessionName')}</label>
                    <input
                        id="sharedSessionName"
                        value={name}
                        maxLength={100}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t('sessionNamePlaceholder')}
                        autoComplete="off"
                    />
                    <span className={styles.label}>{t('inviteFriends')}</span>
                    {friends.length > 0
                        ? <FriendPicker friends={friends} selected={invitees} onChange={setInvitees} />
                        : <p className={styles.hint}>{t('noFriendsToInvite')} <Link to="/social?tab=add">{t('addFriend')}</Link></p>}
                    <div className={styles.formActions}>
                        <button type="submit" className={styles.primaryBtn} disabled={creating || !name.trim()}>
                            {t('startSession')}
                        </button>
                    </div>
                </form>
            </section>

            <section className={styles.card}>
                <h2 className={styles.cardTitle}>{t('openSessions')}</h2>
                {open.length === 0
                    ? <p className={styles.emptyLine}>{t('noOpenSessions')}</p>
                    : <ul className={styles.list}>{open.map(s => <SessionRow key={s.id} session={s} t={t} />)}</ul>}
            </section>

            {past.length > 0 && (
                <section className={styles.card}>
                    <h2 className={styles.cardTitle}>{t('pastSessions')}</h2>
                    <ul className={styles.list}>{past.map(s => <SessionRow key={s.id} session={s} t={t} />)}</ul>
                </section>
            )}
        </div>
    );
}
