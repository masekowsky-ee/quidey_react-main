import styles from './BetaGate.module.css';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '../i18n/useTranslation';
import { verifyEmail, resendVerificationMail, setUser } from '../features/auth/authAction';
import ResendVerification from './ResendVerification.jsx';

// A token can only be used once: StrictMode runs the effect twice, so both runs share one request
const requests = new Map();
function verifyOnce(token) {
    if (!requests.has(token)) requests.set(token, verifyEmail(token));
    return requests.get(token);
}

// Opened from the link in the verification mail (/verify-email?token=...).
// Works signed in or not, with or without beta access.
export default function VerifyEmail() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const token = params.get('token') ?? '';
    const signedIn = useSelector(state => Boolean(state.auth.token));
    const isPro = useSelector(state => state.auth.access.isPro);

    // 'checking' | 'verified' | 'expired' | 'invalid' | 'error'
    const [status, setStatus] = useState(token ? 'checking' : 'invalid');
    const [resend, setResend] = useState(null); // null | 'sending' | 'sent' | 'failed'

    useEffect(() => {
        if (!token) return;
        let active = true;
        verifyOnce(token)
            .then(() => { if (active) setStatus('verified'); })
            .catch((err) => {
                if (!active) return;
                if (err.code === 'TOKEN_EXPIRED') setStatus('expired');
                else if (err.code === 'INVALID_TOKEN') setStatus('invalid');
                else setStatus('error');
            });
        return () => { active = false; };
    }, [token]);

    // the profile shows the new state right away
    useEffect(() => {
        if (status === 'verified' && signedIn && isPro) dispatch(setUser()).catch(() => {});
    }, [status, signedIn, isPro, dispatch]);

    const sendNewMail = async () => {
        setResend('sending');
        try {
            await resendVerificationMail();
            setResend('sent');
        } catch (err) {
            // already confirmed in the meantime (e.g. in another tab)
            if (err.code === 'ALREADY_VERIFIED') setStatus('verified');
            else setResend('failed');
        }
    };

    const failed = status === 'expired' || status === 'invalid' || status === 'error';

    return (
        <main className={styles.page} aria-busy={status === 'checking'}>
            <section className={styles.card} aria-labelledby="verifyTitle">
                <h1 id="verifyTitle" className={styles.title}>{t('verifyTitle')}</h1>

                {status === 'checking' && <p className={styles.text} role="status">{t('verifyChecking')}</p>}

                {status === 'verified' && (
                    <div className={styles.statusPending} role="status">
                        <p className={styles.statusTitle}>{t('verifyDoneTitle')}</p>
                        <p className={styles.text}>{t(signedIn ? 'verifyDoneText' : 'verifyDoneSignedOutText')}</p>
                    </div>
                )}

                {failed && (
                    <div className={styles.statusDeclined} role="alert">
                        <p className={styles.statusTitle}>{t(`verifyFailedTitle_${status}`)}</p>
                        <p className={styles.text}>{t(signedIn ? 'verifyFailedText' : 'verifyFailedSignedOutText')}</p>
                    </div>
                )}

                {failed && !signedIn && <ResendVerification />}

                {resend === 'sent' && <p className={styles.text} role="status">{t('verifyMailSent')}</p>}
                {resend === 'failed' && <p className={styles.error} role="alert">{t('verifyMailFailed')}</p>}

                <div className={styles.actions}>
                    {failed && signedIn && resend !== 'sent' && (
                        <button className={styles.secondaryBtn} onClick={sendNewMail} disabled={resend === 'sending'}>
                            {t('verifySendNew')}
                        </button>
                    )}
                    {status !== 'checking' && (
                        <button className={styles.quietBtn} onClick={() => navigate('/', { replace: true })}>
                            {t(signedIn ? 'verifyToApp' : 'verifyToSignIn')}
                        </button>
                    )}
                </div>
            </section>
        </main>
    );
}
