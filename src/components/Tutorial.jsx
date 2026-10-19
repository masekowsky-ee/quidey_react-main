import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styles from './Tutorial.module.css';
import { useTranslation } from '../i18n/useTranslation';
import { setShowTutorial } from '../features/settings/settingsAction';
import { hasSeenTutorial, storeTutorialSeen } from '../features/settings/preferences';

import Icon from './icons';
import Logo from './Logo';

// Icon of each step (the welcome card shows the logo instead)
const STEP_ICONS = {
    tasks: 'tasks',
    timer: 'timer',
    calendar: 'calendar',
    history: 'history',
    together: 'social',
    settings: 'settings',
    menu: 'menu',
};

const STEPS = ['welcome', 'tasks', 'timer', 'calendar', 'history', 'together', 'settings', 'menu'];

// Translation keys of a step: tut_<step>_title, tut_<step>_text
const title = (step) => `tut_${step}_title`;
const text = (step) => `tut_${step}_text`;

// The intro tour: a few cards that explain the app. Opens by itself the first time an account
// signs in on this device, and any time from the menu.
export default function Tutorial() {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const open = useSelector((state) => state.settings.showTutorial);
    const username = useSelector((state) => state.auth.user?.username);
    const [index, setIndex] = useState(0);
    // direction of the last move, for the slide animation
    const [dir, setDir] = useState('next');
    const nextRef = useRef(null);

    // first sign-in of this account here: show the tour once
    useEffect(() => {
        if (username && !hasSeenTutorial(username)) dispatch(setShowTutorial(true));
    }, [username, dispatch]);

    // focus goes to the main button, so Enter walks through the tour
    useEffect(() => {
        if (open) nextRef.current?.focus();
    }, [open]);

    const last = index === STEPS.length - 1;

    const close = () => {
        if (username) storeTutorialSeen(username);
        dispatch(setShowTutorial(false));
        // the next tour starts at the beginning
        setIndex(0);
        setDir('next');
    };

    const go = (to) => {
        if (to < 0 || to >= STEPS.length) return;
        setDir(to > index ? 'next' : 'back');
        setIndex(to);
    };

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === 'Escape') close();
            else if (e.key === 'ArrowRight') go(index + 1);
            else if (e.key === 'ArrowLeft') go(index - 1);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    if (!open) return null;

    const step = STEPS[index];

    return (
        <div className={styles.backdrop} onClick={close}>
            <div
                className={styles.dialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby="tutorial-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.top}>
                    <span className={styles.counter}>{index + 1} / {STEPS.length}</span>
                    {!last && <button type="button" className={styles.skip} onClick={close}>{t('tutSkip')}</button>}
                </div>

                <div key={step} className={`${styles.body} ${dir === 'back' ? styles.fromLeft : styles.fromRight}`}>
                    {step === 'welcome' ? (
                        <Logo className={styles.logo} />
                    ) : (
                        <div className={styles.iconWrap} aria-hidden="true">
                            <Icon name={STEP_ICONS[step]} className={styles.icon} strokeWidth={1.6} />
                        </div>
                    )}
                    <h2 id="tutorial-title" className={styles.title}>{t(title(step))}</h2>
                    <p className={styles.text}>{t(text(step))}</p>
                </div>

                <div className={styles.dots} role="tablist" aria-label={t('tutorial')}>
                    {STEPS.map((s, i) => (
                        <button
                            key={s}
                            type="button"
                            role="tab"
                            aria-selected={i === index}
                            aria-label={t(title(s))}
                            className={`${styles.dot} ${i === index ? styles.dotActive : ''}`}
                            onClick={() => go(i)}
                        />
                    ))}
                </div>

                <div className={styles.actions}>
                    <button type="button" className={styles.back} onClick={() => go(index - 1)} disabled={index === 0}>
                        {t('tutBack')}
                    </button>
                    <button ref={nextRef} type="button" className={styles.next} onClick={() => (last ? close() : go(index + 1))}>
                        {last ? t('tutDone') : t('tutNext')}
                    </button>
                </div>
            </div>
        </div>
    );
}
