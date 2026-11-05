import { NavLink, useLocation } from 'react-router-dom';
import { COMMUNITY_PATHS, isCommunityPath } from '../features/community/paths';
import { useDispatch, useSelector } from 'react-redux';
import styles from './TabBar.module.css';
import Icon from './icons';
import { useTranslation } from '../i18n/useTranslation';
import { setShowMenu } from '../features/settings/settingsAction';
import { selectIncomingCount } from '../features/friends/friendsAction';
import { selectInviteCount } from '../features/together/togetherAction';
import { selectTaskInviteCount } from '../features/tasks/taskAction';
import { selectAdminPendingCount } from '../features/admin/adminAction';
import { selectFamilyInviteCount } from '../features/family/family';
import { useOnlineFriends } from '../features/presence/presence';
import { fill } from '../features/helperFunction';
import { motion } from 'motion/react';
import { spring, useMotionLevel } from '../features/settings/motion';

function Count({ count, label }) {
    if (count <= 0) return null;
    return <span className={styles.count} aria-label={`${count} ${label}`}>{count > 9 ? '9+' : count}</span>;
}

// The mark of the current tab: a pill behind its icon that slides over from the last one
// (one shared layoutId); on "minimal" it only fades in, on "extreme" it overshoots a little
function Indicator() {
    const level = useMotionLevel();
    if (level === 'minimal') {
        return <motion.span className={styles.indicator} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.2, ease: 'easeOut' }} aria-hidden="true" />;
    }
    return <motion.span layoutId="tabbar-indicator" className={styles.indicator} aria-hidden="true"
        transition={level === 'extreme' ? spring(0.4, 0.7) : spring(0.35, 1)} />;
}

function TabInner({ on, icon, label, count = 0, countLabel, news, newsLabel, online = 0, onlineLabel }) {
    return <>
        <span className={styles.iconWrap}>
            {on && <Indicator />}
            <Icon name={icon} className={styles.icon} strokeWidth={on ? 2.1 : 1.7} />
            <Count count={count} label={countLabel} />
            {count === 0 && news && <span className={styles.dot} role="img" aria-label={newsLabel} />}
            {online > 0 && <span className={styles.online} role="img" aria-label={onlineLabel} />}
        </span>
        <span className={styles.label}>{label}</span>
    </>;
}

// online: how many friends have the app open (a green dot at the icon's foot)
// While the menu ("More") is open, only "More" carries the mark.
function Tab({ to, end, match, menuOpen, ...inner }) {
    const { pathname } = useLocation();
    const matched = match?.(pathname);
    return (
        <NavLink to={to} end={end} className={({ isActive }) => `${styles.tab} ${(isActive || matched) && !menuOpen ? styles.active : ''}`}
            data-active={matched || undefined}>
            {({ isActive }) => <TabInner on={Boolean(isActive || matched) && !menuOpen} {...inner} />}
        </NavLink>
    );
}

// Phones: the main pages at the thumb (Start, Kalender, Fokus, Sozial), the rest of the menu
// behind "More" (with the count of what is in there: beta requests); the inbox sits in the header
export default function TabBar() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const news = useSelector(state => state.news);
    const inviteCount = useSelector(selectInviteCount);
    const taskInviteCount = useSelector(selectTaskInviteCount);
    const isAdmin = useSelector(state => state.auth.access.isAdmin);
    const friendRequests = useSelector(selectIncomingCount);
    const familyInvites = useSelector(selectFamilyInviteCount);
    const adminPending = useSelector(selectAdminPendingCount);
    const moreCount = isAdmin ? adminPending : 0;
    const menuOpen = useSelector(state => state.settings.showMenu);
    const onlineFriends = useOnlineFriends().length;

    return (
        <nav className={styles.bar} aria-label={t('mainNav')} data-part="tabbar">
            <Tab menuOpen={menuOpen} to="/" end icon="home" label={t('home')} />
            <Tab menuOpen={menuOpen} to="/calendar" icon="calendar" label={t('calendar')}
                count={taskInviteCount} countLabel={t('taskInvitesTitle')} />
            <Tab menuOpen={menuOpen} to="/focus" icon="focus" label={t('focusTab')} />
            <Tab menuOpen={menuOpen} to={COMMUNITY_PATHS.feed} match={isCommunityPath} icon="together" label={t('community')}
                count={inviteCount + friendRequests + familyInvites} countLabel={t('communityCount')}
                news={news.together || news.social || news.feed} newsLabel={t('menuNews')}
                online={onlineFriends}
                onlineLabel={fill(t(onlineFriends === 1 ? 'onlineFriendsOne' : 'onlineFriendsCount'), { count: onlineFriends })} />
            <button type="button" className={`${styles.tab} ${menuOpen ? styles.active : ''}`}
                onClick={() => dispatch(setShowMenu(true))} aria-expanded={menuOpen} aria-haspopup="dialog">
                <TabInner on={menuOpen} icon="more" label={t('more')} count={moreCount} countLabel={t('menuNews')} />
            </button>
        </nav>
    );
}
