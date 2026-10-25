import { useEffect, useRef, useState } from 'react';
import { COMMUNITY_PATHS, friendsPath } from '../features/community/paths';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import styles from './Tutorial.module.css';
import { useTranslation } from '../i18n/useTranslation';
import { setShowTutorial, showForms } from '../features/settings/settingsAction';
import { hasSeenTutorial, storeTutorialSeen } from '../features/settings/preferences';
import { MOTION, useCelebrate, useMotionLevel } from '../features/settings/motion';
import { useIsTester } from '../features/auth/tester';
import { PHONE_QUERY, useMediaQuery } from '../features/layout/breakpoints';
import { useNavModel } from '../features/tester/variants';
import { fill } from '../features/helperFunction';

import Icon from './icons';
import TourPreview from './tour/TourPreview';

// The chapters of the tour, in the order a student meets them: plan, focus, see the week, grow,
// do it with friends, look back, make it yours. Texts per step (tourTexts.js): tut_<id>_short,
// _title, _text and _tips. `go` is the step's one way out: open its page (`to`, named by the
// translation key `page`, or by `label`) or the new-task form (`newTask`).
const STEPS = [
    { id: 'welcome' },
    { id: 'plan', go: { newTask: true, label: 'tutNewTask' } },
    { id: 'focus', go: { to: '/', page: 'home' } },
    { id: 'calendar', go: { to: '/calendar', page: 'calendar' } },
    { id: 'grow', go: { to: COMMUNITY_PATHS.progress, page: 'communityTab_progress' } },
    { id: 'together', go: { to: friendsPath('add'), label: 'tutFindFriends' } },
    { id: 'stats', go: { to: '/stats', page: 'history' } },
    { id: 'yours', go: { to: '/settings', page: 'settings' } },
    { id: 'ready' },
];

// the last step's first things to do
const FIRST_STEPS = [
    { newTask: true, label: 'tutNewTask', icon: 'plus' },
    { to: friendsPath('add'), label: 'tutFindFriends', icon: 'social' },
    { to: '/profile', label: 'tutDesignProfile', icon: 'profile' },
];

// a swipe this far (px) or this fast (px/s) turns the page
const SWIPE_DISTANCE = 60;
const SWIPE_SPEED = 400;

const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

// Where the navigation is right now: the tab bar (phones), the header's menu button (drawer),
// the sidebar, or another way of a tester's interface variant
function useNavPlace() {
    const phone = useMediaQuery(PHONE_QUERY);
    const model = useNavModel();
    if (phone) return 'phone';
    return model === 'drawer' || model === 'sidebar' ? model : 'other';
}

// The intro tour: one card per chapter, each with a small scene of the page it is about, a few
// tips and a way straight there. Opens by itself the first time an account signs in on this
// device, and any time from Settings → App. Arrow keys, the dots, the chapter chips or a swipe
// move through it.
export default function Tutorial() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const open = useSelector((state) => state.settings.showTutorial);
    const user = useSelector((state) => state.auth.user);
    const username = user?.username;
    const isTester = useIsTester();
    const nav = useNavPlace();
    const level = useMotionLevel();
    const celebrate = useCelebrate(0);
    const [index, setIndex] = useState(0);
    // direction of the last move, for the slide animation: 1 next, -1 back
    const [dir, setDir] = useState(1);
    const nextRef = useRef(null);
    const dialogRef = useRef(null);
    // where the focus was before the tour opened, it goes back there afterwards
    const returnFocus = useRef(null);

    const steps = STEPS;
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

    // out of the tour, to a page or into the new-task form; the tour is done then
    const act = (go) => {
        close({ restoreFocus: false });
        if (go.newTask) dispatch(showForms(true));
        else navigate(go.to);
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
    const text = step.id === 'ready' ? t(`tut_ready_text_${nav}`) : t(`tut_${step.id}_text`);
    const tips = [...t(`tut_${step.id}_tips`), ...(step.id === 'ready' && isTester ? [t('tut_ready_tester')] : [])];
    const goLabel = (to) => (to.label ? t(to.label) : fill(t('tutOpen'), { page: t(to.page) }));

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
                    <div className={styles.progressFill} style={{ transform: `scaleX(${(current + 1) / steps.length})` }} />
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
                    <div className={styles.stage}>
                        <TourPreview id={step.id} nav={nav} />
                    </div>

                    <div className={styles.copy}>
                        <p className={styles.eyebrow}>
                            {step.id === 'welcome' && name ? fill(t('tutHello'), { name }) : t(`tut_${step.id}_short`)}
                        </p>
                        <h2 id="tutorial-title" className={styles.title}>{t(`tut_${step.id}_title`)}</h2>
                        <p id="tutorial-text" className={styles.text}>{text}</p>
                        {tips.length > 0 && (
                            <ul className={styles.tips}>
                                {tips.map((tip) => <li key={tip} className={styles.tip}>{tip}</li>)}
                            </ul>
                        )}

                        {step.id === 'welcome' && (
                            <nav className={styles.chapters} aria-label={t('tutJump')}>
                                {steps.slice(1, -1).map((s, i) => (
                                    <button key={s.id} type="button" className={styles.chapter} onClick={() => go(i + 1)}>
                                        {t(`tut_${s.id}_short`)}
                                    </button>
                                ))}
                            </nav>
                        )}

                        {step.id === 'ready' && (
                            <div className={styles.firstSteps}>
                                <h3 className={styles.firstStepsTitle}>{t('tutFirstSteps')}</h3>
                                {FIRST_STEPS.map((first) => (
                                    <button key={first.label} type="button" className={styles.firstStep} onClick={() => act(first)}>
                                        <Icon name={first.icon} size={18} />
                                        <span>{t(first.label)}</span>
                                        <Icon name="arrowRight" size={16} className={styles.firstStepArrow} />
                                    </button>
                                ))}
                            </div>
                        )}

                        {step.go && (
                            <button type="button" className={styles.open} onClick={() => act(step.go)}>
                                {goLabel(step.go)}
                                <span aria-hidden="true">→</span>
                            </button>
                        )}
                    </div>
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
