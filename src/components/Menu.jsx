import { useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { COMMUNITY_PATHS, isCommunityPath } from '../features/community/paths';
import { useOnlineFriends } from '../features/presence/presence';
import { displayName, fill } from '../features/helperFunction';
import ProfileAvatar from './profile/ProfileAvatar';
import styles from './Menu.module.css';
import Icon from './icons';
import Logo from './Logo';
import {useSelector, useDispatch} from 'react-redux'
import {useTranslation} from '../i18n/useTranslation'
import {setShowMenu} from '../features/settings/settingsAction';
import { selectIncomingCount } from '../features/friends/friendsAction';
import { selectInviteCount } from '../features/together/togetherAction';
import { selectTaskInviteCount } from '../features/tasks/taskAction';
import { selectIsAdmin, selectAdminPendingCount } from '../features/admin/adminAction';
import { selectInboxCount } from '../features/inbox/inbox';
import { selectFamilies, selectFamilyInviteCount } from '../features/family/family';
import { useMenuDocked, useNavModel } from '../features/tester/variants';
import { selectIsTester } from '../features/auth/tester';
import AccountSwitcher from './AccountSwitcher';
import { AnimatePresence, motion } from 'motion/react';
import { MOTION, useMotionLevel } from '../features/settings/motion';

// One entry: icon, label and an optional count badge (or a dot: something changed there);
// the current page is highlighted (`match`: also on other addresses that belong to it)
function MenuLink({ to, end, match, icon, label, onClick, count = 0, countLabel, news = false, newsLabel }) {
    const { pathname } = useLocation();
    return (
        <NavLink to={to} end={end} onClick={onClick} data-part="menu-item" data-active={match?.(pathname) || undefined}
            className={({ isActive }) => `${styles.menuItem} ${isActive || match?.(pathname) ? styles.active : ''}`}>
            <Icon name={icon} className={styles.menuIcon} />
            <span className={styles.menuLabel}>{label}</span>
            {count > 0 && <span className={styles.badge} aria-label={`${count} ${countLabel}`}>{count}</span>}
            {count === 0 && news && <span className={styles.dot} role="img" aria-label={newsLabel} />}
        </NavLink>
    );
}

// Under "Gemeinschaft": the friends who have the app open right now (a few faces and how many),
// one tap to the friends list. Nothing while nobody is online.
const FACES = 3;
function OnlineFriendsRow({ onClick }) {
    const { t } = useTranslation();
    const online = useOnlineFriends();
    if (online.length === 0) return null;
    const names = online.map(friend => displayName(friend)).join(', ');
    return (
        <Link to={COMMUNITY_PATHS.friends} className={styles.onlineRow} onClick={onClick} data-part="menu-sub"
            aria-label={`${fill(t(online.length === 1 ? 'onlineFriendsOne' : 'onlineFriendsCount'), { count: online.length })}: ${names}`}
            title={names}>
            <span className={styles.onlineFaces} aria-hidden="true">
                {online.slice(0, FACES).map(friend => <ProfileAvatar key={friend.id} user={friend} />)}
            </span>
            <span className={styles.onlineText} aria-hidden="true">
                {fill(t(online.length === 1 ? 'onlineFriendsOne' : 'onlineFriendsCount'), { count: online.length })}
            </span>
        </Link>
    );
}

// Under "Gemeinschaft" too: a direct way into each family I'm in. Nothing without one.
function FamilyLinks({ onClick }) {
    const { t } = useTranslation();
    const families = useSelector(selectFamilies);
    if (families.length === 0) return null;
    return (
        <ul className={styles.familyLinks} aria-label={t('myFamilies')} data-part="menu-sub">
            {families.map(family => (
                <li key={family.id}>
                    <NavLink to={`/family/${family.id}`} onClick={onClick}
                        className={({ isActive }) => `${styles.familyLink} ${isActive ? styles.active : ''}`}>
                        <span className={styles.familyEmoji} data-task-color={family.color ?? undefined} aria-hidden="true">{family.emoji ?? '🏡'}</span>
                        <span className={styles.familyName}>{family.name}</span>
                    </NavLink>
                </li>
            ))}
        </ul>
    );
}

// The app's navigation. On a wide screen a sidebar that is always there; narrower, a drawer
// from the left (opened by the header's menu button or the tab bar's "More"). Testers' interface
// variants can make it a narrow rail, or keep it a drawer on wide screens too (their main places
// are tabs in the header then, see features/tester/variants.js).
export default function Menu(){
    const docked = useMenuDocked();
    const nav = useNavModel();
    const showMenu = useSelector((state) => state.settings.showMenu);
    const isOpen = showMenu && !docked;
    const isTester = useSelector(selectIsTester);
    const incomingCount = useSelector(selectIncomingCount);
    const inviteCount = useSelector(selectInviteCount);
    const taskInviteCount = useSelector(selectTaskInviteCount);
    const isAdmin = useSelector(selectIsAdmin);
    const adminPendingCount = useSelector(selectAdminPendingCount);
    const inboxCount = useSelector(selectInboxCount);
    const familyInviteCount = useSelector(selectFamilyInviteCount);
    const news = useSelector(state => state.news);
    const { t } = useTranslation();
    const { pathname } = useLocation();

    const dispatch = useDispatch();
    const overlayMotion = MOTION.overlay[useMotionLevel()];

    const onClose = () => {
        dispatch(setShowMenu(false));
    }

    // a new page (also by the browser's back button) closes the drawer
    useEffect(() => {
        dispatch(setShowMenu(false));
    }, [pathname, dispatch]);

    // Escape closes the open drawer
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => { if (e.key === 'Escape') dispatch(setShowMenu(false)); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, dispatch]);

    return (
        <>
            <AnimatePresence>
                {isOpen && <motion.div className={`${styles.overlay} ${nav === 'top' ? styles.undocked : ''}`} onClick={onClose} {...overlayMotion} />}
            </AnimatePresence>
            {/* a closed drawer is off screen: out of the tab order and hidden from screen readers too */}
            <div className={[styles.menuDiv, isOpen && styles.open, nav === 'top' && styles.undocked, nav === 'rail' && styles.rail].filter(Boolean).join(' ')}
                inert={!docked && !isOpen} data-part="menu">
                <div className={styles.menuHead}>
                    <Link to="/" className={styles.brand} onClick={onClose} aria-label={`Quidey, ${t('home')}`}>
                        <Logo className={styles.brandMark} />
                        <span>Quidey</span>
                    </Link>
                    <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={t('close')}>
                        <Icon name="close" className={styles.closeIcon} />
                    </button>
                </div>
                {/* the four places of every day (the same as the phone's tab bar), then the
                    statistics; the profile lives in the account menu at the foot, the tour in
                    the settings */}
                <nav className={styles.menuNav} aria-label={t('menu')}>
                    <div className={styles.menuList}>
                        <MenuLink to="/" end icon="home" label={t('home')} onClick={onClose} />
                        <MenuLink to="/calendar" icon="calendar" label={t('calendar')} onClick={onClose}
                            count={taskInviteCount} countLabel={t('taskInvitesTitle')} />
                        {/* friends, shared sessions, families and the feed: one place for other people */}
                        <MenuLink to={COMMUNITY_PATHS.feed} match={isCommunityPath} icon="together" label={t('community')} onClick={onClose}
                            count={inviteCount + incomingCount + familyInviteCount} countLabel={t('communityCount')}
                            news={news.together || news.social || news.feed} newsLabel={t('menuNews')} />
                        <FamilyLinks onClick={onClose} />
                        <OnlineFriendsRow onClick={onClose} />
                        <MenuLink to="/inbox" icon="inbox" label={t('inbox')} onClick={onClose}
                            count={inboxCount} countLabel={t('inboxUnread')} />
                        <MenuLink to="/stats" icon="history" label={t('history')} onClick={onClose} />
                    </div>
                </nav>

                {/* settings, feedback and admin sit at the bottom, the account last */}
                <div className={styles.menuBottom}>
                    {/* testers: switch the interface variant, rate what is being tested */}
                    {isTester && <MenuLink to="/tester" icon="flask" label={t('testerNav')} onClick={onClose} />}
                    {isAdmin && (
                        <MenuLink to="/admin" icon="admin" label={t('admin')} onClick={onClose}
                            count={adminPendingCount} countLabel={t('adminOpenRequests')} />
                    )}
                    <MenuLink to="/settings" icon="settings" label={t('settings')} onClick={onClose} />
                    <MenuLink to="/feedback" icon="feedback" label={t('feedback')} onClick={onClose} />
                    {/* who is signed in: profile, switch accounts, add one, sign out */}
                    <div className={styles.account}>
                        <AccountSwitcher onNavigate={onClose} compact={nav === 'rail'} />
                    </div>
                </div>
            </div>
        </>
    );
}
