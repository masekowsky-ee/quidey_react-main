import { NavLink, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { setShowMenu } from '../../features/settings/settingsAction';
import { selectMenuBadgeCount } from '../../features/inbox/inbox';
import { selectHasNews } from '../../features/realtime/news';
import styles from './TopNav.module.css';
import Icon from '../icons';
import { useTranslation } from '../../i18n/useTranslation';
import { isCommunityPath } from '../../features/community/paths';
import { selectIncomingCount } from '../../features/friends/friendsAction';
import { selectInviteCount } from '../../features/together/togetherAction';
import { selectTaskInviteCount } from '../../features/tasks/taskAction';
import { selectFamilyInviteCount } from '../../features/family/family';
import { NAV } from '../../features/app/navTable';
import { topOnSamePlace } from '../../features/layout/scrollTop';

function Tab({ to, end, match, icon, label, count = 0, countLabel, news = false, newsLabel, tip }) {
    const { pathname } = useLocation();
    const matched = match?.(pathname);
    return (
        <NavLink to={to} end={end} onClick={topOnSamePlace(pathname, to, match)} data-part="topnav-tab" data-tip={tip}
            className={({ isActive }) => `${styles.tab} ${isActive || matched ? styles.active : ''}`}
            data-active={matched || undefined}>
            <Icon name={icon} className={styles.icon} />
            <span>{label}</span>
            {count > 0 && <span className={styles.count} aria-label={`${count} ${countLabel}`}>{count > 9 ? '9+' : count}</span>}
            {count === 0 && news && <span className={styles.dot} role="img" aria-label={newsLabel} />}
        </NavLink>
    );
}

// The main places as tabs on wide screens. `inline`: the app's own look, the tabs sit in the
// header's one row as plain words, with "Mehr" at the end opening the drawer (everything else, the
// account, the settings). Without it, testers' variants with "tabs on top" get them as a second
// header row; their drawer opens from the header's menu button.
export default function TopNav({ inline = false }) {
    const { t } = useTranslation();
    const item = (id, label = NAV[id].label) => ({ to: NAV[id].path, icon: NAV[id].icon, label: t(label) });
    const dispatch = useDispatch();
    const menuBadge = useSelector(selectMenuBadgeCount);
    const hasNews = useSelector(selectHasNews);
    const news = useSelector(state => state.news);
    const inviteCount = useSelector(selectInviteCount);
    const taskInviteCount = useSelector(selectTaskInviteCount);
    const friendRequests = useSelector(selectIncomingCount);
    const familyInvites = useSelector(selectFamilyInviteCount);

    return (
        <nav className={inline ? styles.inline : styles.bar} aria-label={t('mainNav')} data-part="topnav">
            <div className={styles.tabs}>
                <Tab {...item('home')} end tip="nav-home" />
                <Tab {...item('calendar')} tip="nav-calendar"
                    count={taskInviteCount} countLabel={t('taskInvitesTitle')} />
                <Tab {...item('focus')} tip="nav-focus" />
                {inline && <Tab {...item('study')} tip="nav-study" />}
                <Tab {...item('community')} match={isCommunityPath} tip="nav-community"
                    count={inviteCount + friendRequests + familyInvites} countLabel={t('communityCount')}
                    news={news.together || news.social || news.feed} newsLabel={t('menuNews')} />
                {/* Notizen takes the inbox's place here: the inbox is the header's icon (and the drawer's / tab bar's entry) */}
                <Tab {...item('notes')} tip="nav-notes" />
                <Tab {...item('stats')} tip="nav-stats" />
            </div>
            {inline
                ? <button type="button" className={styles.tab} onClick={() => dispatch(setShowMenu(true))} data-tip="nav-more"
                    aria-label={menuBadge > 0 ? `${t('more')}, ${menuBadge} ${t('inboxUnread')}` : hasNews ? `${t('more')}, ${t('menuNews')}` : t('more')}>
                    <span>{t('more')}</span>
                    {menuBadge === 0 && hasNews && <span className={styles.dot} aria-hidden="true" />}
                </button>
                : <div className={styles.tabs}>
                    <Tab {...item('tester')} />
                </div>}
        </nav>
    );
}
