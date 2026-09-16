import styles from './Profile.module.css';
import { useDispatch, useSelector } from "react-redux";
import { loginSuccess, logout, register } from "../features/auth/authAction";
import { useState } from "react";
import CustomError from './CustomError.jsx'


export default function Profile(props){
    const { t } = props;

    const token = useSelector((state) => state.auth.token);
    const signedIn = Boolean(token);

    const user = useSelector(state => state.auth.user)

    const dispatch = useDispatch();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const [passwordValidate, setPasswordValidate] = useState("");
    const [birthDate, setBirthDate] = useState("");
    const [email, setEmail] = useState("");
    const [displayName, setDisplayName] = useState("");


    const emptyProfilePictureSrc = "https://militaryhealthinstitute.org/wp-content/uploads/sites/37/2021/08/blank-profile-picture-png.png";

    const handleSignOut = () => {
        dispatch(logout());
    }

    const handleSignIn = (e, username, password) => {
        e.preventDefault();
        if (!username || !password) {
            setCustomError({bool: true, message: `${t('missingFieldsError')}`});
        }else if (password || passwordValidate === password && validateAge(birthDate)) {
            dispatch(loginSuccess(username, password));
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

    const handleSignUp = (e, email, birthDate, displayName, username, password, passwordValidate) => {
        e.preventDefault();
        if (!email || !birthDate || !displayName || !username || !password || !passwordValidate) {
            setCustomError({bool: true, message: `${t('missingFieldsError')}`});
        }else if (password || passwordValidate === password && validateAge(birthDate)) {
            dispatch(register( email, birthDate, displayName, username, password));
            setUsername("");
            setPassword("");
            setPasswordValidate("");
            setDisplayName("");
            setEmail("");
            setBirthDate("");
        } else if (passwordValidate !== password || !password) {
            setCustomError({bool: true, message: `${t('passwordValidateError')}`});
        } else {
            setCustomError({bool: true, message: `${t('ageError')}`});
        }
    }

    const [signState, setSignState] = useState(0);

    const signArr = ['signIn', 'signUp'];

    const setSignStateHandler = () => {
        if (signState === 1){ 
            setSignState(0) 
        } else if (signState === 0){ 
            setSignState(1) 
        } else { 
            setSignState(0) 
        };
    }

    const [customError, setCustomError] = useState({ bool: false, message: '' });

    console.log(user)

    return (
        <div className={styles.div}>
            <CustomError customError={customError} setCustomError={setCustomError}></CustomError>
            {signedIn ? 
                <div id="profileDiv">
                    <img src={emptyProfilePictureSrc} className={styles.profilePicture}/>
                    <h2>{user.display_name}</h2>
                    <h4>{user.username}</h4>
                    <p>{`${new Date(user.birth_date).getDate()}.${new Date(user.birth_date).getMonth()+1}.${new Date(user.birth_date).getFullYear()}`}</p>
                    <p>{user.email}</p>

                    <button onClick={() => handleSignOut()}>{t('signOut')}</button>
                </div> 
                : 
                <div>{signState === 0 && 
                    <div id="signInDiv" className={styles.signInDiv}>
                        <div className={styles.btnDiv}>
                            <button className={`${styles.signBtn} ${styles.signIn}`} onClick={setSignStateHandler}>{t(`${signArr[signState + 1] || signArr[0]}`)}</button>
                        </div>
                        <h2 className={styles.h2}>{t(signArr[signState])}</h2>
                        <form className={styles.signInForm} onSubmit={(e) => handleSignIn(e, username, password)} >
                            <label htmlFor="userNameInput" className={styles.label}>{t('userName')}</label>
                            <input className={styles.input} placeholder={t('userName')} value={username} onChange={(e) => setUsername(e.target.value)} id="userNameInput" type="text" />

                            <label htmlFor="passwordInput" className={styles.label}>{t('password')}</label>
                            <input className={styles.input} placeholder={t('password')} value={password} onChange={(e) => setPassword(e.target.value)} id="passwordInput" type="password" />

                            <button className={styles.Btn} type="submit">{t('signIn')}</button>
                        </form>
                    </div>
                    ||
                    <div id="signUpDiv" className={styles.signInDiv}>
                        <div className={styles.btnDiv}>
                            <button className={`${styles.signBtn} ${styles.signIn}`} onClick={setSignStateHandler}>{t(`${signArr[signState + 1] || signArr[0]}`)}</button>
                        </div>
                        <h2 className={styles.h2}>{t(signArr[signState])}</h2>
                        <form className={styles.signInForm} onSubmit={(e) => handleSignUp(e, email, birthDate, displayName, username, password, passwordValidate)} >
                            <label htmlFor="emailInput" className={styles.label}>{t('email')}</label>
                            <input className={styles.input} placeholder={t('email')} value={email} onChange={(e) => setEmail(e.target.value)} id="emailInput" type="email" />

                            <label htmlFor="birthDateInput" className={styles.label}>{t('birthDate')}</label>
                            <input className={styles.input} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} id="birthDateInput" type="date" />

                            <label htmlFor="displayNameInput" className={styles.label}>{t('displayName')}</label>
                            <input className={styles.input} placeholder={t('displayName')} value={displayName} onChange={(e) => setDisplayName(e.target.value)} id="displayNameInput" type="text" />

                            <label htmlFor="userNameInput" className={styles.label}>{t('userName')}</label>
                            <input className={styles.input} placeholder={t('userName')} value={username} onChange={(e) => setUsername(e.target.value)} id="userNameInput" type="text" />

                            <label htmlFor="passwordInput" className={styles.label}>{t('password')}</label>
                            <input className={styles.input} placeholder={t('password')} value={password} onChange={(e) => setPassword(e.target.value)} id="passwordInput" type="password" />

                            <label htmlFor="passwordValidateInput" className={styles.label}>{t('passwordValidate')}</label>
                            <input className={styles.input} placeholder={t('passwordValidate')} value={passwordValidate} onChange={(e) => setPasswordValidate(e.target.value)} id="passwordValidateInput" type="password" />

                            <button className={styles.Btn} type="submit">{t('signUp')}</button>
                        </form>
                    </div>
                    }
                </div>
            }
        </div>
    );
}