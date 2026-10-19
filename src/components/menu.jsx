import { NavLink } from 'react-router-dom';
import styles from './Menu.module.css';
import Icon from './icons';
import {useSelector, useDispatch} from 'react-redux'
import {useTranslation} from '../i18n/useTranslation'
import {setShowMenu, setShowTutorial} from '../features/settings/settingsAction';
import { selectIncomingCount } from '../features/friends/friendsAction';
import { selectInviteCount } from '../features/together/togetherAction';
import { selectTaskInviteCount } from '../features/tasks/taskAction';
import { selectIsAdmin, selectAdminPendingCount } from '../features/admin/adminAction';
import { AnimatePresence, motion } from 'motion/react';

// One entry: icon, label and an optional count badge; the current page is highlighted
function MenuLink({ to, end, icon, label, onClick, count = 0, countLabel }) {
    return (
        <NavLink to={to} end={end} onClick={onClick}
            className={({ isActive }) => `${styles.menuItem} ${isActive ? styles.active : ''}`}>
            <Icon name={icon} className={styles.menuIcon} />
            <span className={styles.menuLabel}>{label}</span>
            {count > 0 && <span className={styles.badge} aria-label={`${count} ${countLabel}`}>{count}</span>}
        </NavLink>
    );
}

export default function Menu(){
    const isOpen = useSelector((state) => state.settings.showMenu);
    const incomingCount = useSelector(selectIncomingCount);
    const inviteCount = useSelector(selectInviteCount);
    const taskInviteCount = useSelector(selectTaskInviteCount);
    const isAdmin = useSelector(selectIsAdmin);
    const adminPendingCount = useSelector(selectAdminPendingCount);
    const { t } = useTranslation();

    const dispatch = useDispatch();

    const onClose = () => {
        dispatch(setShowMenu());
    }

    const openTutorial = () => {
        onClose();
        dispatch(setShowTutorial(true));
    }

    return (
        <>
            <AnimatePresence>
                {isOpen && <motion.div className={styles.overlay} onClick={onClose}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} />}
            </AnimatePresence>
            <div className={`${styles.menuDiv} ${isOpen ? styles.open : ''}`}>
                <h2 className={styles.menuTitle}>{t('menu')}</h2>
                <nav className={styles.menuList}>
                    <MenuLink to="/" end icon="home" label={t('home')} onClick={onClose} />
                    <MenuLink to="/calendar" icon="calendar" label={t('calendar')} onClick={onClose}
                        count={taskInviteCount} countLabel={t('taskInvitesTitle')} />
                    <MenuLink to="/profile" icon="profile" label={t('profile')} onClick={onClose} />
                    <MenuLink to="/history" icon="history" label={t('history')} onClick={onClose} />
                    {/* with open requests, go straight to the inbox */}
                    <MenuLink to={incomingCount > 0 ? '/social?tab=requests' : '/social'} icon="social" label={t('social')} onClick={onClose}
                        count={incomingCount} countLabel={t('friendRequests')} />
                    <MenuLink to="/together" icon="together" label={t('together')} onClick={onClose}
                        count={inviteCount} countLabel={t('sessionInvites')} />
                </nav>

                {/* settings, help and admin sit at the bottom */}
                <div className={styles.menuBottom}>
                    {isAdmin && (
                        <MenuLink to="/admin" icon="admin" label={t('admin')} onClick={onClose}
                            count={adminPendingCount} countLabel={t('adminOpenRequests')} />
                    )}
                    <MenuLink to="/settings" icon="settings" label={t('settings')} onClick={onClose} />
                    <button type="button" className={`${styles.menuItem} ${styles.menuButton}`} onClick={openTutorial}>
                        <Icon name="tutorial" className={styles.menuIcon} />
                        <span className={styles.menuLabel}>{t('tutorial')}</span>
                    </button>
                </div>
            </div>
        </>
    );
}