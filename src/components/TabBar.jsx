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
import { selectInboxCount } from '../features/inbox/inbox';
import { selectFamilyInviteCount } from '../features/family/family';
import { useOnlineFriends } from '../features/presence/presence';
import { fill } from '../features/helperFunction';

function Count({ count, label }) {
    if (count <= 0) return null;
    return <span className={styles.count} aria-label={`${count} ${label}`}>{count > 9 ? '9+' : count}</span>;
}

// online: how many friends have the app open (a green dot at the icon's foot)
function Tab({ to, end, match, icon, label, count = 0, countLabel, news, newsLabel, online = 0, onlineLabel }) {
    const { pathname } = useLocation();
    const matched = match?.(pathname);
    return (
        <NavLink to={to} end={end} className={({ isActive }) => `${styles.tab} ${isActive || matched ? styles.active : ''}`}
            data-active={matched || undefined}>
            <span className={styles.iconWrap}>
                <Icon name={icon} className={styles.icon} />
                <Count count={count} label={countLabel} />
                {count === 0 && news && <span className={styles.dot} role="img" aria-label={newsLabel} />}
                {online > 0 && <span className={styles.online} role="img" aria-label={onlineLabel} />}
            </span>
            <span className={styles.label}>{label}</span>
        </NavLink>
    );
}

// Phones: the main pages at the thumb, the rest of the menu behind "More" (with the count of
// what is in there: beta requests)
export default function TabBar() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const news = useSelector(state => state.news);
    const inboxCount = useSelector(selectInboxCount);
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
            <Tab to="/" end icon="home" label={t('home')} />
            <Tab to="/calendar" icon="calendar" label={t('calendar')}
                count={taskInviteCount} countLabel={t('taskInvitesTitle')} />
            <Tab to={COMMUNITY_PATHS.feed} match={isCommunityPath} icon="together" label={t('community')}
                count={inviteCount + friendRequests + familyInvites} countLabel={t('communityCount')}
                news={news.together || news.social || news.feed} newsLabel={t('menuNews')}
                online={onlineFriends}
                onlineLabel={fill(t(onlineFriends === 1 ? 'onlineFriendsOne' : 'onlineFriendsCount'), { count: onlineFriends })} />
            <Tab to="/inbox" icon="inbox" label={t('inbox')}
                count={inboxCount} countLabel={t('inboxUnread')} />
            <button type="button" className={`${styles.tab} ${menuOpen ? styles.active : ''}`}
                onClick={() => dispatch(setShowMenu(true))} aria-expanded={menuOpen} aria-haspopup="dialog">
                <span className={styles.iconWrap}>
                    <Icon name="more" className={styles.icon} />
                    <Count count={moreCount} label={t('menuNews')} />
                </span>
                <span className={styles.label}>{t('more')}</span>
            </button>
        </nav>
    );
}
