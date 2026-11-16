import { useEffect } from 'react';
import { openAuth } from '../../features/auth/gate';
import { useTranslation } from '../../i18n/useTranslation';
import styles from './GuestLocked.module.css';

// A page that needs an account, opened without one: the sign-in window opens, and behind it
// (or once it is closed) a quiet card says why and offers it again.
export default function GuestLocked() {
    const { t } = useTranslation();
    useEffect(() => { openAuth(); }, []);
    return (
        <section className={styles.card}>
            <h1 className={styles.title}>{t('guestLockedTitle')}</h1>
            <p className={styles.text}>{t('guestLockedText')}</p>
            <button type="button" className={styles.button} onClick={() => openAuth()}>{t('signIn')}</button>
        </section>
    );
}
