import styles from './GoogleSignIn.module.css';
import profileStyles from '../Profile.module.css';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { registerWithGoogle } from '../../features/auth/authAction';

// Google's "G" in its four colours (Google's sign-in branding guidelines: the logo unchanged,
// on a white or dark neutral button, with "Sign in with Google")
function GoogleLogo() {
    return (
        <svg className={styles.logo} viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
    );
}

// "Mit Google anmelden": the same button signs in and signs up (a new Google account is asked
// for the rest afterwards, GoogleSignupForm)
export function GoogleButton({ onClick, busy }) {
    const { t } = useTranslation();
    return (
        <>
            <div className={styles.or} aria-hidden="true"><span>{t('googleOr')}</span></div>
            <button type="button" className={styles.button} onClick={onClick} disabled={busy} aria-busy={busy}>
                <GoogleLogo />
                <span>{busy ? t('googleBusy') : t('googleSignIn')}</span>
            </button>
        </>
    );
}

const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,30}$/;

const ageOn = (value, today = new Date()) => {
    const [year, month, day] = value.split('-').map(Number);
    let age = today.getFullYear() - year;
    if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age--;
    return age;
};

// A Google account without a Quidey account yet: what every account needs besides the address
// (which is Google's and confirmed): display name, username, birth date and the consents.
// signup: { token, email, name, username } from the server.
export function GoogleSignupForm({ signup, onCancel, onError }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [displayName, setDisplayName] = useState(signup.name || '');
    const [username, setUsername] = useState(signup.username || '');
    const [birthDate, setBirthDate] = useState('');
    const [consents, setConsents] = useState({ terms: false, privacy: false, age: false });
    const [sending, setSending] = useState(false);
    const toggle = (key) => (e) => setConsents((prev) => ({ ...prev, [key]: e.target.checked }));

    const submit = async (e) => {
        e.preventDefault();
        const problem = !displayName.trim() || !username.trim() || !birthDate ? 'missingFieldsError'
            : !USERNAME_PATTERN.test(username.trim()) ? 'authError_INVALID_USERNAME'
            : ageOn(birthDate) < 14 ? 'ageError'
            : !consents.terms ? 'authError_TERMS_REQUIRED'
            : !consents.privacy ? 'authError_PRIVACY_REQUIRED'
            : !consents.age ? 'authError_AGE_CONFIRMATION_REQUIRED' : null;
        if (problem) return onError(t(problem));
        setSending(true);
        try {
            await dispatch(registerWithGoogle({ signupToken: signup.token, username: username.trim(), displayName: displayName.trim(), birthDate }));
        } catch (err) {
            const key = `authError_${err?.code}`;
            onError(t(key) !== key ? t(key) : t('friendError_generic'));
            setSending(false);
        }
    };

    return (
        <form className={profileStyles.form} onSubmit={submit}>
            <div className={styles.intro}>
                <GoogleLogo />
                <div>
                    <p className={styles.introTitle}>{t('googleSignupTitle')}</p>
                    <p className={styles.introText}>{t('googleSignupText')} <strong>{signup.email}</strong></p>
                </div>
            </div>
            <div className={profileStyles.fieldRow}>
                <div className={profileStyles.field}>
                    <label htmlFor="googleDisplayName">{t('displayName')}</label>
                    <input id="googleDisplayName" value={displayName} maxLength={50} autoComplete="name" onChange={(e) => setDisplayName(e.target.value)} />
                </div>
                <div className={profileStyles.field}>
                    <label htmlFor="googleBirthDate">{t('birthDate')}</label>
                    <input id="googleBirthDate" type="date" value={birthDate} autoComplete="bday" onChange={(e) => setBirthDate(e.target.value)} />
                </div>
            </div>
            <div className={profileStyles.field}>
                <label htmlFor="googleUsername">{t('userName')}</label>
                <input id="googleUsername" value={username} maxLength={30} autoComplete="username" onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className={profileStyles.consents}>
                <label className={profileStyles.consent}>
                    <input type="checkbox" checked={consents.terms} onChange={toggle('terms')} />
                    <span>{t('acceptTermsBefore')}<a href="/nutzungsbedingungen" target="_blank" rel="noopener">{t('termsLink')}</a>{t('acceptTermsAfter')}</span>
                </label>
                <label className={profileStyles.consent}>
                    <input type="checkbox" checked={consents.privacy} onChange={toggle('privacy')} />
                    <span>{t('acceptPrivacyBefore')}<a href="/datenschutz" target="_blank" rel="noopener">{t('privacyLink')}</a>{t('acceptPrivacyAfter')}</span>
                </label>
                <label className={profileStyles.consent}>
                    <input type="checkbox" checked={consents.age} onChange={toggle('age')} />
                    <span>{t('confirmAge')}</span>
                </label>
            </div>
            <button className={profileStyles.submitBtn} type="submit" disabled={sending} aria-busy={sending}>
                {sending ? t('signingUp') : t('googleSignupCreate')}
            </button>
            <button type="button" className={styles.back} onClick={onCancel}>{t('cancel')}</button>
        </form>
    );
}
