import styles from '../Together.module.css';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { fetchFriends } from '../../features/friends/friendsAction';
import { createSharedSession } from '../../features/together/togetherAction';
import { useTogetherRun } from '../../features/together/hooks';
import FriendPicker from './FriendPicker';

// Form to start a shared session: name + friends to invite.
// onStarted(session) is called with the new session (e.g. to open it).
export default function QuickStart({ onStarted, onCancel }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const run = useTogetherRun();
    const friends = useSelector(state => state.friends.friends);

    useEffect(() => {
        dispatch(fetchFriends()).catch(() => {});
    }, [dispatch]);

    const [name, setName] = useState('');
    const [invitees, setInvitees] = useState([]);
    const [creating, setCreating] = useState(false);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setCreating(true);
        let created = null;
        const ok = await run(async (dispatch) => { created = await dispatch(createSharedSession(name.trim(), invitees)); });
        setCreating(false);
        if (ok) {
            setName('');
            setInvitees([]);
            onStarted?.(created);
        }
    };

    return (
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
                {onCancel && <button type="button" className={styles.quietBtn} onClick={onCancel}>{t('cancel')}</button>}
                <button type="submit" className={styles.primaryBtn} disabled={creating || !name.trim()}>
                    {t('startSession')}
                </button>
            </div>
        </form>
    );
}
