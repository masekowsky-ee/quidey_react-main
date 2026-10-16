import styles from './CustomError.module.css';
import {useSelector, useDispatch} from 'react-redux';
import {setCustomError} from '../features/settings/settingsAction'

export default function CustomError(){
    const customError = useSelector((state) => state.settings.customError);
    const dispatch = useDispatch();
    
    const errorOk = () => {
        dispatch(setCustomError({bool: false, message: ''}));
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