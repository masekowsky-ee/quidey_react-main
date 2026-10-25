import styles from './Community.module.css';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { displayName, fill } from '../../features/helperFunction';
import { friendsPath } from '../../features/community/paths';
import { useOnlineFriends } from '../../features/presence/presence';
import ProfileAvatar from '../profile/ProfileAvatar';
import Icon from '../icons';

const SHOWN = 6;

// Friends who have the app open right now, with one tap to write to them. Live: they come and
// go as they open or close the app. Hidden while I have no friends at all.
export default function OnlineNow() {
    const { t } = useTranslation();
    const friends = useSelector(state => state.friends.friends);
    const loaded = useSelector(state => state.friends.friendsLoaded);
    const online = useOnlineFriends();
    if (!loaded || friends.length === 0) return null;

    return (
        <section className={styles.panel} aria-labelledby="online-title">
            <div className={styles.panelHead}>
                <h2 id="online-title" className={styles.panelTitle}>{t('onlineNowTitle')}</h2>
                <span className={styles.panelMeta}>{fill(t('onlineNowMeta'), { online: online.length, all: friends.length })}</span>
            </div>
            {online.length === 0
                ? <p className={styles.hint}>{t('onlineNowNobody')}</p>
                : <ul className={styles.onlineList}>
                    {online.slice(0, SHOWN).map(friend => (
                        <li key={friend.id} className={styles.onlineItem}>
                            <ProfileAvatar user={friend} presence />
                            <span className={styles.onlineWho}>
                                <Link className={styles.rankName} to={`/u/${friend.username}`}>{displayName(friend)}</Link>
                                {friend.status && <small className={styles.onlineStatus}>{friend.status}</small>}
                            </span>
                            <Link to={`/inbox?with=${friend.id}`} className={styles.onlineAction}
                                aria-label={fill(t('onlineWrite'), { name: displayName(friend) })} title={fill(t('onlineWrite'), { name: displayName(friend) })}>
                                <Icon name="feedback" size={18} />
                            </Link>
                        </li>
                    ))}
                </ul>}
            {online.length > SHOWN && (
                <p className={styles.hint}><Link to={friendsPath()}>{fill(t('onlineNowMore'), { count: online.length - SHOWN })}</Link></p>
            )}
        </section>
    );
}
