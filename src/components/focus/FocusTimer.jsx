import { useSelector, useDispatch } from 'react-redux';
import { selectTimerProgress, selectTimerInProgress, setTimerMode, setSessionParams, startFocus, pauseFocus, stopFocus, skipPhase, setPomodoro, PHASE_LABEL } from '../../features/session/sessionAction';
import { formatClock, fill } from '../../features/helperFunction';
import { POMODORO_CHOICES, SESSION_LENGTHS } from '../../features/settings/preferences';
import { useTranslation } from '../../i18n/useTranslation';
import Icon from '../icons.jsx';
import styles from './FocusRoom.module.css';

const MODES = [['pomodoro', 'timerModePomodoro'], ['timer', 'timerModeTimer'], ['stopwatch', 'timerModeStopwatch']];
const RING = 2 * Math.PI * 54;

// The Fokusraum's big timer: a ring that fills as the time goes, the time in the middle, the
// controls under it. Same timer as everywhere (useFocusClock counts it, by the wall clock).
export default function FocusTimer() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { timer, timerMode, pomodoro, sessionParams } = useSelector(state => state.session);
    const percent = useSelector(selectTimerProgress);
    const inProgress = useSelector(selectTimerInProgress);
    const isPomodoro = timerMode === 'pomodoro';
    const stopwatch = timerMode === 'stopwatch';
    const onBreak = isPomodoro && pomodoro.phase !== 'focus';
    const inCycle = pomodoro.round % pomodoro.config.every;

    const setLength = (key, minutes) => dispatch(setPomodoro({ config: { [key]: minutes } }));

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
                    : <button type="button" className={styles.ctrlMain} onClick={() => dispatch(startFocus())} aria-label="start timer"
                        disabled={!stopwatch && timer.time < 1000}>
                        <Icon name="play" size={26} strokeWidth={2} /><span>{inProgress ? t('focusResume') : onBreak ? t('pomodoroStartBreak') : t('focusStart')}</span>
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
                        <label key={key} className={styles.lengthField}>
                            <span>{t(label)}</span>
                            <select value={pomodoro.config[key]} onChange={e => setLength(key, Number(e.target.value))}>
                                {POMODORO_CHOICES[key].map(value =>
                                    <option key={value} value={value}>{key === 'every' ? fill(t('pomodoroEveryN'), { n: value }) : fill(t('minutesShort'), { n: value })}</option>)}
                            </select>
                        </label>)}
                </div>
                : timerMode === 'timer' &&
                <div className={styles.lengths}>
                    <label className={styles.lengthField}>
                        <span>{t('focusLength')}</span>
                        <select value={Math.round(sessionParams.time / 60000)} onChange={e => dispatch(setSessionParams({ ...sessionParams, time: Number(e.target.value) * 60000 }))}>
                            {[...new Set([...SESSION_LENGTHS, 90, 120, Math.round(sessionParams.time / 60000)])].filter(Boolean).sort((a, b) => a - b).map(value =>
                                <option key={value} value={value}>{fill(t('minutesShort'), { n: value })}</option>)}
                        </select>
                    </label>
                </div>)}
            <p className={styles.timerHint}>{t('focusPhoneOffHint')}</p>
        </section>
    );
}
