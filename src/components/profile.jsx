import styles from './Profile.module.css';
import { useDispatch, useSelector } from "react-redux";
import { loginSuccess, logout } from "../features/auth/authAction";
import { useState } from "react";


export default function Profile(props){
    const { t } = props;

    const token = useSelector((state) => state.auth.token);
    const signedIn = Boolean(token);

    const dispatch = useDispatch();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const emptyProfilePictureSrc = "https://militaryhealthinstitute.org/wp-content/uploads/sites/37/2021/08/blank-profile-picture-png.png";

    const handleSignOut = () => {
        dispatch(logout());
    }

    const handleSignIn = (e, username, password) => {
        e.preventDefault();
        dispatch(loginSuccess(username, password));
        setUsername("");
        setPassword("");
    }

    return (
        <div className={styles.div}>
            {signedIn ? 
                <div id="profileDiv">
                    <img /* src={user.profilePicture ? user.profilePicture : emptyProfilePictureSrc} className={styles.profilePicture} */ />
                    <h2>{/*user.username*/}</h2>

                    <button onClick={() => handleSignOut()}>{t('signOut')}</button>
                </div> 
                : 
                <div id="signInDiv" className={styles.signInDiv}>
                    <h2 className={styles.h2}>{t('signIn')}</h2>
                    <form className={styles.signInForm} onSubmit={(e) => handleSignIn(e, username, password)} >
                        <input className={styles.input} placeholder={t('userName')} value={username} onChange={(e) => setUsername(e.target.value)} id="userNameInput" type="text" />
                        <input className={styles.input} placeholder={t('password')} value={password} onChange={(e) => setPassword(e.target.value)} id="passwordInput" type="password" />
                        <button className={styles.Btn} type="submit">{t('signIn')}</button>
                    </form>
                </div>
            }
        </div>
    );
}