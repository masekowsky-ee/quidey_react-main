import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import styles from './Seats.module.css';
import ProfileAvatar from '../profile/ProfileAvatar';
import { useTranslation } from '../../i18n/useTranslation';
import { displayName, fill } from '../../features/helperFunction';
import { useOnlineFriends } from '../../features/presence/presence';
import { COMMUNITY_PATHS } from '../../features/community/paths';

const SHOWN = 5;
// a seat of one's own that stays the same, like a regular place in the library
// (from the id or the username: any value, always the same seat for it)
const seatOf = (key) => {
    let hash = 0;
    for (const char of String(key)) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
    return (hash % 180) + 12;
};

// The "Lesesaal" variant's Home: who is in the reading room right now. Me first, then the
// friends who have Quidey open, each on their seat; a tap leads to them.
export default function Seats() {
    const { t } = useTranslation();
    const me = useSelector(state => state.auth.user);
    const online = useOnlineFriends();
    const shown = online.slice(0, SHOWN);

    return (
        <section className={styles.room} aria-labelledby="seats-title" data-part="seats">
            <h2 id="seats-title" className={styles.title}>{t('seatsTitle')}</h2>
            <ul className={styles.seats}>
                <li className={styles.seat} data-me="true">
                    <span className={styles.number}>{fill(t('seatsSeat'), { n: seatOf(me?.username ?? '') })}</span>
                    <span className={styles.name}>{t('seatsYou')}</span>
                </li>
                {shown.map(friend => (
                    <li key={friend.id}>
                        <Link to={`/u/${friend.username}`} className={styles.seat}>
                            <span className={styles.number}>{fill(t('seatsSeat'), { n: seatOf(friend.id) })}</span>
                            <span className={styles.person}>
                                <ProfileAvatar user={friend} presence />
                                <span className={styles.name}>{displayName(friend)}</span>
                            </span>
                            {friend.status && <span className={styles.status}>{friend.status}</span>}
                        </Link>
                    </li>
                ))}
                {online.length > SHOWN &&
                    <li><Link to={COMMUNITY_PATHS.friends} className={`${styles.seat} ${styles.more}`}>{fill(t('seatsMore'), { count: online.length - SHOWN })}</Link></li>}
            </ul>
            {online.length === 0 && <p className={styles.empty}>{t('seatsEmpty')}</p>}
        </section>
    );
}
