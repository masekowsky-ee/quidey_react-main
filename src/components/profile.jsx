import styles from './Profile.module.css';
import { useDispatch, useSelector } from "react-redux";
import { loginSuccess, logout, register } from "../features/auth/authAction";
import { useState } from "react";
import CustomError from './CustomError.jsx'
import ProfileView from './ProfileView.jsx'
import {useTranslation} from '../i18n/useTranslation'

export default function Profile(){
    const { t } = useTranslation();

    const token = useSelector((state) => state.auth.token);
    const signedIn = Boolean(token);

    const dispatch = useDispatch();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const [passwordValidate, setPasswordValidate] = useState("");
    const [birthDate, setBirthDate] = useState("");
    const [email, setEmail] = useState("");
    const [displayName, setDisplayName] = useState("");

    const handleSignOut = () => {
        dispatch(logout());
    }

    const handleSignIn = (e, username, password) => {
        e.preventDefault();
        if (!username || !password) {
            setCustomError({bool: true, message: `${t('missingFieldsError')}`});
        } else {
            dispatch(loginSuccess(username, password))
                .catch(err => setCustomError({bool: true, message: err.message}));
            setUsername("");
            setPassword("");
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
        } else {
            dispatch(register(username, displayName, email, birthDate, password))
                .catch(err => setCustomError({bool: true, message: err.message}));
            setUsername("");
            setPassword("");
            setPasswordValidate("");
            setDisplayName("");
            setEmail("");
            setBirthDate("");
        }
    }

    // 0 = sign in, 1 = sign up
    const [signState, setSignState] = useState(0);

    const signArr = ['signIn', 'signUp'];

    const [customError, setCustomError] = useState({ bool: false, message: '' });

    return (
        <div className={styles.page}>
            <CustomError customError={customError} setCustomError={setCustomError}></CustomError>
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
                                onClick={() => setSignState(i)}
                            >
                                {t(key)}
                            </button>
                        ))}
                    </div>

                    {signState === 0 ?
                        <form className={styles.form} onSubmit={(e) => handleSignIn(e, username, password)} >
                            <div className={styles.field}>
                                <label htmlFor="userNameInput">{t('userName')}</label>
                                <input placeholder={t('userName')} value={username} onChange={(e) => setUsername(e.target.value)} id="userNameInput" type="text" autoComplete="username" />
                            </div>
                            <div className={styles.field}>
                                <label htmlFor="passwordInput">{t('password')}</label>
                                <input placeholder={t('password')} value={password} onChange={(e) => setPassword(e.target.value)} id="passwordInput" type="password" autoComplete="current-password" />
                            </div>
                            <button className={styles.submitBtn} type="submit">{t('signIn')}</button>
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
                            <button className={styles.submitBtn} type="submit">{t('signUp')}</button>
                        </form>
                    }
                </section>
            }
        </div>
    );
}
