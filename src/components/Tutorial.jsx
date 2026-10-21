import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import styles from './Tutorial.module.css';
import { useTranslation } from '../i18n/useTranslation';
import { setShowTutorial } from '../features/settings/settingsAction';
import { hasSeenTutorial, storeTutorialSeen } from '../features/settings/preferences';
import { MOTION, useCelebrate, useMotionLevel } from '../features/settings/motion';
import { useIsTester } from '../features/auth/tester';
import { fill } from '../features/helperFunction';

import Icon from './icons';
import Logo from './Logo';

// The steps of the tour: icon, the page it is about (for the "open" button, `page` is the
// translation key of its name) and whether only testers get it. Texts per step:
// tut_<id>_title, tut_<id>_text and tut_<id>_tips (a list).
const STEPS = [
    { id: 'welcome' },
    { id: 'tasks', icon: 'tasks', to: '/', page: 'home' },
    { id: 'focus', icon: 'timer', to: '/', page: 'home' },
    { id: 'calendar', icon: 'calendar', to: '/calendar', page: 'calendar' },
    { id: 'friends', icon: 'social', to: '/social', page: 'social' },
    { id: 'together', icon: 'together', to: '/together', page: 'together' },
    { id: 'family', icon: 'family', to: '/family', page: 'family', tester: true },
    { id: 'inbox', icon: 'inbox', to: '/inbox', page: 'inbox' },
    { id: 'history', icon: 'history', to: '/history', page: 'history' },
    { id: 'settings', icon: 'settings', to: '/settings', page: 'settings' },
    { id: 'menu', icon: 'menu' },
];

// a swipe this far (px) or this fast (px/s) turns the page
const SWIPE_DISTANCE = 60;
const SWIPE_SPEED = 400;

const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

