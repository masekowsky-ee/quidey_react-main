import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logRoutineRun, readRoutineRun, storeRoutineRun, totalMinutes } from '../../features/routines/routines';
import { formatClock, fill } from '../../features/helperFunction';
import { playSound } from '../../features/settings/sound';
import { burst, useMotionLevel } from '../../features/settings/motion';
import { showToast } from '../../features/toast/toast';
import { useTranslation } from '../../i18n/useTranslation';
import Icon from '../icons.jsx';
import styles from './Routines.module.css';

// A run in progress: { routineId, startedAt, step, stepStartedAt, pausedAt, pausedMs, done: [indexes] }
const freshRun = (routine) => ({ routineId: routine.id, startedAt: Date.now(), step: 0, stepStartedAt: Date.now(), pausedAt: null, pausedMs: 0, done: [] });

// Goes through a routine one step at a time: the step big, its own countdown (when it has
// minutes), done / skip / back, the steps as a list beside it. Counted by the wall clock and kept
// on the device (routineRun), so a phone that goes off or a reload loses nothing. At the end the
// run is booked (POST /api/routines/:id/runs).
export default function RoutineRunner({ routine }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const motion = useMotionLevel();
    const [run, setRun] = useState(() => {
        const stored = readRoutineRun();
        return stored?.routineId === routine.id ? stored : freshRun(routine);
    });
    const [now, setNow] = useState(() => Date.now());
    const [finished, setFinished] = useState(null);
    const rang = useRef(null);
    const steps = routine.steps;
    const step = steps[run.step];

    useEffect(() => { if (!finished) storeRoutineRun(run); }, [run, finished]);
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 500);
        return () => clearInterval(id);
    }, []);

    const paused = run.pausedAt !== null;
    const elapsedStep = Math.max(0, (paused ? run.pausedAt : now) - run.stepStartedAt - run.pausedMs);
    const stepMs = (step?.minutes ?? 0) * 60 * 1000;
    const leftMs = stepMs - elapsedStep;
    const overtime = stepMs > 0 && leftMs <= 0;

    // the step's time is up: one sound (and a buzz on phones), once per step
    useEffect(() => {
        if (overtime && !paused && rang.current !== run.step) {
            rang.current = run.step;
            playSound('reminder');
            navigator.vibrate?.(200);
        }
    }, [overtime, paused, run.step]);

    const finish = async (doneList) => {
        const seconds = Math.round((Date.now() - run.startedAt) / 1000);
        storeRoutineRun(null);
        setFinished({ seconds, done: doneList.length });
        playSound(doneList.length === steps.length ? 'milestone' : 'done');
        if (motion !== 'minimal' && doneList.length === steps.length) burst(window.innerWidth / 2, window.innerHeight / 3, motion === 'extreme' ? 60 : 30);
        try {
            await dispatch(logRoutineRun(routine.id, { startedAt: new Date(run.startedAt).toISOString(), stepsDone: doneList.length, stepsTotal: steps.length, seconds }));
        } catch {
            dispatch(showToast(t('routineRunNotSaved'), 'error'));
        }
    };

    const goTo = (index, doneList = run.done) => {
        if (index >= steps.length) { finish(doneList); return; }
        setRun(prev => ({ ...prev, step: index, stepStartedAt: Date.now(), pausedAt: null, pausedMs: 0, done: doneList }));
    };
    const complete = () => {
        playSound('done');
        goTo(run.step + 1, [...new Set([...run.done, run.step])]);
    };
    const skip = () => goTo(run.step + 1);
    const back = () => run.step > 0 && goTo(run.step - 1, run.done.filter(i => i !== run.step - 1));
    const togglePause = () => setRun(prev => prev.pausedAt !== null
        ? { ...prev, pausedMs: prev.pausedMs + (Date.now() - prev.pausedAt), pausedAt: null }
        : { ...prev, pausedAt: Date.now() });
    const end = () => finish(run.done);

    if (finished) {
        const all = finished.done === steps.length;
        return (
            <section className={styles.runner} aria-live="polite">
                <div className={styles.finish}>
                    <span className={styles.finishEmoji} aria-hidden="true">{all ? '🎉' : routine.emoji || '✓'}</span>
                    <h2>{all ? t('routineFinishedAll') : t('routineFinishedSome')}</h2>
                    <p>{fill(t('routineFinishedText'), { name: routine.name, done: finished.done, total: steps.length, time: formatClock(finished.seconds * 1000) })}</p>
                    <div className={styles.finishActions}>
                        <button type="button" className={styles.primary} onClick={() => navigate('/routines')}>{t('routineBackToList')}</button>
                        <button type="button" className={styles.ghost} onClick={() => navigate('/')}>{t('routineToHome')}</button>
                    </div>
                </div>
            </section>
        );
    }

    const progress = (run.step / steps.length) * 100;
    return (
        <section className={styles.runner} aria-label={fill(t('routineRunning'), { name: routine.name })}>
            <div className={styles.runHead}>
                <button type="button" className={styles.ghost} onClick={end}><Icon name="close" size={16} /> {t('routineEnd')}</button>
                <span className={styles.runTitle}>{routine.emoji} {routine.name}</span>
                <span className={styles.runCount}>{fill(t('routineStepOf'), { n: run.step + 1, total: steps.length })}</span>
            </div>
            <div className={styles.runBar} role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={run.step}>
                <div className={styles.runBarFill} style={{ width: `${progress}%` }} />
            </div>

            <div className={styles.runBody}>
                <div className={styles.stepNow}>
                    <p className={styles.stepLabel}>{t('routineNow')}</p>
                    <h2 className={styles.stepTitle}>{step.title}</h2>
                    {stepMs > 0
                        ? <p className={styles.stepClock} data-over={overtime || undefined} role="timer">
                            {overtime ? `+${formatClock(-leftMs)}` : formatClock(leftMs)}
                        </p>
                        : <p className={styles.stepNoClock}>{t('routineNoTimer')}</p>}
                    {overtime && <p className={styles.stepOver}>{t('routineOvertime')}</p>}
                    <div className={styles.runControls}>
                        <button type="button" className={styles.round} onClick={back} disabled={run.step === 0} aria-label={t('routineBack')} title={t('routineBack')}>
                            <Icon name="release" size={20} />
                        </button>
                        <button type="button" className={styles.primaryBig} onClick={complete}>
                            <Icon name="check" size={22} strokeWidth={2.2} /> {run.step === steps.length - 1 ? t('routineDoneLast') : t('routineDoneNext')}
                        </button>
                        {stepMs > 0 &&
                            <button type="button" className={styles.round} onClick={togglePause} aria-label={paused ? t('focusResume') : t('focusPause')} title={paused ? t('focusResume') : t('focusPause')}>
                                <Icon name={paused ? 'play' : 'pause'} size={20} />
                            </button>}
                        <button type="button" className={styles.round} onClick={skip} aria-label={t('routineSkip')} title={t('routineSkip')}>
                            <Icon name="skip" size={20} />
                        </button>
                    </div>
                    {steps[run.step + 1] && <p className={styles.upNext}>{fill(t('routineUpNext'), { title: steps[run.step + 1].title })}</p>}
                </div>

                <ol className={styles.stepList} aria-label={t('routineSteps')}>
                    {steps.map((item, i) =>
                        <li key={i} data-state={i === run.step ? 'now' : run.done.includes(i) ? 'done' : i < run.step ? 'skipped' : 'next'}>
                            <span className={styles.stepDot} aria-hidden="true">{run.done.includes(i) ? <Icon name="check" size={12} strokeWidth={2.5} /> : i + 1}</span>
                            <span className={styles.stepText}>{item.title}</span>
                            {item.minutes > 0 && <span className={styles.stepMin}>{fill(t('minutesShort'), { n: item.minutes })}</span>}
                        </li>)}
                </ol>
            </div>
            <p className={styles.runFoot}>{fill(t('routineTotal'), { n: totalMinutes(routine) })}</p>
        </section>
    );
}
