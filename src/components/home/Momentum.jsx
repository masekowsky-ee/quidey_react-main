import styles from './Momentum.module.css';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { displayName, fill } from '../../features/helperFunction';
import { COMMUNITY_PATHS, friendsPath } from '../../features/community/paths';
import { challengeAmount, challengeTitle, fetchRanking, formatNumber, nextStreakMilestone, tierFor } from '../../features/progress/progress';
import { useOnlineFriends } from '../../features/presence/presence';
import ProfileAvatar from '../profile/ProfileAvatar';
import LevelPlant from '../progress/LevelPlant';
import Icon from '../icons';
import { Bone, Skeleton } from '../skeleton/Skeleton.jsx';

const FACES = 4;
const STREAKS_SHOWN = 3;

// The streak: how many days in a row, the last seven days as dots, whether today already counts
// and how far the next milestone is. The flame burns once today has focus; before that it
// waits (and says so) so the streak doesn't break.
function StreakCard({ progress }) {
    const { t, language } = useTranslation();
    const { streak, streakToday, bestStreak, recentDays = [] } = progress;
    const next = nextStreakMilestone(streak, progress.streakMilestones);
    const weekday = (day) => new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', { weekday: 'narrow', timeZone: 'UTC' })
        .format(new Date(`${day}T00:00:00Z`));
    const state = streakToday ? 'lit' : streak > 0 ? 'waiting' : 'none';

    return (
        <section className={styles.card} data-streak={state} aria-labelledby="streak-title">
            <h2 id="streak-title" className={styles.cardLabel}>{t('streakTitle')}</h2>
            <div className={styles.streakTop}>
                <span className={styles.flame} aria-hidden="true"><Icon name="flame" size={28} strokeWidth={1.6} /></span>
                <p className={styles.streakNumber}>
                    <strong>{streak}</strong>
                    <span>{t(streak === 1 ? 'streakDayOne' : 'streakDays')}</span>
                </p>
            </div>
            <ol className={styles.days} aria-label={t('streakLastDays')}>
                {recentDays.map((day, i) => {
                    const today = i === recentDays.length - 1;
                    return (
                        <li key={day.day} data-active={day.active} data-today={today}
                            aria-label={`${weekday(day.day)}: ${t(day.active ? 'streakDayDone' : 'streakDayMissed')}`}>
                            <span className={styles.dayDot} aria-hidden="true" />
                            <span className={styles.dayName} aria-hidden="true">{weekday(day.day)}</span>
                        </li>
                    );
                })}
            </ol>
            <p className={styles.streakStatus} aria-live="polite">
                {state === 'lit' ? t('streakSafe') : state === 'waiting' ? t('streakWaiting') : t('streakStart')}
            </p>
            <p className={styles.streakMeta}>
                {next && streak > 0 && <span>{fill(t(next - streak === 1 ? 'streakToMilestoneOne' : 'streakToMilestone'), { days: next - streak, goal: next })}</span>}
                {bestStreak > 0 && <span>{fill(t('streakBest'), { days: formatNumber(bestStreak, language) })}</span>}
            </p>
        </section>
    );
}

// Today: the three daily challenges at a glance and the plant with the way to the next level
function TodayCard({ progress }) {
    const { t, language } = useTranslation();
    const { level, xp, levelStartXp, nextLevelXp } = progress;
    const top = nextLevelXp === null;
    const share = top ? 1 : Math.min(1, Math.max(0, (xp - levelStartXp) / (nextLevelXp - levelStartXp)));
    const done = progress.daily.filter(challenge => challenge.done).length;

    return (
        <section className={styles.card} aria-labelledby="today-title">
            <div className={styles.cardHead}>
                <h2 id="today-title" className={styles.cardLabel}>{t('momentumToday')}</h2>
                <span className={styles.cardMeta}>{fill(t('momentumChallengesDone'), { done, all: progress.daily.length })}</span>
            </div>
            <ul className={styles.challenges}>
                {progress.daily.map(challenge => (
                    <li key={challenge.id} data-done={challenge.done}>
                        <span className={styles.challengeName}>
                            {challenge.done && <Icon name="check" size={14} strokeWidth={2.2} />}
                            {challengeTitle(t, challenge)}
                        </span>
                        <span className={styles.challengeXp}>+{challenge.xp}</span>
                        <span className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={challenge.goal}
                            aria-valuenow={Math.min(challenge.value, challenge.goal)} aria-label={challengeAmount(t, challenge, language)}>
                            <span style={{ transform: `scaleX(${Math.min(1, challenge.value / challenge.goal)})` }} />
                        </span>
                    </li>
                ))}
            </ul>
            <Link to="/profile" className={styles.levelRow} aria-label={t('plantOpen')}>
                <LevelPlant level={level} share={share} size={40} />
                <span className={styles.levelText}>
                    <strong>{fill(t('levelLabel'), { level })} · {t(`tier_${tierFor(level).id}`)}</strong>
                    <small>{top ? t('levelMax') : fill(t('levelToNext'), { xp: formatNumber(nextLevelXp - xp, language), level: level + 1 })}</small>
                </span>
            </Link>
        </section>
    );
}

