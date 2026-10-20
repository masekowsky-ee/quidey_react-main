import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import styles from './AppIntro.module.css';
import { readStoredMotion } from '../../features/settings/motion';
import { LEGAL_PATHS } from '../../legal/paths';

// Remotion only loads for the intro, not with the app
const IntroPlayer = lazy(() => import('./IntroPlayer'));

// Every time the app loads, except on "minimal" motion, on the legal pages and the mail link
// (those are opened to read something right away), and in tests.
// Read once at start: changing the setting later doesn't replay it.
const NO_INTRO_PATHS = [...LEGAL_PATHS, '/verify-email'];
const startLevel = () => (import.meta.env.MODE === 'test' || NO_INTRO_PATHS.includes(window.location.pathname)
    ? 'minimal'
    : readStoredMotion());

// The opening animation: the logo draws itself over the app, then the cover fades away.
// A click or any key skips it.
export default function AppIntro() {
    const [level] = useState(startLevel);
    const [show, setShow] = useState(level !== 'minimal');
    const close = useCallback(() => setShow(false), []);

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
                    transition={{ duration: level === 'extreme' ? 0.6 : 0.35, ease: [0.32, 0.72, 0, 1] }}
                >
                    <Suspense fallback={null}>
                        <IntroPlayer extreme={level === 'extreme'} onEnded={close} />
                    </Suspense>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
