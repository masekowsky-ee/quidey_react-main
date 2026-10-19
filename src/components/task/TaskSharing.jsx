import styles from './TaskOptions.module.css';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { displayName, fill, getInitials } from '../../features/helperFunction';
import { useFriends } from '../../features/friends/useFriends';
import { shareTask, unshareTask } from '../../features/tasks/taskAction';
import { showToast } from '../../features/toast/toast';
import FriendPicker from '../together/FriendPicker.jsx';

// Who a task is shared with. The owner invites friends and can take it back from anybody;
// somebody it was shared with sees who it's from.
export default function TaskSharing({ task }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const friends = useFriends();
    const [selected, setSelected] = useState([]);
    const [busy, setBusy] = useState(false);

    const shares = task.sharedWith ?? [];
    const failed = () => dispatch(showToast(t('friendError_generic'), 'error'));

    if (!task.isOwner && task.owner) {
        return (
            <div className={styles.sharing}>
                <p className={styles.sharedHint}>{fill(t('sharedTaskHint'), { name: displayName(task.owner) })}</p>
                <ShareList shares={shares} />
            </div>
        );
    }

    const available = friends.filter(friend => !shares.some(share => share.user.id === friend.id));

    const invite = async () => {
        if (selected.length === 0) return;
        setBusy(true);
        try {
            await dispatch(shareTask(task.id, selected));
            setSelected([]);
            dispatch(showToast(t('shareInviteSent'), 'success'));
        } catch {
            failed();
        } finally {
            setBusy(false);
        }
    };

    const remove = (share) => dispatch(unshareTask(task.id, share.shareId)).catch(failed);

    return (
        <div className={styles.sharing}>
            <span className={styles.sectionLabel}>{t('shareWithFriends')}</span>
            <ShareList shares={shares} onRemove={remove} />
            {available.length > 0 &&
                <div className={styles.inviteRow}>
                    <FriendPicker friends={available} selected={selected} onChange={setSelected} />
                    <button type="button" className={styles.inviteBtn} onClick={invite} disabled={selected.length === 0 || busy}>
                        {t('shareInvite')}
                    </button>
                </div>}
            {friends.length === 0 &&
                <p className={styles.hint}>{t('noFriendsToShare')} <Link to="/social">{t('findFriends')} →</Link></p>}
        </div>
    );
}

// The people a task was sent to, "invited" until they accept
function ShareList({ shares, onRemove }) {
    const { t } = useTranslation();
    if (shares.length === 0) return null;
    return (
        <ul className={styles.shareList} aria-label={t('sharedWithLabel')}>
            {shares.map(share => (
                <li key={share.shareId} className={share.status === 'pending' ? styles.sharePending : undefined}>
                    <span className={styles.avatar} aria-hidden="true">{getInitials(displayName(share.user))}</span>
                    <span className={styles.shareName}>{displayName(share.user)}</span>
                    {share.status === 'pending' && <span className={styles.shareStatus}>{t('sharePending')}</span>}
                    {onRemove &&
                        <button type="button" className={styles.shareRemove} onClick={() => onRemove(share)}
                            aria-label={`${t('shareRemove')}: ${displayName(share.user)}`} title={t('shareRemove')}>
                            ×
                        </button>}
                </li>
            ))}
        </ul>
    );
}
