import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import styles from './AppIntro.module.css';

// Remotion only loads for the intro, not with the app
const IntroPlayer = lazy(() => import('./IntroPlayer'));

const SEEN_KEY = 'introSeen';

// Once per browser session, not in tests and not for people who asked for less motion
function shouldPlay() {
    if (import.meta.env.MODE === 'test') return false;
    try {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
        if (sessionStorage.getItem(SEEN_KEY)) return false;
    } catch {
        // storage blocked: play it, it's short
    }
    return true;
}

// The opening animation: the logo draws itself over the app, then the cover fades away.
// A click or any key skips it.
export default function AppIntro() {
    const [show, setShow] = useState(shouldPlay);
    const close = useCallback(() => setShow(false), []);

    // remembered here, not while deciding: StrictMode decides twice
    useEffect(() => {
        try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* blocked */ }
    }, []);

    useEffect(() => {
        if (!show) return;
        window.addEventListener('keydown', close);
        return () => window.removeEventListener('keydown', close);
    }, [show, close]);

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    className={styles.intro}
                    onClick={close}
                    aria-hidden="true"
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                >
                    <Suspense fallback={null}>
                        <IntroPlayer onEnded={close} />
                    </Suspense>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
