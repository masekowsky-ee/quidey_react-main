import styles from './SignIn.module.css';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from '../i18n/useTranslation';
import { LegalFooter } from '../legal/LegalFooter.jsx';
import { LANDING_URL } from '../features/site';
import Logo from './Logo';
import Profile from './Profile';

// The address typed into the landing page's email line comes along as #email=… (a hash never
// reaches a server). Read once, then taken out of the address bar.
function takeEmailFromHash() {
    const match = window.location.hash.match(/^#email=([^&]*)/);
    if (!match) return '';
    history.replaceState(history.state, '', window.location.pathname + window.location.search);
    try { return decodeURIComponent(match[1]); } catch { return ''; }
}

// What signed-out visitors see: the way in (sign in / sign up). /signup opens on sign-up.
// Any other address shows it too and stays, so after signing in that page opens.
export default function SignIn() {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const [email] = useState(takeEmailFromHash);
    const signUp = pathname === '/signup';

    return (
        <div className={styles.screen}>
            <header className={styles.brand}>
                <a href={LANDING_URL} className={styles.wordmark}>
                    <Logo className={styles.logo} /> <span translate="no">Quidey</span>
                </a>
                <a href={LANDING_URL} className={styles.about}>{t('whatIsQuidey')}</a>
            </header>
            {/* a new key opens it fresh when the address switches between /signin and /signup */}
            <Profile key={pathname} initialSignState={signUp || email ? 1 : 0} initialEmail={email} />
            <LegalFooter />
        </div>
    );
}