// Friends: who is online right now, and the longest streaks among friends this week
function FriendsCard() {
    const { t } = useTranslation();
    const friends = useSelector(state => state.friends.friends);
    const ranking = useSelector(state => state.progress.ranking?.ranking ?? []);
    const online = useOnlineFriends();
    const streaks = ranking.filter(row => !row.me && row.streak > 0)
        .sort((a, b) => b.streak - a.streak).slice(0, STREAKS_SHOWN);

    if (friends.length === 0) {
        return (
            <section className={styles.card} aria-labelledby="friends-title">
                <h2 id="friends-title" className={styles.cardLabel}>{t('momentumFriends')}</h2>
                <p className={styles.empty}>{t('momentumNoFriends')}</p>
                <Link to={friendsPath('add')} className={styles.cardLink}>{t('addFriend')} →</Link>
            </section>
        );
    }

    return (
        <section className={styles.card} aria-labelledby="friends-title">
            <div className={styles.cardHead}>
                <h2 id="friends-title" className={styles.cardLabel}>{t('momentumFriends')}</h2>
                <span className={styles.cardMeta}>
                    {online.length > 0
                        ? fill(t(online.length === 1 ? 'onlineFriendsOne' : 'onlineFriendsCount'), { count: online.length })
                        : t('momentumNobodyOnline')}
                </span>
            </div>
            {online.length > 0 && (
                <ul className={styles.faces} aria-label={t('onlineNowTitle')}>
                    {online.slice(0, FACES).map(friend => (
                        <li key={friend.id}>
                            <Link to={`/u/${friend.username}`} title={displayName(friend)} aria-label={displayName(friend)}>
                                <ProfileAvatar user={friend} presence />
                            </Link>
                        </li>
                    ))}
                    {online.length > FACES && <li className={styles.moreFaces}>+{online.length - FACES}</li>}
                </ul>
            )}
            {streaks.length > 0 && (
                <ol className={styles.friendStreaks} aria-label={t('momentumFriendStreaks')}>
                    {streaks.map(row => (
                        <li key={row.user.id}>
                            <Link to={`/u/${row.user.username}`}>{displayName(row.user)}</Link>
                            <span className={styles.friendStreak} aria-label={fill(t('streakDaysTitle'), { days: row.streak })}>
                                <Icon name="flame" size={13} />{row.streak}
                            </span>
                        </li>
                    ))}
                </ol>
            )}
            <Link to={COMMUNITY_PATHS.feed} className={styles.cardLink}>{t('momentumCheer')} →</Link>
        </section>
    );
}

// The strip's shape until my progress is there: the three cards with their titles, the last
// seven days (known already), grey where streak, challenges, level and friends will be
export function MomentumSkeleton() {
    const { t, language } = useTranslation();
    const weekday = new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', { weekday: 'narrow' });
    const lastDays = Array.from({ length: 7 }, (_, i) => { const day = new Date(); day.setDate(day.getDate() - 6 + i); return day; });
    return (
        // as tall as the loaded cards, so the week below doesn't move
        <Skeleton className={styles.strip} style={{ minHeight: '16rem' }}>
            <section className={styles.card}>
                <h2 className={styles.cardLabel}>{t('streakTitle')}</h2>
                <div className={styles.streakTop}>
                    <Bone w="1.75rem" h="1.75rem" />
                    <Bone w="7.5rem" h="2.25rem" />
                </div>
                <ol className={styles.days}>
                    {lastDays.map((day, i) => (
                        <li key={i} data-today={i === 6}>
                            <span className={styles.dayDot} />
                            <span className={styles.dayName}>{weekday.format(day)}</span>
                        </li>
                    ))}
                </ol>
                <Bone w="80%" />
            </section>
            <section className={styles.card}>
                <div className={styles.cardHead}>
                    <h2 className={styles.cardLabel}>{t('momentumToday')}</h2>
                    <Bone w="3rem" h="0.75rem" />
                </div>
                <ul className={styles.challenges}>
                    {['75%', '88%', '62%'].map(w => (
                        <li key={w}>
                            <Bone w={w} h="0.8125rem" />
                            <Bone w="1.75rem" h="0.75rem" />
                            <span className={styles.bar} />
                        </li>
                    ))}
                </ul>
                <div className={styles.levelRow}>
                    <Bone round w="2.5rem" />
                    <span className={styles.levelText} style={{ gap: '0.3rem' }}>
                        <Bone w="8rem" h="0.8125rem" />
                        <Bone w="6.5rem" h="0.75rem" />
                    </span>
                </div>
            </section>
            <section className={styles.card}>
                <div className={styles.cardHead}>
                    <h2 className={styles.cardLabel}>{t('momentumFriends')}</h2>
                    <Bone w="6.5rem" h="0.75rem" />
                </div>
                <Bone w="7rem" h="0.875rem" style={{ marginTop: 'auto' }} />
            </section>
        </Skeleton>
    );
}

// Home's motivation strip, under the day's title: streak, today's challenges and level,
// friends. Its shape until my progress is loaded (App loads it once signed in).
export default function Momentum() {
    const dispatch = useDispatch();
    const progress = useSelector(state => state.progress.data);
    const failed = useSelector(state => state.progress.failed);
    const { t } = useTranslation();

    // the friends' streaks come with the week's ranking
    useEffect(() => { dispatch(fetchRanking()).catch(() => {}); }, [dispatch]);

    // nothing when it couldn't be loaded (the rest of Home works without it)
    if (!progress) return failed ? null : <MomentumSkeleton />;
    return (
        <div className={styles.strip} role="region" aria-label={t('momentumTitle')}>
            <StreakCard progress={progress} />
            <TodayCard progress={progress} />
            <FriendsCard />
        </div>
    );
}
