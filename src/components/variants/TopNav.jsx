import { NavLink, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import styles from './TopNav.module.css';
import Icon from '../icons';
import { useTranslation } from '../../i18n/useTranslation';
import { COMMUNITY_PATHS, isCommunityPath } from '../../features/community/paths';
import { selectIncomingCount } from '../../features/friends/friendsAction';
import { selectInviteCount } from '../../features/together/togetherAction';
import { selectTaskInviteCount } from '../../features/tasks/taskAction';
import { selectInboxCount } from '../../features/inbox/inbox';
import { selectFamilyInviteCount } from '../../features/family/family';

function Tab({ to, end, match, icon, label, count = 0, countLabel, news = false, newsLabel }) {
    const { pathname } = useLocation();
    const matched = match?.(pathname);
    return (
        <NavLink to={to} end={end} data-part="topnav-tab"
            className={({ isActive }) => `${styles.tab} ${isActive || matched ? styles.active : ''}`}
            data-active={matched || undefined}>
            <Icon name={icon} className={styles.icon} />
            <span>{label}</span>
            {count > 0 && <span className={styles.count} aria-label={`${count} ${countLabel}`}>{count > 9 ? '9+' : count}</span>}
            {count === 0 && news && <span className={styles.dot} role="img" aria-label={newsLabel} />}
        </NavLink>
    );
}

// Interface variants with "tabs on top" (wide screens): the main places as a row of tabs under
// the header's bar; settings, feedback, admin and the account stay in the drawer (header button)
export default function TopNav() {
    const { t } = useTranslation();
    const news = useSelector(state => state.news);
    const inboxCount = useSelector(selectInboxCount);
    const inviteCount = useSelector(selectInviteCount);
    const taskInviteCount = useSelector(selectTaskInviteCount);
    const friendRequests = useSelector(selectIncomingCount);
    const familyInvites = useSelector(selectFamilyInviteCount);

    return (
        <nav className={styles.bar} aria-label={t('mainNav')} data-part="topnav">
            <div className={styles.tabs}>
                <Tab to="/" end icon="home" label={t('home')} />
                <Tab to="/calendar" icon="calendar" label={t('calendar')}
                    count={taskInviteCount} countLabel={t('taskInvitesTitle')} />
                <Tab to={COMMUNITY_PATHS.feed} match={isCommunityPath} icon="together" label={t('community')}
                    count={inviteCount + friendRequests + familyInvites} countLabel={t('communityCount')}
                    news={news.together || news.social || news.feed} newsLabel={t('menuNews')} />
                <Tab to="/inbox" icon="inbox" label={t('inbox')} count={inboxCount} countLabel={t('inboxUnread')} />
                <Tab to="/stats" icon="history" label={t('history')} />
            </div>
            <div className={styles.tabs}>
                <Tab to="/tester" icon="flask" label={t('testerNav')} />
            </div>
        </nav>
    );
}
