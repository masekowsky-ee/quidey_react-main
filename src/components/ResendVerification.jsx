import styles from './Profile.module.css';
import { useState } from 'react';
import { useTranslation } from '../i18n/useTranslation';
import { requestVerificationMail } from '../features/auth/authAction';

// "Send the link again" for someone who can't sign in yet: asks for the email address.
// The server answers the same for every address, so this always says "sent".
export default function ResendVerification({ initialEmail = '' }) {
    const { t } = useTranslation();
    const [email, setEmail] = useState(initialEmail);
    const [state, setState] = useState(null); // null | 'sending' | 'sent' | error text

    const submit = async (e) => {
        e.preventDefault();
        setState('sending');
        try {
            await requestVerificationMail(email.trim());
            setState('sent');
        } catch (err) {
            const key = `verifyError_${err?.code}`;
            setState(t(key) === key ? t('verifyMailFailed') : t(key));
        }
    };

    if (state === 'sent') return <p className={styles.success} role="status">{t('verifyMailSentIfExists')}</p>;

    return (
        <form className={styles.resendForm} onSubmit={submit}>
            <div className={styles.field}>
                <label htmlFor="resendEmail">{t('email')}</label>
                <input id="resendEmail" type="email" value={email} autoComplete="email" required
                    onChange={(e) => { setEmail(e.target.value); if (state !== 'sending') setState(null); }} />
            </div>
            {state && state !== 'sending' && <p className={styles.error} role="alert">{state}</p>}
            <button type="submit" disabled={state === 'sending' || !email.trim()}>{t('verifySendNew')}</button>
        </form>
    );
}
