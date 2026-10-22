import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import styles from './AppIntro.module.css';
import { readStoredMotion } from '../../features/settings/motion';

// Remotion only loads for the intro, not with the app
const IntroPlayer = lazy(() => import('./IntroPlayer'));

// When someone signed in opens the app on its start page, on every motion level (the big one on
// "extreme"). Not on a reload or back/forward (the app is already open, that's a pause they
// didn't ask for), not on a page opened by a link (a notice, the calendar, a legal page:
// opened to see something right away) and not in tests. Visitors who aren't signed in land on
// the landing page and see it at once. Read once at start: changing the setting later doesn't
// replay it.
const signedIn = () => { try { return Boolean(localStorage.getItem('token')); } catch { return false; } };
const openedFresh = () => {
    try {
        const navigation = performance.getEntriesByType?.('navigation')?.[0];
        return !navigation || navigation.type === 'navigate';
    } catch {
        return true;
    }
};
const startLevel = () => (import.meta.env.MODE === 'test' || !signedIn() || window.location.pathname !== '/' || !openedFresh()
    ? null
    : readStoredMotion());

// The opening animation: the logo draws itself over the app, then the cover fades away.
// A click or any key skips it.
export default function AppIntro() {
    const [level] = useState(startLevel);
    const [show, setShow] = useState(level !== null);
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
