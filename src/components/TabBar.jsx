import { useRef, useState } from 'react';
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
import { tabIndexOf } from '../features/layout/tabSwipe';

function Count({ count, label }) {
    if (count <= 0) return null;
    return <span className={styles.count} aria-label={`${count} ${label}`}>{count > 9 ? '9+' : count}</span>;
}

// The mark of the current tab: one pill in the capsule that slides from column to column
// (--tab: its index; a CSS transition, see TabBar.module.css). It is placed within the capsule
// alone, so a page scrolled down and sent back to its top on the way never moves it.
// Nothing marked (a page that isn't a tab): it fades out where it is.
function Indicator({ index }) {
    return (
        <span className={styles.track} style={{ '--tab': Math.max(index, 0) }} data-hidden={index < 0 || undefined} aria-hidden="true">
            <span className={styles.indicator} />
        </span>
    );
}

function TabInner({ on, icon, label, count = 0, countLabel, news, newsLabel, online = 0, onlineLabel }) {
    return <>
        <span className={styles.iconWrap}>
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

// a swipe: this far (px) along y, and more along y than along x
const SWIPE = 24;

// Phones: the main pages at the thumb (Start, Kalender, Fokus, Sozial), the rest of the menu
// behind "More" (with the count of what is in there: beta requests); the inbox sits in the header.
// The bar floats above the page as a glass capsule. Swiped down it folds away into a small handle
// at the bottom edge; a tap on the handle or a swipe up brings it back.
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
    const { pathname } = useLocation();
    const [collapsed, setCollapsed] = useState(false);
    const pillRef = useRef(null);
    const start = useRef(null);

    const onTouchStart = (e) => {
        const touch = e.touches[0];
        start.current = { x: touch.clientX, y: touch.clientY };
    };
    // the capsule follows the finger down a little, so the swipe is felt before it folds away
    const onTouchMove = (e) => {
        if (collapsed || !start.current || !pillRef.current) return;
        const dy = e.touches[0].clientY - start.current.y;
        pillRef.current.style.setProperty('--drag', `${Math.max(0, Math.min(dy, 60)) * 0.6}px`);
    };
    const onTouchEnd = (e) => {
        if (!start.current) return;
        const touch = e.changedTouches[0];
        const dx = touch.clientX - start.current.x;
        const dy = touch.clientY - start.current.y;
        start.current = null;
        pillRef.current?.style.removeProperty('--drag');
        if (Math.abs(dy) < SWIPE || Math.abs(dy) < Math.abs(dx)) return;
        if (!collapsed && dy > 0) setCollapsed(true);
        if (collapsed && dy < 0) setCollapsed(false);
    };
    const swipe = { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd };

    return (
        <nav className={styles.bar} aria-label={t('mainNav')} data-part="tabbar" data-collapsed={collapsed || undefined}>
            <div ref={pillRef} className={styles.pill} style={{ '--tabs': 5 }} inert={collapsed} aria-hidden={collapsed || undefined} {...swipe}>
                <Indicator index={menuOpen ? 4 : tabIndexOf(pathname)} />
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
            </div>
            {collapsed &&
                <button type="button" className={styles.handle} onClick={() => setCollapsed(false)} {...swipe}
                    aria-label={t('tabbarShow')} title={t('tabbarShow')}>
                    <span className={styles.handleBar} aria-hidden="true" />
                </button>}
        </nav>
    );
}
