import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectFocusTask, selectTimerProgress, selectTimerInProgress, setTimerMode, setSessionParams, startFocus, pauseFocus, stopFocus, skipPhase, setPomodoro, PHASE_LABEL } from '../../features/session/sessionAction';
import { formatClock, fill } from '../../features/helperFunction';
import { POMODORO_LIMITS, validPomodoroValue, SESSION_LENGTHS } from '../../features/settings/preferences';
import { useTranslation } from '../../i18n/useTranslation';
import { useIsTester } from '../../features/auth/tester';
import Icon from '../icons.jsx';
import DurationInput from './DurationInput.jsx';
import styles from './FocusRoom.module.css';

const MODES = [['pomodoro', 'timerModePomodoro'], ['timer', 'timerModeTimer'], ['stopwatch', 'timerModeStopwatch']];
const RING = 2 * Math.PI * 54;

// A Pomodoro length (or the rounds before the long break) typed freely within its limits
function PomodoroField({ name, label, value, onChange, unit }) {
    const [draft, setDraft] = useState(null);
    const [min, max] = POMODORO_LIMITS[name];
    return (
        <label className={styles.lengthField}>
            <span>{label}</span>
            <span className={styles.lengthInput}>
                <input inputMode="numeric" pattern="[0-9]*" value={draft ?? String(value)}
                    onFocus={e => e.target.select()} onBlur={() => setDraft(null)}
                    onChange={e => {
                        const raw = e.target.value.replace(/\D/g, '').slice(0, 3);
                        setDraft(raw);
                        const n = Number(raw);
                        if (raw && validPomodoroValue(name, n)) onChange(n);
                    }} />
                <span aria-hidden="true">{unit}</span>
            </span>
            <span className={styles.lengthLimits}>{min}–{max}</span>
        </label>
    );
}

// Testers (in test): once the timer starts, the big card folds into a slim bar that stays at the
// top while scrolling (time, a thin progress line, the controls), so the room below gets the
// space. "Groß zeigen" opens it again; once nothing runs any more it is big again by itself.
function useMinimized(enabled) {
    const active = useSelector(state => state.session.timer.active);
    const inProgress = useSelector(selectTimerInProgress);
    const [minimized, setMinimized] = useState(false);
    // folds on every start (also after a pause), unfolds once the run is over
    const [seen, setSeen] = useState({ active, inProgress });
    if (seen.active !== active || seen.inProgress !== inProgress) {
        setSeen({ active, inProgress });
        if (active && !seen.active) setMinimized(true);
        if (!active && !inProgress) setMinimized(false);
    }
    return [enabled && minimized, setMinimized];
}

function MiniTimer({ onExpand }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { timer, timerMode, pomodoro } = useSelector(state => state.session);
    const percent = useSelector(selectTimerProgress);
    const isPomodoro = timerMode === 'pomodoro';
    const stopwatch = timerMode === 'stopwatch';
    const onBreak = isPomodoro && pomodoro.phase !== 'focus';
    const label = isPomodoro ? t(PHASE_LABEL[pomodoro.phase]) : timer.active ? t('focusRunning') : t('focusPaused');
    return (
        <section className={styles.miniTimer} data-break={onBreak || undefined} data-part="timer" aria-label={t('focusTimerTitle')}>
            <div className={styles.miniInfo}>
                <span className={styles.miniTime} role="timer" aria-live="off">{formatClock(timer.time)}</span>
                <span className={styles.phase}>{label}</span>
            </div>
            <div className={styles.miniControls}>
                {timer.active
                    ? <button type="button" className={styles.miniCtrl} onClick={() => dispatch(pauseFocus())} aria-label="pause timer" title={t('focusPause')}>
                        <Icon name="pause" size={18} strokeWidth={2.2} />
                    </button>
                    : <button type="button" className={styles.miniCtrl} onClick={() => dispatch(startFocus())} aria-label="start timer" title={t('focusResume')}>
                        <Icon name="play" size={18} strokeWidth={2} />
                    </button>}
                <button type="button" className={styles.miniCtrl} onClick={() => dispatch(stopFocus())} aria-label="stop timer" title={t('focusStop')}>
                    <Icon name="stop" size={18} strokeWidth={2} />
                </button>
                {isPomodoro &&
                    <button type="button" className={styles.miniCtrl} onClick={() => dispatch(skipPhase())} aria-label={t('pomodoroSkip')} title={t('pomodoroSkip')}>
                        <Icon name="skip" size={18} strokeWidth={2} />
                    </button>}
                <button type="button" className={styles.miniExpand} onClick={onExpand} aria-expanded="false">
                    <Icon name="expand" size={16} /> {t('focusTimerExpand')}
                </button>
            </div>
            {!stopwatch && <span className={styles.miniProgress} style={{ '--progress': `${percent}%` }} aria-hidden="true" />}
        </section>
    );
}

