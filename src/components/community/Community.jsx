import styles from './Community.module.css';
import { useEffect } from 'react';
import { Link, NavLink, Navigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { fill } from '../../features/helperFunction';
import { COMMUNITY_PATHS, COMMUNITY_TABS } from '../../features/community/paths';
import { fetchProgress, fetchRanking, formatNumber, tierFor } from '../../features/progress/progress';
import { selectIncomingCount } from '../../features/friends/friendsAction';
import { selectInviteCount } from '../../features/together/togetherAction';
import { selectFamilyInviteCount } from '../../features/family/family';
import { useIsTester } from '../../features/auth/tester';
import Feed from './Feed';
import LevelCard from './LevelCard';
import Challenges from './Challenges';
import Ranking from './Ranking';
import Together from '../Together';
import Social from '../Social';
import Family from '../family/Family';

const TAB_CONTENT = { feed: Feed, sessions: Together, friends: Social, family: Family };

// Gemeinschaft: everything with other people on one page. The feed is its start; shared
// sessions, friends and families (testers) are tabs with their own address. Beside them (under
// the title on a phone, feed only) my level, today's and this week's challenges and the week
// among friends.
export default function Community() {
    const { t, language } = useTranslation();
    const dispatch = useDispatch();
    const { tab: tabParam } = useParams();
    const isTester = useIsTester();
    const tab = tabParam ?? 'feed';
    const progress = useSelector(state => state.progress.data);
    const news = useSelector(state => state.news);
    const counts = {
        sessions: useSelector(selectInviteCount),
        friends: useSelector(selectIncomingCount),
        family: useSelector(selectFamilyInviteCount),
    };
    const dots = { feed: news.feed, sessions: news.together, friends: news.social };

    useEffect(() => {
        dispatch(fetchProgress()).catch(() => {});
        dispatch(fetchRanking()).catch(() => {});
    }, [dispatch]);

    const tabs = COMMUNITY_TABS.filter(key => key !== 'family' || isTester);
    if (!tabs.includes(tab)) return <Navigate to={COMMUNITY_PATHS.feed} replace />;
    const Content = TAB_CONTENT[tab];

    return (
        <div className={styles.page}>
            <header className={styles.head}>
                <div className={styles.headText}>
                    <h1 className={styles.title}>{t('community')}</h1>
                    {/* the finding first: where I stand and how far the next level is */}
                    <p className={styles.summary} aria-live="polite">
                        {progress?.nextLevelXp === null ? fill(t('communitySummaryMax'), {
                            level: progress.level, tier: t(`tier_${tierFor(progress.level).id}`),
                        }) : progress ? fill(t('communitySummary'), {
                            level: progress.level,
                            tier: t(`tier_${tierFor(progress.level).id}`),
                            xp: formatNumber(progress.nextLevelXp - progress.xp, language),
                            next: progress.level + 1,
                        }) : ' '}
                    </p>
                </div>
                {tab !== 'sessions' && (
                    <Link to={`${COMMUNITY_PATHS.sessions}?new=1`} className={styles.secondaryBtn}>{t('communityStartSession')}</Link>
                )}
            </header>

            <nav className={styles.tabs} aria-label={t('communityTabs')}>
                {tabs.map(key => (
                    <NavLink key={key} to={COMMUNITY_PATHS[key]} end
                        className={({ isActive }) => `${styles.tab} ${isActive ? styles.tabActive : ''}`}>
                        {t(`communityTab_${key}`)}
                        {counts[key] > 0 && <span className={styles.count} aria-label={`${counts[key]} ${t('communityCount')}`}>{counts[key]}</span>}
                        {!counts[key] && dots[key] && <span className={styles.dot} role="img" aria-label={t('menuNews')} />}
                    </NavLink>
                ))}
            </nav>

            <div className={styles.layout} data-tab={tab}>
                {/* the rail: next to every tab on a wide screen; on a phone only with the feed,
                    my level and today's challenges above it, the week and the ranking below */}
                <section className={styles.railTop} aria-label={t('communityProgress')}>
                    <LevelCard />
                    <Challenges period="day" />
                </section>
                <div className={styles.main}>
                    <Content />
                </div>
                <div className={styles.railBottom}>
                    <Challenges period="week" />
                    <Ranking />
                </div>
            </div>
        </div>
    );
}
