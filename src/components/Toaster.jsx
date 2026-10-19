import styles from './Toaster.module.css';
import { useDispatch, useSelector } from 'react-redux';
import { hideToast } from '../features/toast/toast';

// Short messages at the bottom of the screen; they disappear by themselves, a click closes them
export default function Toaster() {
    const toasts = useSelector(state => state.toast);
    const dispatch = useDispatch();
    return (
        <div className={styles.toaster} role="status" aria-live="polite">
            {toasts.map(toast => (
                <button key={toast.id} className={`${styles.toast} ${styles[toast.tone] ?? ''}`} onClick={() => dispatch(hideToast(toast.id))}>
                    {toast.text}
                </button>
            ))}
        </div>
    );
}
