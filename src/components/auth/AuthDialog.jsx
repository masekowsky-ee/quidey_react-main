import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { OPEN_AUTH_EVENT } from '../../features/auth/gate';
import { LANDING_URL } from '../../features/site';
import { GOOGLE_RETURN_PATH } from '../../features/auth/google';
import { useTranslation } from '../../i18n/useTranslation';
import { FormSheet } from '../QuickAdd.jsx';
import SheetGrabber from '../SheetGrabber.jsx';
import Profile from '../Profile.jsx';
import styles from './AuthDialog.module.css';

// The window that asks a visitor to sign in or sign up: opened by openAuth() (features/auth/gate.js)
// when they do something that needs an account. Closes itself once they are signed in.
export default function AuthDialog() {
    const { t } = useTranslation();
    const token = useSelector((state) => state.auth.token);
    const [ask, setAsk] = useState(null);

    useEffect(() => {
        const onOpen = (event) => {
            const { mode, email = '', googleReturn = false } = event.detail ?? {};
            // already open: only a wish to sign up changes it
            setAsk((current) => (current && mode !== 'signup' ? current : { mode, email, googleReturn, id: (current?.id ?? 0) + 1 }));
        };
        window.addEventListener(OPEN_AUTH_EVENT, onOpen);
        return () => window.removeEventListener(OPEN_AUTH_EVENT, onOpen);
    }, []);

    // signed in: the window has done its job (adjusted while rendering, not in an effect)
    const [seenToken, setSeenToken] = useState(token);
    if (token !== seenToken) {
        setSeenToken(token);
        if (token) setAsk(null);
    }

    if (!ask || token) return null;
    return (
        <FormSheet onClose={() => setAsk(null)}>
            {(sheet) => (
                <div className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="authDialogTitle" {...sheet.panel}>
                    <SheetGrabber />
                    <h2 id="authDialogTitle" className={styles.title}>{t('guestDialogTitle')}</h2>
                    <p className={styles.text}>{t('guestDialogText')}</p>
                    {/* a new key opens it fresh when the wish switches between signing in and up */}
                    <Profile key={ask.id} initialSignState={ask.mode === 'signup' || ask.email ? 1 : 0}
                        initialEmail={ask.email} googleReturn={ask.googleReturn || window.location.pathname === GOOGLE_RETURN_PATH} />
                    <a href={LANDING_URL} className={styles.about}>{t('whatIsQuidey')}</a>
                </div>
            )}
        </FormSheet>
    );
}
