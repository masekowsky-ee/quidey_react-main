import styles from './Inbox.module.css';
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from '../i18n/useTranslation';
import { FEEDBACK_CATEGORIES, sendFeedback } from '../features/inbox/inbox';

// Feedback for the operator: an idea, a bug, praise. Mailed with who sent it, so a reply can come back.
export default function Feedback() {
    const { t } = useTranslation();
    const [category, setCategory] = useState('idea');
    const [message, setMessage] = useState('');
    // where an answer goes: my account's address until I type another one
    const accountEmail = useSelector(state => state.auth.user?.email) ?? '';
    const [typedEmail, setTypedEmail] = useState(null);
    const email = typedEmail ?? accountEmail;
    const [state, setState] = useState({ sending: false, sent: false, error: '' });

    const submit = async (e) => {
        e.preventDefault();
        if (message.trim().length < 5) {
            setState({ sending: false, sent: false, error: t('feedbackError_INVALID_MESSAGE') });
            return;
        }
        setState({ sending: true, sent: false, error: '' });
        try {
            await sendFeedback(category, message.trim(), email.trim());
            setMessage('');
            setState({ sending: false, sent: true, error: '' });
        } catch (err) {
            const key = `feedbackError_${err?.code}`;
            setState({ sending: false, sent: false, error: t(key) !== key ? t(key) : t('feedbackError_generic') });
        }
    };

    return (
        <div className={styles.page}>
            <h1 className={styles.title}>{t('feedback')}</h1>
            <section className={styles.card}>
                <p className={styles.empty}>{t('feedbackIntro')}</p>
                {state.sent ? (
                    <div className={styles.thread}>
                        <p role="status"><strong>{t('feedbackThanks')}</strong></p>
                        <button className={styles.quietBtn} onClick={() => setState({ sending: false, sent: false, error: '' })}>{t('feedbackAnother')}</button>
                    </div>
                ) : (
                    <form className={styles.thread} onSubmit={submit}>
                        <div className={styles.tabs} role="radiogroup" aria-label={t('feedbackCategory')}>
                            {FEEDBACK_CATEGORIES.map(key => (
                                <button key={key} type="button" role="radio" aria-checked={category === key}
                                    className={category === key ? styles.tabActive : undefined} onClick={() => setCategory(key)}>
                                    {t(`feedback_${key}`)}
                                </button>
                            ))}
                        </div>
                        <label className={styles.subTitle} htmlFor="feedbackMessage">{t(`feedbackPrompt_${category}`)}</label>
                        <textarea id="feedbackMessage" className={styles.feedbackText} rows={7} maxLength={5000} value={message}
                            onChange={(e) => { setMessage(e.target.value); setState(s => ({ ...s, error: '' })); }} />
                        <label className={styles.subTitle} htmlFor="feedbackEmail">{t('feedbackEmail')}</label>
                        <input id="feedbackEmail" className={styles.feedbackEmail} type="email" autoComplete="email" maxLength={254}
                            value={email} aria-describedby="feedbackEmailHint"
                            onChange={(e) => { setTypedEmail(e.target.value); setState(s => ({ ...s, error: '' })); }} />
                        <p id="feedbackEmailHint" className={styles.fieldHint}>{t('feedbackEmailHint')}</p>
                        {state.error && <p className={styles.error} role="alert">{state.error}</p>}
                        <div>
                            <button type="submit" className={styles.sendBtn} disabled={state.sending}>
                                {state.sending ? t('feedbackSending') : t('feedbackSend')}
                            </button>
                        </div>
                    </form>
                )}
            </section>
        </div>
    );
}
