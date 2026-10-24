import { useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import styles from './Menu.module.css';
import Icon from './icons';
import Logo from './Logo';
import {useSelector, useDispatch} from 'react-redux'
import {useTranslation} from '../i18n/useTranslation'
import {setShowMenu, setShowTutorial} from '../features/settings/settingsAction';
import { selectIncomingCount } from '../features/friends/friendsAction';
import { selectInviteCount } from '../features/together/togetherAction';
import { selectTaskInviteCount } from '../features/tasks/taskAction';
import { selectIsAdmin, selectAdminPendingCount } from '../features/admin/adminAction';
import { selectInboxCount } from '../features/inbox/inbox';
import { selectFamilyInviteCount } from '../features/family/family';
import { DESKTOP_QUERY, useMediaQuery } from '../features/layout/breakpoints';
import TesterOnly from './TesterOnly';
import AccountSwitcher from './AccountSwitcher';
import { AnimatePresence, motion } from 'motion/react';
import { MOTION, useMotionLevel } from '../features/settings/motion';

// One entry: icon, label and an optional count badge (or a dot: something changed there);
// the current page is highlighted
function MenuLink({ to, end, icon, label, onClick, count = 0, countLabel, news = false, newsLabel }) {
    return (
        <NavLink to={to} end={end} onClick={onClick}
            className={({ isActive }) => `${styles.menuItem} ${isActive ? styles.active : ''}`}>
            <Icon name={icon} className={styles.menuIcon} />
            <span className={styles.menuLabel}>{label}</span>
            {count > 0 && <span className={styles.badge} aria-label={`${count} ${countLabel}`}>{count}</span>}
            {count === 0 && news && <span className={styles.dot} role="img" aria-label={newsLabel} />}
        </NavLink>
    );
}

// The app's navigation. On a wide screen a sidebar that is always there; narrower, a drawer
// from the left (opened by the header's menu button or the tab bar's "More").
export default function Menu(){
    const desktop = useMediaQuery(DESKTOP_QUERY);
    const showMenu = useSelector((state) => state.settings.showMenu);
    const isOpen = showMenu && !desktop;
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

    const openTutorial = () => {
        onClose();
        dispatch(setShowTutorial(true));
    }

    return (
        <>
            <AnimatePresence>
                {isOpen && <motion.div className={styles.overlay} onClick={onClose} {...overlayMotion} />}
            </AnimatePresence>
            {/* a closed drawer is off screen: out of the tab order and hidden from screen readers too */}
            <div className={`${styles.menuDiv} ${isOpen ? styles.open : ''}`} inert={!desktop && !isOpen}>
                <div className={styles.menuHead}>
                    <Link to="/" className={styles.brand} onClick={onClose} aria-label={`Quidey, ${t('home')}`}>
                        <Logo className={styles.brandMark} />
                        <span>Quidey</span>
                    </Link>
                    <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={t('close')}>
                        <Icon name="close" className={styles.closeIcon} />
                    </button>
                </div>
                {/* the four places of every day first (the same as the phone's tab bar), then the
                    rest under "More"; profile and the tour live in the account menu at the foot */}
                <nav className={styles.menuNav} aria-label={t('menu')}>
                    <div className={styles.menuList}>
                        <MenuLink to="/" end icon="home" label={t('home')} onClick={onClose} />
                        <MenuLink to="/calendar" icon="calendar" label={t('calendar')} onClick={onClose}
                            count={taskInviteCount} countLabel={t('taskInvitesTitle')} />
                        <MenuLink to="/together" icon="together" label={t('together')} onClick={onClose}
                            count={inviteCount} countLabel={t('sessionInvites')} news={news.together} newsLabel={t('menuNews')} />
                        <MenuLink to="/inbox" icon="inbox" label={t('inbox')} onClick={onClose}
                            count={inboxCount} countLabel={t('inboxUnread')} />
                    </div>
                    <p className={styles.groupLabel}>{t('menuMore')}</p>
                    <div className={styles.menuList}>
                        {/* with open requests, go straight to them */}
                        <MenuLink to={incomingCount > 0 ? '/social?tab=requests' : '/social'} icon="social" label={t('social')} onClick={onClose}
                            count={incomingCount} countLabel={t('friendRequests')} news={news.social} newsLabel={t('menuNews')} />
                        <TesterOnly>
                            <MenuLink to="/family" icon="family" label={t('family')} onClick={onClose}
                                count={familyInviteCount} countLabel={t('familyInvites')} />
                        </TesterOnly>
                        <MenuLink to="/stats" icon="history" label={t('history')} onClick={onClose} />
                    </div>
                </nav>

                {/* settings, feedback and admin sit at the bottom, the account last */}
                <div className={styles.menuBottom}>
                    {isAdmin && (
                        <MenuLink to="/admin" icon="admin" label={t('admin')} onClick={onClose}
                            count={adminPendingCount} countLabel={t('adminOpenRequests')} />
                    )}
                    <MenuLink to="/settings" icon="settings" label={t('settings')} onClick={onClose} />
                    <MenuLink to="/feedback" icon="feedback" label={t('feedback')} onClick={onClose} />
                    {/* who is signed in: profile, the tour, switch accounts, add one, sign out */}
                    <div className={styles.account}>
                        <AccountSwitcher onNavigate={onClose} onTutorial={openTutorial} />
                    </div>
                </div>
            </div>
        </>
    );
}
