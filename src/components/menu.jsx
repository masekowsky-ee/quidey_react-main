import { Link } from 'react-router-dom';
import styles from './Menu.module.css';
import {useSelector, useDispatch} from 'react-redux'
import {useTranslation} from '../i18n/useTranslation'
import {setShowMenu} from '../features/settings/settingsAction';
import { selectIncomingCount } from '../features/friends/friendsAction';
import { selectInviteCount } from '../features/together/togetherAction';

export default function Menu(){
    const isOpen = useSelector((state) => state.settings.showMenu);
    const incomingCount = useSelector(selectIncomingCount);
    const inviteCount = useSelector(selectInviteCount);
    const { t } = useTranslation();

    const dispatch = useDispatch();

    const onClose = () => {
        dispatch(setShowMenu());
    }

    return (
        <>
            {isOpen && <div className={styles.overlay} onClick={onClose} />}
            <div className={`${styles.menuDiv} ${isOpen ? styles.open : ''}`}>
                <h2 className={styles.menuTitle}>{t('menu')}</h2>
                <Link to="/" className={styles.menuItem} onClick={onClose}>
                    {t('home')}
                </Link>
                <Link to="/profile" className={styles.menuItem} onClick={onClose}>
                    {t('profile')}
                </Link>
                <Link to="/history" className={styles.menuItem} onClick={onClose}>
                    {t('history')}
                </Link>
                {/* with open requests, go straight to the inbox */}
                <Link to={incomingCount > 0 ? '/social?tab=requests' : '/social'} className={styles.menuItem} onClick={onClose}>
                    {t('social')}
                    {incomingCount > 0 && <span className={styles.badge} aria-label={`${incomingCount} ${t('friendRequests')}`}>{incomingCount}</span>}
                </Link>
                <Link to="/together" className={styles.menuItem} onClick={onClose}>
                    {t('together')}
                    {inviteCount > 0 && <span className={styles.badge} aria-label={`${inviteCount} ${t('sessionInvites')}`}>{inviteCount}</span>}
                </Link>
                <Link to="/settings" className={styles.menuItem} onClick={onClose}>
                    {t('settings')}
                </Link>
            </div>
        </>
    );
}