// The intro tour: a few cards that explain the app, each with tips and a button to the page it
// is about. Opens by itself the first time an account signs in on this device, and any time
// from the menu. Arrow keys, the dots or a swipe move through it.
export default function Tutorial() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const open = useSelector((state) => state.settings.showTutorial);
    const user = useSelector((state) => state.auth.user);
    const username = user?.username;
    const isTester = useIsTester();
    const level = useMotionLevel();
    const celebrate = useCelebrate(0);
    const [index, setIndex] = useState(0);
    // direction of the last move, for the slide animation: 1 next, -1 back
    const [dir, setDir] = useState(1);
    const nextRef = useRef(null);
    const dialogRef = useRef(null);
    // where the focus was before the tour opened, it goes back there afterwards
    const returnFocus = useRef(null);

    const steps = STEPS.filter((s) => !s.tester || isTester);
    const current = Math.min(index, steps.length - 1);
    const step = steps[current];
    const last = current === steps.length - 1;

    // first sign-in of this account here: show the tour once
    useEffect(() => {
        if (username && !hasSeenTutorial(username)) dispatch(setShowTutorial(true));
    }, [username, dispatch]);

    // focus goes to the main button, so Enter walks through the tour
    useEffect(() => {
        if (!open) return;
        returnFocus.current = document.activeElement;
        nextRef.current?.focus();
    }, [open]);

    const close = ({ restoreFocus = true } = {}) => {
        if (username) storeTutorialSeen(username);
        dispatch(setShowTutorial(false));
        // the next tour starts at the beginning
        setIndex(0);
        setDir(1);
        if (restoreFocus) returnFocus.current?.focus?.();
    };

    const finish = () => {
        celebrate();
        close();
    };

    // to the page a step is about; the tour is done then
    const openPage = () => {
        close({ restoreFocus: false });
        navigate(step.to);
    };

    const go = (to) => {
        if (to < 0 || to >= steps.length || to === current) return;
        setDir(to > current ? 1 : -1);
        setIndex(to);
    };

    // one step forward (1) or back (-1); from the latest index, so quick key presses all count
    const move = (delta) => {
        setDir(delta);
        setIndex((i) => Math.max(0, Math.min(steps.length - 1, Math.min(i, steps.length - 1) + delta)));
    };

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === 'Escape') close();
            else if (e.key === 'ArrowRight') move(1);
            else if (e.key === 'ArrowLeft') move(-1);
            else if (e.key === 'Home') go(0);
            else if (e.key === 'End') go(steps.length - 1);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    // Tab stays inside the dialog while it is open
    const trapFocus = (e) => {
        if (e.key !== 'Tab') return;
        const items = [...(dialogRef.current?.querySelectorAll(FOCUSABLE) ?? [])];
        if (items.length === 0) return;
        const first = items[0];
        const end = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            end.focus();
        } else if (!e.shiftKey && document.activeElement === end) {
            e.preventDefault();
            first.focus();
        }
    };

    const onSwipe = (_, { offset, velocity }) => {
        if (offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_SPEED) move(1);
        else if (offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_SPEED) move(-1);
    };

    if (!open) return null;

    const name = user?.display_name || username;
    const tips = t(`tut_${step.id}_tips`);

    return (
        <motion.div className={styles.backdrop} onClick={() => close()} {...MOTION.overlay[level]}>
            <motion.div
                ref={dialogRef}
                className={styles.dialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby="tutorial-title"
                aria-describedby="tutorial-text"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={trapFocus}
                {...MOTION.tourCard[level]}
            >
                <div className={styles.top}>
                    <span className={styles.counter}>{current + 1} / {steps.length}</span>
                    {!last && <button type="button" className={styles.skip} onClick={() => close()}>{t('tutSkip')}</button>}
                </div>

                <div className={styles.progress} aria-hidden="true">
                    <div className={styles.progressFill} style={{ width: `${((current + 1) / steps.length) * 100}%` }} />
                </div>

                <motion.div
                    key={step.id}
                    className={styles.body}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.35}
                    dragSnapToOrigin
                    onDragEnd={onSwipe}
                    {...MOTION.tourStep[level](dir)}
                >
                    {step.id === 'welcome' ? (
                        <Logo className={styles.logo} />
                    ) : (
                        <div className={styles.iconWrap} aria-hidden="true">
                            <Icon name={step.icon} className={styles.icon} strokeWidth={1.6} />
                        </div>
                    )}
                    {step.id === 'welcome' && name && <p className={styles.eyebrow}>{fill(t('tutHello'), { name })}</p>}
                    {step.tester && <span className={styles.badge}>{t('tutTesterBadge')}</span>}
                    <h2 id="tutorial-title" className={styles.title}>{t(`tut_${step.id}_title`)}</h2>
                    <p id="tutorial-text" className={styles.text}>{t(`tut_${step.id}_text`)}</p>
                    {Array.isArray(tips) && (
                        <ul className={styles.tips}>
                            {tips.map((tip) => <li key={tip} className={styles.tip}>{tip}</li>)}
                        </ul>
                    )}
                    {step.to && (
                        <button type="button" className={styles.open} onClick={openPage}>
                            {fill(t('tutOpen'), { page: t(step.page) })}
                            <span aria-hidden="true">→</span>
                        </button>
                    )}
                </motion.div>

                <div className={styles.dots} role="tablist" aria-label={t('tutorial')}>
                    {steps.map((s, i) => (
                        <button
                            key={s.id}
                            type="button"
                            role="tab"
                            aria-selected={i === current}
                            aria-label={t(`tut_${s.id}_title`)}
                            className={`${styles.dot} ${i === current ? styles.dotActive : ''} ${i < current ? styles.dotDone : ''}`}
                            onClick={() => go(i)}
                        />
                    ))}
                </div>

                <div className={styles.actions}>
                    <button type="button" className={styles.back} onClick={() => go(current - 1)} disabled={current === 0}>
                        {t('tutBack')}
                    </button>
                    <button ref={nextRef} type="button" className={styles.next} onClick={() => (last ? finish() : go(current + 1))}>
                        {last ? t('tutDone') : t('tutNext')}
                    </button>
                </div>
                <p className={styles.keys} aria-hidden="true">{t('tutKeys')}</p>
            </motion.div>
        </motion.div>
    );
}
