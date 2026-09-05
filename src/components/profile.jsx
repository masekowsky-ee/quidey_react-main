import styles from './Profile.module.css';
import { useDispatch, useSelector } from "react-redux";
import { loginSuccess, logout } from "../features/auth/authAction";
import { useState } from "react";


export default function Profile(props){
    const { t } = props;

    const token = useSelector((state) => state.auth.token);
    const signedIn = Boolean(token);

    const user = useSelector(state => state.auth.user)

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

    console.log(user)

    return (
        <div className={styles.div}>
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
                            <input className={styles.input} placeholder={t('userName')} value={username} onChange={(e) => setUsername(e.target.value)} id="userNameInput" type="text" />
                            <input className={styles.input} placeholder={t('password')} value={password} onChange={(e) => setPassword(e.target.value)} id="passwordInput" type="password" />
                            <button className={styles.Btn} type="submit">{t('signIn')}</button>
                        </form>
                    </div>}
                </div>
            }
        </div>
    );
}