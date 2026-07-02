import React, {useState} from 'react'
import styles from './Profile.module.css';

export default function Profile(props){
    const { t, signedIn, setSignedIn, user, setUser, users, setUsers } = props;

    const emptyProfilePictureSrc = "https://militaryhealthinstitute.org/wp-content/uploads/sites/37/2021/08/blank-profile-picture-png.png"

    const handleSignIn = (e) => {
        e.preventDefault();
        const signedInUser = users.find((user) => {return user.username === e.target[0].value && user.password === e.target[1].value});
        if(signedInUser){
            setUser(signedInUser);
            setSignedIn(true);

            e.target[0].value = '';
            e.target[1].value = '';
            console.log('signed in');
        } else{
            console.log('didn\'t find user');
            e.target[0].value = '';
            e.target[1].value = '';
        }
    }

    const handleSignOut = () => {
        setSignedIn(false);
        setUser(null);
    } 

    return (
        <div className={styles.div}>
            {signedIn ? 
                <div id="profileDiv">
                    <img src={user.profilePicture ? user.profilePicture : emptyProfilePictureSrc} className={styles.profilePicture} />
                    <h2>{user.username}</h2>

                    <button onClick={handleSignOut}>{t('signOut')}</button>
                </div> 
                : 
                <div id="signInDiv" className={styles.signInDiv}>
                    <h2 className={styles.h2}>{t('signIn')}</h2>
                    <form className={styles.signInForm} onSubmit={(e)=>handleSignIn(e)} >
                        <input className={styles.input} placeholder={t('userName')} id="userNameInput" type="text" />
                        <input className={styles.input} placeholder={t('password')} id="passwordInput" type="password" />
                        <button className={styles.Btn} type="submit">{t('signIn')}</button>
                    </form>
                </div>
            }
        </div>
    );
}