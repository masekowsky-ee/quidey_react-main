import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useLocation } from 'react-router-dom';
import shell from '../AppShell.module.css';
import styles from './AppSkeleton.module.css';
import Header from '../Header.jsx';
import Menu from '../Menu.jsx';
import TabBar from '../TabBar.jsx';
import { RouteSkeleton } from './PageSkeletons.jsx';
import { useTranslation } from '../../i18n/useTranslation';
import { fetchAccess, logout } from '../../features/auth/authAction';
import { useNavModel } from '../../features/tester/variants';

const SLOW_MS = 5000;

// While the server hasn't said yet whether I may use the app: the app's frame as it will be
// (header, menu, tab bar: they need nothing from the server), not usable yet, and the page at
// this address as a skeleton. Takes over from the HTML's own skeleton (index.html, boot.css).
// When the answer takes long (server down, bad connection) it says so and offers to try again
// or sign out.
export default function AppSkeleton() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { pathname } = useLocation();
    const navModel = useNavModel();
    const [slow, setSlow] = useState(false);
    const [retrying, setRetrying] = useState(false);
    useEffect(() => {
        const id = setTimeout(() => setSlow(true), SLOW_MS);
        return () => clearTimeout(id);
    }, []);
    const retry = async () => {
        setRetrying(true);
        await dispatch(fetchAccess()).catch(() => {});
        setRetrying(false);
    };
    return (
        <div className={shell.shell} data-nav={navModel} data-part="shell">
            <div inert style={{ display: 'contents' }}>
                <Header activeTimer={false} />
                <Menu />
                <TabBar />
            </div>
            <main className={shell.main} data-part="main">
                <RouteSkeleton pathname={pathname} />
            </main>
            {slow && (
                <p className={styles.slow} role="status">
                    {t('betaConnecting')}
                    <button type="button" className={styles.slowBtn} onClick={retry} disabled={retrying}>{t('betaRetry')}</button>
                    <button type="button" className={styles.slowBtn} onClick={() => dispatch(logout())}>{t('logout')}</button>
                </p>
            )}
        </div>
    );
}
