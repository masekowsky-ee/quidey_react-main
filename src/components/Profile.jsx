import styles from './Profile.module.css';
import { useDispatch, useSelector } from "react-redux";
import { loginSuccess, logout, register } from "../features/auth/authAction";
import { setCustomError as showError } from "../features/settings/settingsAction";
import { useRef, useState } from "react";
import CustomError from './CustomError.jsx'
import ProfileView from './ProfileView.jsx'
import ResendVerification from './ResendVerification.jsx'
import { listAccounts, switchAccount } from '../features/auth/accounts'
import {useTranslation} from '../i18n/useTranslation'

// Same rule as the server: 3-30 letters, digits, _ . or -
const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,30}$/;

// initialSignState / initialEmail: the sign-in screen opens it on "sign up" (/signup) with the
// address typed into the landing page's email line
export default function Profile({ initialSignState = 0, initialEmail = '' } = {}){
    const { t } = useTranslation();

    const token = useSelector((state) => state.auth.token);
    const signedIn = Boolean(token);

    const dispatch = useDispatch();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const [passwordValidate, setPasswordValidate] = useState("");
    const [birthDate, setBirthDate] = useState("");
    const [email, setEmail] = useState(initialEmail);
    const [displayName, setDisplayName] = useState("");
    // the three things to agree to before signing up, all required
    const [consents, setConsents] = useState({ terms: false, privacy: false, age: false });
    const toggleConsent = (key) => (e) => setConsents(prev => ({ ...prev, [key]: e.target.checked }));

    // after signing up, or when sign-in is refused for an unconfirmed address:
    // { kind: 'registered' | 'unverified', email }
    const [verifyNotice, setVerifyNotice] = useState(null);

    // one request at a time: a second click (or Enter) while it runs does nothing. The ref
    // catches clicks that come before React has drawn the disabled button.
    const [sending, setSending] = useState(false);
    const sendingRef = useRef(false);
    const once = (request) => {
        if (sendingRef.current) return;
        sendingRef.current = true;
        setSending(true);
        request().finally(() => {
            sendingRef.current = false;
            setSending(false);
        });
    };

    const handleSignOut = () => {
        dispatch(logout());
    }

    // the error box (CustomError) reads its message from the store
    const setCustomError = (error) => dispatch(showError(error));

    // The server's reason as a translated message (error.code, or the HTTP status for sign-in)
    const authErrorText = (err) => {
        const code = err?.code ?? (err?.status === 401 ? 'INVALID_LOGIN' : err?.status === 429 ? 'RATE_LIMITED' : null);
        const key = `authError_${code}`;
        return code && t(key) !== key ? t(key) : t('friendError_generic');
    };

    const handleSignIn = (e, username, password) => {
        e.preventDefault();
        if (!username || !password) {
            setCustomError({bool: true, message: `${t('missingFieldsError')}`});
        } else {
            setVerifyNotice(null);
            once(() => dispatch(loginSuccess(username, password))
                .catch(err => {
                    // signed in with the address: it goes straight into the new-link form
                    if (err?.code === 'EMAIL_NOT_VERIFIED') setVerifyNotice({ kind: 'unverified', email: username.includes('@') ? username.trim() : '' });
                    else setCustomError({bool: true, message: authErrorText(err)});
                    setPassword("");
                }));
        }
    }

    const validateAge = (birthDate) => {
        const minAge = 14;
        const today = new Date();

        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        return age >= minAge;
    }

    // Parse "YYYY-MM-DD" as a local date; new Date(str) would treat it as UTC
    const parseDateInput = (value) => {
        const [year, month, day] = value.split('-').map(Number);
        return new Date(year, month - 1, day);
    }

    const handleSignUp =(e, email, birthDate, displayName, username, password, passwordValidate) => {
        e.preventDefault();
        if (!email || !birthDate || !displayName || !username || !password || !passwordValidate) {
            setCustomError({bool: true, message: `${t('missingFieldsError')}`});
        } else if (passwordValidate !== password) {
            setCustomError({bool: true, message: `${t('passwordValidateError')}`});
        } else if (!validateAge(parseDateInput(birthDate))) {
            setCustomError({bool: true, message: `${t('ageError')}`});
        } else if (!USERNAME_PATTERN.test(username.trim())) {
            setCustomError({bool: true, message: t('authError_INVALID_USERNAME')});
        } else if (password.length < 8 || new TextEncoder().encode(password).length > 72) {
            setCustomError({bool: true, message: t('authError_WEAK_PASSWORD')});
        } else if (!consents.terms) {
            setCustomError({bool: true, message: t('authError_TERMS_REQUIRED')});
        } else if (!consents.privacy) {
            setCustomError({bool: true, message: t('authError_PRIVACY_REQUIRED')});
        } else if (!consents.age) {
            setCustomError({bool: true, message: t('authError_AGE_CONFIRMATION_REQUIRED')});
        } else {
            // on failure everything stays filled in, so only the wrong field needs fixing
            once(() => dispatch(register(username.trim(), displayName, email, birthDate, password))
                .then(() => {
                    // on to sign in, which works once the link in the mail is opened
                    setVerifyNotice({ kind: 'registered', email: email.trim() });
                    setSignState(0);
                    setPassword("");
                    setPasswordValidate("");
                })
                .catch(err => setCustomError({bool: true, message: authErrorText(err)})));
        }
    }

    // 0 = sign in, 1 = sign up
    const [signState, setSignState] = useState(initialSignState);
    // accounts still signed in on this device (while adding another one): one tap goes back
    const [savedAccounts] = useState(() => (signedIn ? [] : listAccounts()));

    const signArr = ['signIn', 'signUp'];


    return (
        <div className={styles.page}>
            {/* signed in, App.jsx already shows the error box */}
            {!signedIn && <CustomError />}
            {signedIn ?
                <ProfileView onSignOut={handleSignOut} />
                :
                <section className={`${styles.card} ${styles.authCard}`}>
                    <div className={styles.tabs} role="tablist">
                        {signArr.map((key, i) => (
                            <button
                                key={key}
                                role="tab"
                                aria-selected={signState === i}
                                className={signState === i ? styles.tabActive : undefined}
                                onClick={() => { setSignState(i); setVerifyNotice(null); }}
                            >
                                {t(key)}
                            </button>
                        ))}
                    </div>

                    {verifyNotice && (
                        <div className={styles.verifyNotice} role="status">
                            <p className={styles.verifyNoticeTitle}>
                                {t(verifyNotice.kind === 'registered' ? 'verifyRegisteredTitle' : 'authError_EMAIL_NOT_VERIFIED')}
                            </p>
                            <p>{verifyNotice.kind === 'registered'
                                ? `${t('verifyRegisteredText')} ${verifyNotice.email}`
                                : t('verifyUnverifiedText')}</p>
                            <ResendVerification key={verifyNotice.kind} initialEmail={verifyNotice.email} />
                        </div>
                    )}

                    {signState === 0 && savedAccounts.length > 0 &&
                        <div className={styles.savedAccounts}>
                            <p className={styles.savedTitle}>{t('accountsOnDevice')}</p>
                            {savedAccounts.map(account => (
                                <button key={account.username} type="button" className={styles.savedAccount} onClick={() => switchAccount(account.username)}>
                                    <span className={styles.savedAvatar} aria-hidden="true">{(account.displayName || account.username)[0].toUpperCase()}</span>
                                    <span className={styles.savedNames}>
                                        <span>{account.displayName || account.username}</span>
                                        <small>@{account.username}</small>
                                    </span>
                                    <span className={styles.savedGo} aria-hidden="true">→</span>
                                </button>
                            ))}
                            <p className={styles.savedOr}>{t('accountOrSignInOther')}</p>
                        </div>}

                    {signState === 0 ?
                        <form className={styles.form} onSubmit={(e) => handleSignIn(e, username, password)} >
                            <div className={styles.field}>
                                <label htmlFor="userNameInput">{t('userNameOrEmail')}</label>
                                <input placeholder={t('userNameOrEmail')} value={username} onChange={(e) => setUsername(e.target.value)} id="userNameInput" type="text" autoComplete="username" />
                            </div>
                            <div className={styles.field}>
                                <label htmlFor="passwordInput">{t('password')}</label>
                                <input placeholder={t('password')} value={password} onChange={(e) => setPassword(e.target.value)} id="passwordInput" type="password" autoComplete="current-password" />
                            </div>
                            <button className={styles.submitBtn} type="submit" disabled={sending} aria-busy={sending}>
                                {sending ? t('signingIn') : t('signIn')}
                            </button>
                        </form>
                        :
                        <form className={styles.form} onSubmit={(e) => handleSignUp(e, email, birthDate, displayName, username, password, passwordValidate)} >
                            <div className={styles.field}>
                                <label htmlFor="emailInput">{t('email')}</label>
                                <input placeholder={t('email')} value={email} onChange={(e) => setEmail(e.target.value)} id="emailInput" type="email" autoComplete="email" />
                            </div>
                            <div className={styles.fieldRow}>
                                <div className={styles.field}>
                                    <label htmlFor="displayNameInput">{t('displayName')}</label>
                                    <input placeholder={t('displayName')} value={displayName} onChange={(e) => setDisplayName(e.target.value)} id="displayNameInput" type="text" autoComplete="name" />
                                </div>
                                <div className={styles.field}>
                                    <label htmlFor="birthDateInput">{t('birthDate')}</label>
                                    <input value={birthDate} onChange={(e) => setBirthDate(e.target.value)} id="birthDateInput" type="date" autoComplete="bday" />
                                </div>
                            </div>
                            <div className={styles.field}>
                                <label htmlFor="userNameInput">{t('userName')}</label>
                                <input placeholder={t('userName')} value={username} onChange={(e) => setUsername(e.target.value)} id="userNameInput" type="text" autoComplete="username" />
                            </div>
                            <div className={styles.fieldRow}>
                                <div className={styles.field}>
                                    <label htmlFor="passwordInput">{t('password')}</label>
                                    <input placeholder={t('password')} value={password} onChange={(e) => setPassword(e.target.value)} id="passwordInput" type="password" autoComplete="new-password" />
                                </div>
                                <div className={styles.field}>
                                    <label htmlFor="passwordValidateInput">{t('passwordValidate')}</label>
                                    <input placeholder={t('passwordValidate')} value={passwordValidate} onChange={(e) => setPasswordValidate(e.target.value)} id="passwordValidateInput" type="password" autoComplete="new-password" />
                                </div>
                            </div>
                            {/* the legal pages open in a new tab, so the form stays filled in */}
                            <div className={styles.consents}>
                                <label className={styles.consent}>
                                    <input type="checkbox" checked={consents.terms} onChange={toggleConsent('terms')} />
                                    <span>
                                        {t('acceptTermsBefore')}
                                        <a href="/nutzungsbedingungen" target="_blank" rel="noopener">{t('termsLink')}</a>
                                        {t('acceptTermsAfter')}
                                    </span>
                                </label>
                                <label className={styles.consent}>
                                    <input type="checkbox" checked={consents.privacy} onChange={toggleConsent('privacy')} />
                                    <span>
                                        {t('acceptPrivacyBefore')}
                                        <a href="/datenschutz" target="_blank" rel="noopener">{t('privacyLink')}</a>
                                        {t('acceptPrivacyAfter')}
                                    </span>
                                </label>
                                <label className={styles.consent}>
                                    <input type="checkbox" checked={consents.age} onChange={toggleConsent('age')} />
                                    <span>{t('confirmAge')}</span>
                                </label>
                            </div>
                            <button className={styles.submitBtn} type="submit" disabled={sending} aria-busy={sending}>
                                {sending ? t('signingUp') : t('signUp')}
                            </button>
                        </form>
                    }
                </section>
            }
        </div>
    );
}
