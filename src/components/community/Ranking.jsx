import styles from './Community.module.css';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { displayName, fill } from '../../features/helperFunction';
import { friendsPath } from '../../features/community/paths';
import ProfileAvatar from '../profile/ProfileAvatar';
import { formatNumber } from '../../features/progress/progress';
import Icon from '../icons';

// the top five, and me below them when I'm further down
const SHOWN = 5;

// This week among friends: XP since Monday, most first. Only friends who show their
// statistics are in it (the same switch as on the profile).
export default function Ranking() {
    const { t, language } = useTranslation();
    const data = useSelector(state => state.progress.ranking);
    const rows = data?.ranking ?? [];
    const myIndex = rows.findIndex(row => row.me);
    const top = rows.slice(0, SHOWN);
    const meBelow = myIndex >= SHOWN ? rows[myIndex] : null;
    const alone = data && rows.length <= 1;

    const row = (item, index) => (
        <li key={item.user.id} className={styles.rankRow} data-me={item.me}>
            <span className={styles.rank}>{index + 1}</span>
            <ProfileAvatar user={{ ...item.user, online: item.online }} presence={!item.me} />
            {item.me
                ? <span className={styles.rankName}>{t('rankingYou')}<small>{fill(t('levelShort'), { level: item.user.level })}</small></span>
                : <Link className={styles.rankName} to={`/u/${item.user.username}`}>
                    {displayName(item.user)}<small>{fill(t('levelShort'), { level: item.user.level })}</small>
                </Link>}
            <span className={styles.rankXp}>
                {fill(t('rankingXp'), { xp: formatNumber(item.weekXp, language) })}
                {item.streak > 0 && (
                    <span className={styles.rankStreak} title={fill(t('streakDaysTitle'), { days: item.streak })}
                        aria-label={fill(t('streakDaysTitle'), { days: item.streak })}>
                        <Icon name="flame" size={13} />{item.streak}
                    </span>
                )}
            </span>
        </li>
    );

    return (
        <section className={styles.panel} aria-labelledby="ranking-title">
            <div className={styles.panelHead}>
                <h2 id="ranking-title" className={styles.panelTitle}>{t('rankingTitle')}</h2>
            </div>
            {!data ? (
                <ol className={styles.ranking} aria-hidden="true">
                    {[0, 1, 2].map(i => (
                        <li key={i} className={styles.rankRow}>
                            <span className={styles.rank} />
                            <span className={styles.skeleton} style={{ width: '2.25rem', height: '2.25rem', borderRadius: '50%' }} />
                            <span className={styles.skeleton} style={{ width: '60%', height: '0.875rem' }} />
                            <span className={styles.skeleton} style={{ width: '3rem', height: '0.875rem' }} />
                        </li>
                    ))}
                </ol>
            ) : (
                <>
                    <ol className={styles.ranking}>
                        {top.map(row)}
                        {meBelow && <li className={styles.rankGap} aria-hidden="true" />}
                        {meBelow && row(meBelow, myIndex)}
                    </ol>
                    {alone
                        ? <p className={styles.hint}>{t('rankingAlone')} <Link to={friendsPath('add')}>{t('feedFindFriends')}</Link></p>
                        : <p className={styles.hint}>{t('rankingHint')}</p>}
                </>
            )}
        </section>
    );
}
