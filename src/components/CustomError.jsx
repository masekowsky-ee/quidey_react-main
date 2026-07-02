import React, {useState} from 'react';
import styles from './CustomError.module.css';

export default function CustomError(props){
    const {t, customError, setCustomError} = props;

    const errorOk = () => {
        setCustomError({bool: false, message: ''});
    }

    return (
        <div className={`${styles.div} ${customError.bool ? '' : styles.hidden}`}>
            <div className={styles.innerDiv}>
                <h2 className={styles.h2}>{customError.message}</h2>
                <button className={styles.okBtn} onClick={errorOk}>OK</button>
            </div>
        </div>
    );
}