// The Fokusraum's big timer: a ring that fills as the time goes, the time in the middle, the
// controls under it. Same timer as everywhere (useFocusClock counts it, by the wall clock).
export default function FocusTimer() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { timer, timerMode, pomodoro, sessionParams } = useSelector(state => state.session);
    const percent = useSelector(selectTimerProgress);
    const inProgress = useSelector(selectTimerInProgress);
    const isTester = useIsTester();
    const study = useSelector(selectFocusTask)?.study;
    const [minimized, setMinimized] = useMinimized(isTester);
    const isPomodoro = timerMode === 'pomodoro';
    const stopwatch = timerMode === 'stopwatch';
    const onBreak = isPomodoro && pomodoro.phase !== 'focus';
    const inCycle = pomodoro.round % pomodoro.config.every;

    const setLength = (key, minutes) => dispatch(setPomodoro({ config: { [key]: minutes } }));

    if (minimized) return <MiniTimer onExpand={() => setMinimized(false)} />;

    return (
        <section className={styles.timerCard} data-break={onBreak || undefined} aria-label={t('focusTimerTitle')}>
            <div className={styles.segmented} role="group" aria-label={t('timerMode')}>
                {MODES.map(([mode, label]) =>
                    <button key={mode} type="button" aria-pressed={timerMode === mode} disabled={inProgress && timerMode !== mode}
                        className={timerMode === mode ? styles.segmentActive : undefined}
                        onClick={() => timerMode !== mode && dispatch(setTimerMode(mode))}>
                        {t(label)}
                    </button>)}
            </div>

            {study && <p className={styles.studyLine} data-task-color={study.subjectColor || undefined}>{study.subjectName} · {study.partName}</p>}

            <div className={styles.ringWrap}>
                <svg className={styles.ring} viewBox="0 0 120 120" aria-hidden="true">
                    <circle className={styles.ringTrack} cx="60" cy="60" r="54" />
                    {!stopwatch &&
                        <circle className={styles.ringFill} cx="60" cy="60" r="54"
                            strokeDasharray={RING} strokeDashoffset={RING * (1 - percent / 100)} />}
                    {stopwatch && timer.active && <circle className={styles.ringLive} cx="60" cy="60" r="54" />}
                </svg>
                <div className={styles.ringCenter}>
                    {isPomodoro && <span className={styles.phase}>{t(PHASE_LABEL[pomodoro.phase])}</span>}
                    <span className={styles.bigTime} role="timer" aria-live="off">{formatClock(timer.time)}</span>
                    {isPomodoro &&
                        <span className={styles.roundDots} aria-label={fill(t('pomodoroRoundOf'), { round: inCycle + (pomodoro.phase === 'focus' ? 1 : 0), every: pomodoro.config.every })}>
                            {Array.from({ length: pomodoro.config.every }, (_, i) =>
                                <span key={i} data-done={i < inCycle || (pomodoro.phase === 'long' && inCycle === 0 && pomodoro.round > 0) || undefined} />)}
                        </span>}
                    {!isPomodoro && <span className={styles.phase}>{timer.active ? t('focusRunning') : inProgress ? t('focusPaused') : t('focusReady')}</span>}
                </div>
            </div>

            <div className={styles.controls}>
                {(inProgress || (stopwatch && timer.time > 0)) &&
                    <button type="button" className={styles.ctrl} onClick={() => dispatch(stopFocus())} aria-label="stop timer" title={t('focusStop')}>
                        <Icon name="stop" size={20} strokeWidth={2} />
                    </button>}
                {timer.active
                    ? <button type="button" className={styles.ctrlMain} onClick={() => dispatch(pauseFocus())} aria-label="pause timer">
                        <Icon name="pause" size={26} strokeWidth={2.2} /><span>{t('focusPause')}</span>
                    </button>
                    : <button type="button" className={styles.ctrlMain} onClick={() => dispatch(startFocus())} aria-label="start timer">
                        <Icon name="play" size={26} strokeWidth={2} />
                        <span>{inProgress ? t('focusResume') : !stopwatch && timer.time < 1000 ? t('focusAgain') : onBreak ? t('pomodoroStartBreak') : t('focusStart')}</span>
                    </button>}
                {isPomodoro &&
                    <button type="button" className={styles.ctrl} onClick={() => dispatch(skipPhase())} aria-label={t('pomodoroSkip')} title={t('pomodoroSkip')}>
                        <Icon name="skip" size={20} strokeWidth={2} />
                    </button>}
            </div>

            {/* lengths: only while nothing runs */}
            {!inProgress && (isPomodoro
                ? <div className={styles.lengths}>
                    {[['focus', 'pomodoroFocus'], ['short', 'pomodoroShort'], ['long', 'pomodoroLong'], ['every', 'pomodoroEvery']].map(([key, label]) =>
                        <PomodoroField key={key} name={key} label={t(label)} value={pomodoro.config[key]}
                            unit={key === 'every' ? '×' : 'min'} onChange={value => setLength(key, value)} />)}
                </div>
                : timerMode === 'timer' &&
                <div className={styles.lengths}>
                    <DurationInput label={t('focusLength')} ms={sessionParams.time} presets={[...SESSION_LENGTHS, 90]}
                        onChange={time => dispatch(setSessionParams({ ...sessionParams, time }))} />
                </div>)}
            {isTester && inProgress &&
                <button type="button" className={styles.minimizeBtn} onClick={() => setMinimized(true)} aria-expanded="true">
                    {t('focusTimerMinimize')}
                </button>}
            <p className={styles.timerHint}>{t('focusPhoneOffHint')}</p>
        </section>
    );
}
