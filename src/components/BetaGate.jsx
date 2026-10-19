import styles from './BetaGate.module.css';
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../i18n/useTranslation';
import { formatDate } from '../features/helperFunction';
import { fetchAccess, logout, requestBetaAccess } from '../features/auth/authAction';

export const REASON_MIN = 10;
export const REASON_MAX = 1000;

// Shown while the server hasn't said yet whether I may use the app
export function AccessPending() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [retrying, setRetrying] = useState(false);
    const retry = async () => {
        setRetrying(true);
        await dispatch(fetchAccess()).catch(() => {});
        setRetrying(false);
    };
    return (
        <main className={styles.page} aria-busy="true">
            <section className={styles.card}>
                <p className={styles.text}>{t('betaConnecting')}</p>
                <div className={styles.actions}>
                    <button className={styles.secondaryBtn} onClick={retry} disabled={retrying}>{t('betaRetry')}</button>
                    <button className={styles.quietBtn} onClick={() => dispatch(logout())}>{t('logout')}</button>
                </div>
            </section>
        </main>
    );
}

// Closed beta: everybody without pro lands here after logging in or registering.
// They can ask for access once, with a reason; afterwards the screen shows how it stands.
export default function BetaGate() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const username = useSelector(state => state.auth.user?.username);
    const betaRequest = useSelector(state => state.auth.access.betaRequest);

    const [reason, setReason] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);
    const [checking, setChecking] = useState(false);

    const length = reason.trim().length;
    const valid = length >= REASON_MIN && length <= REASON_MAX;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!valid) return;
        setSending(true);
        setError(null);
        try {
            await dispatch(requestBetaAccess(reason.trim()));
        } catch (err) {
            const key = `betaError_${err.code}`;
            setError(t(key) === key ? t('friendError_generic') : t(key));
            // e.g. ALREADY_REQUESTED from another tab: show the request that exists
            dispatch(fetchAccess()).catch(() => {});
        } finally {
            setSending(false);
        }
    };

    const checkAgain = async () => {
        setChecking(true);
        await dispatch(fetchAccess()).catch(() => {});
        setChecking(false);
    };

    return (
        <main className={styles.page}>
            <section className={styles.card} aria-labelledby="betaTitle">
                <span className={styles.badge}>Beta</span>
                <h1 id="betaTitle" className={styles.title}>{t('betaTitle')}</h1>
                <p className={styles.text}>{t('betaIntro')}</p>
                {username && <p className={styles.signedInAs}>{t('betaSignedInAs')} <strong>@{username}</strong></p>}

                {!betaRequest && (
                    <form className={styles.form} onSubmit={handleSubmit}>
                        <label htmlFor="betaReason" className={styles.label}>{t('betaReasonLabel')}</label>
                        <textarea
                            id="betaReason"
                            className={styles.textarea}
                            value={reason}
                            maxLength={REASON_MAX}
                            rows={5}
                            onChange={(e) => { setReason(e.target.value); setError(null); }}
                            placeholder={t('betaReasonPlaceholder')}
                            aria-describedby="betaReasonHint"
                            required
                        />
                        <div className={styles.formFoot}>
                            <span id="betaReasonHint" className={styles.hint}>{t('betaOnlyOnce')}</span>
                            <span className={length > 0 && length < REASON_MIN ? styles.counterLow : styles.counter}>
                                {length}/{REASON_MAX}
                            </span>
                        </div>
                        {error && <p className={styles.error} role="alert">{error}</p>}
                        <button type="submit" className={styles.primaryBtn} disabled={!valid || sending}>
                            {t('betaRequestBtn')}
                        </button>
                    </form>
                )}

                {betaRequest && (
                    <div className={betaRequest.status === 'declined' ? styles.statusDeclined : styles.statusPending} role="status">
                        <p className={styles.statusTitle}>
                            {t(betaRequest.status === 'declined' ? 'betaDeclinedTitle' : 'betaPendingTitle')}
                        </p>
                        <p className={styles.text}>
                            {betaRequest.status === 'declined'
                                ? t('betaDeclinedText')
                                : `${t('betaPendingText')} (${formatDate(betaRequest.createdAt)})`}
                        </p>
                        {betaRequest.reason && <blockquote className={styles.reason}>{betaRequest.reason}</blockquote>}
                    </div>
                )}

                <div className={styles.actions}>
                    {betaRequest?.status !== 'declined' && (
                        <button className={styles.secondaryBtn} onClick={checkAgain} disabled={checking}>{t('betaCheckAgain')}</button>
                    )}
                    <button className={styles.quietBtn} onClick={() => dispatch(logout())}>{t('logout')}</button>
                </div>
            </section>
        </main>
    );
}
