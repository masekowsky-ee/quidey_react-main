import styles from './Toaster.module.css';
import { useDispatch, useSelector } from 'react-redux';
import { hideToast } from '../features/toast/toast';
import { AnimatePresence, motion } from 'motion/react';

// Short messages at the bottom of the screen; they disappear by themselves, a click closes them
export default function Toaster() {
    const toasts = useSelector(state => state.toast);
    const dispatch = useDispatch();
    return (
        <div className={styles.toaster} role="status" aria-live="polite">
            <AnimatePresence initial={false}>
                {toasts.map(toast => (
                    <motion.button key={toast.id} className={`${styles.toast} ${styles[toast.tone] ?? ''}`} onClick={() => dispatch(hideToast(toast.id))}
                        layout
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
                        transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}>
                        {toast.text}
                    </motion.button>
                ))}
            </AnimatePresence>
        </div>
    );
}
