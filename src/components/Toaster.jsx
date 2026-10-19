import styles from './Toaster.module.css';
import { useDispatch, useSelector } from 'react-redux';
import { hideToast } from '../features/toast/toast';
import { AnimatePresence, motion } from 'motion/react';
import { MOTION, useMotionLevel } from '../features/settings/motion';

// Short messages at the bottom of the screen; they disappear by themselves, a click closes them
export default function Toaster() {
    const toasts = useSelector(state => state.toast);
    const dispatch = useDispatch();
    const toastMotion = MOTION.toast[useMotionLevel()];
    return (
        <div className={styles.toaster} role="status" aria-live="polite">
            <AnimatePresence initial={false}>
                {toasts.map(toast => (
                    <motion.button key={toast.id} className={`${styles.toast} ${styles[toast.tone] ?? ''}`} onClick={() => dispatch(hideToast(toast.id))}
                        {...toastMotion}>
                        {toast.text}
                    </motion.button>
                ))}
            </AnimatePresence>
        </div>
    );
}
