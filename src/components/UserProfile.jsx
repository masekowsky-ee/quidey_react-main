import styles from './profile/ProfileParts.module.css';
import { COMMUNITY_PATHS } from '../features/community/paths';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useTranslation } from '../i18n/useTranslation';
import { displayName, fill } from '../features/helperFunction';
import { fetchProfile, profileColorAttr } from '../features/profile/profileOptions';
import { sendFriendRequest, acceptFriendRequest, removeFriendRequest } from '../features/friends/friendsAction';
import { setCustomError } from '../features/settings/settingsAction';
import ProfileCard from './profile/ProfileCard.jsx';
import ProfileStats from './profile/ProfileStats.jsx';
import ProfileAvatar from './profile/ProfileAvatar.jsx';
import { Bone, Skeleton } from './skeleton/Skeleton.jsx';

// Translated message for a friends API error, using the error code the backend sends
function errorText(t, err) {
    const key = `friendError_${err?.code}`;
    const text = t(key);
    return text === key ? t('friendError_generic') : text;
}

// Somebody else's profile (/u/:username). Everybody sees name and username; friends see the
// whole profile, mutual friends and (unless hidden) the statistics.
export default function UserProfile() {
    const { t } = useTranslation();
    const { username } = useParams();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    // what was loaded, and for whom: another username shows "loading" until its profile is there
    const [state, setState] = useState({ username: null, status: 'loading', profile: null });
    const [busy, setBusy] = useState(false);

    // bumped after a friend request, so the profile loads again
    const [version, setVersion] = useState(0);

    useEffect(() => {
        let current = true;
        fetchProfile(username)
            .then(profile => { if (current) setState({ username, status: 'ready', profile }); })
            .catch(err => {
                if (current) setState({ username, status: err?.code === 'USER_NOT_FOUND' ? 'missing' : 'error', profile: null });
            });
        return () => { current = false; };
    }, [username, version]);

    // a friend request from here; the profile loads again, so a new friend shows everything at once
    const run = async (action) => {
        setBusy(true);
        try {
            await dispatch(action);
            setVersion(v => v + 1);
        } catch (err) {
            dispatch(setCustomError({ bool: true, message: errorText(t, err) }));
        } finally {
            setBusy(false);
        }
    };

    const { profile } = state;
    const status = state.username === username ? state.status : 'loading';
    if (status === 'ready' && profile.relation === 'self') return <Navigate to="/profile" replace />;

    // the profile card's shape: banner, avatar over its edge, name, handle, a few lines
    if (status === 'loading') {
        return (
            <Skeleton className={styles.page}>
                <div className={styles.pageTop} />
                <section className={styles.card}>
                    <div className={styles.banner} data-banner="none" />
                    <div className={styles.body}>
                        <div className={styles.top}><Bone round w="5.5rem" style={{ boxShadow: '0 0 0 4px var(--surface)' }} /></div>
                        <Bone w="11rem" h="1.375rem" style={{ marginTop: '0.25rem' }} />
                        <Bone w="7rem" />
                        <Bone w="85%" style={{ marginTop: '0.5rem' }} />
                        <Bone w="60%" />
                    </div>
                </section>
            </Skeleton>
        );
    }

    if (status !== 'ready') {
        return (
            <div className={styles.page}>
                <div className={styles.pageTop} />
                <p className={styles.notice} role="alert">
                    {t({ missing: 'profileNotFound', error: 'profileLoadError' }[status])}
                </p>
                <Link to={COMMUNITY_PATHS.friends}>{t('profileBackToFriends')}</Link>
            </div>
        );
    }

    const friend = profile.relation === 'friend';
    const name = displayName(profile);

    let actions;
    if (friend) {
        actions = (
            <button className={styles.primaryBtn} onClick={() => navigate(`/inbox?with=${profile.id}`)}>
                {t('profileMessage')}
            </button>
        );
    } else if (profile.relation === 'incoming') {
        actions = (
            <>
                <button className={styles.primaryBtn} disabled={busy} onClick={() => run(acceptFriendRequest(profile.requestId))}>{t('accept')}</button>
                <button disabled={busy} onClick={() => run(removeFriendRequest(profile.requestId))}>{t('decline')}</button>
            </>
        );
    } else if (profile.relation === 'outgoing') {
        actions = (
            <button disabled={busy} onClick={() => run(removeFriendRequest(profile.requestId))}>{t('profileWithdraw')}</button>
        );
    } else {
        actions = (
            <button className={styles.primaryBtn} disabled={busy} onClick={() => run(sendFriendRequest(profile.username))}>
                {t('profileAddFriend')}
            </button>
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.pageTop} />
            <ProfileCard profile={profile} limited={!friend} heading="h1">{actions}</ProfileCard>

            {!friend && (
                <p className={styles.locked}>
                    <span aria-hidden="true">🔒</span>
                    {fill(t(profile.relation === 'outgoing' ? 'profileLockedPending' : 'profileLocked'), { name })}
                </p>
            )}

            {friend && profile.mutualFriendCount > 0 && (
                <section className={styles.mutual}>
                    <h2>{fill(t('profileMutualFriends'), { n: profile.mutualFriendCount })}</h2>
                    <ul className={styles.people}>
                        {profile.mutualFriends.map(person => (
                            <li key={person.id}>
                                <Link className={styles.person} to={`/u/${person.username}`}>
                                    <ProfileAvatar user={person} />
                                    {displayName(person)}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {friend && (profile.stats
                ? <ProfileStats stats={profile.stats} title={fill(t('profileStatsOf'), { name })} colorAttr={profileColorAttr(profile)} />
                : <p className={styles.notice}>{fill(t('profileStatsHidden'), { name })}</p>)}
        </div>
    );
}
