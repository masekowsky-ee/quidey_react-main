import styles from './Toaster.module.css';
import { forwardRef, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { hideToast } from '../features/toast/toast';
import { AnimatePresence, motion } from 'motion/react';
import { MOTION, useMotionLevel } from '../features/settings/motion';
import { useTranslation } from '../i18n/useTranslation';

// how far (px) or how fast (px/s) a toast has to be swiped to count
const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 500;

// Swiping a toast: up opens it (when it has something to open), down or sideways closes it.
// A click right after a swipe doesn't count.
function useSwipe({ onClose, onOpen }) {
    const swiped = useRef(false);
    const far = (offset, velocity) => Math.abs(offset) > SWIPE_DISTANCE || Math.abs(velocity) > SWIPE_VELOCITY;
    return {
        props: {
            drag: true,
            dragSnapToOrigin: true,
            dragElastic: 0.6,
            onDragStart: () => { swiped.current = true; },
            onDragEnd: (_, { offset, velocity }) => {
                const vertical = Math.abs(offset.y) > Math.abs(offset.x);
                if (vertical && offset.y < 0 && far(offset.y, velocity.y)) (onOpen ?? onClose)();
                else if (vertical ? far(offset.y, velocity.y) : far(offset.x, velocity.x)) onClose();
                setTimeout(() => { swiped.current = false; });
            },
        },
        click: (action) => () => { if (!swiped.current) action(); },
    };
}

// Plain feedback ("Invite sent"): a click or a swipe closes it
const PlainToast = forwardRef(function PlainToast({ toast, onClose, ...motionProps }, ref) {
    const swipe = useSwipe({ onClose });
    return (
        <motion.button ref={ref} type="button" className={`${styles.toast} ${styles[toast.tone] ?? ''}`}
            onClick={swipe.click(onClose)} {...swipe.props} {...motionProps}>
            {toast.text}
        </motion.button>
    );
});

// Something that came in (a message, a notice, an invite): a click or a swipe up opens it,
// the cross or a swipe down / sideways only closes it
const LinkToast = forwardRef(function LinkToast({ toast, onClose, ...motionProps }, ref) {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const open = () => { onClose(); navigate(toast.to); };
    const swipe = useSwipe({ onClose, onOpen: open });
    return (
        <motion.div ref={ref} className={`${styles.toast} ${styles.link}`} {...swipe.props} {...motionProps}>
            <button type="button" className={styles.linkOpen} onClick={swipe.click(open)}>
                <span className={styles.linkTitle}>{toast.text}</span>
                {toast.detail && <span className={styles.linkDetail}>{toast.detail}</span>}
            </button>
            <button type="button" className={styles.close} onClick={swipe.click(onClose)} aria-label={t('toastClose')}>×</button>
        </motion.div>
    );
});

// Short messages at the bottom of the screen; they disappear by themselves and can be clicked
// or swiped away (one that came in opens on a click or a swipe up)
export default function Toaster() {
    const toasts = useSelector(state => state.toast);
    const dispatch = useDispatch();
    const toastMotion = MOTION.toast[useMotionLevel()];
    return (
        <div className={styles.toaster} role="status" aria-live="polite">
            <AnimatePresence initial={false}>
                {toasts.map(toast => {
                    const Toast = toast.to ? LinkToast : PlainToast;
                    return <Toast key={toast.id} toast={toast} onClose={() => dispatch(hideToast(toast.id))} {...toastMotion} />;
                })}
            </AnimatePresence>
        </div>
    );
}
