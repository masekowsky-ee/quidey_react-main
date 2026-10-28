import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { selectFocusTask, setFocusTask, selectTaskTime } from '../../features/session/sessionAction';
import { selectSharedSoloTasks } from '../../features/together/togetherAction';
import { updateTaskProps } from '../../features/tasks/taskAction';
import { isEvent } from '../../features/tasks/kinds';
import { fill, formatClock, sameDay, parseDate } from '../../features/helperFunction';
import { burstFrom, useMotionLevel } from '../../features/settings/motion';
import { playSound } from '../../features/settings/sound';
import { useTranslation } from '../../i18n/useTranslation';
import FocusTimer from './FocusTimer.jsx';
import Notebook from './Notebook.jsx';
import { SessionIntent, ParkingLot, FocusSounds, StudyMethod, RoundRecap } from './StudyTools.jsx';
import Icon from '../icons.jsx';
import styles from './FocusRoom.module.css';

// The task being worked on, and a way to pick another one (own open tasks, then shared ones)
function FocusTaskCard({ task }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const motion = useMotionLevel();
    const tasks = useSelector(state => state.task.tasks);
    const shared = useSelector(selectSharedSoloTasks);
    const seconds = useSelector(state => task ? selectTaskTime(state, task.id) : 0);
    const open = useMemo(() => tasks.filter(item => !item.done && !isEvent(item)), [tasks]);
    const openShared = shared.filter(item => !item.done);

    const pick = (value) => {
        if (!value) { dispatch(setFocusTask(null)); return; }
        const next = [...open, ...openShared].find(item => String(item.id) === value);
        if (next) dispatch(setFocusTask(next));
    };
    const finish = (e) => {
        if (!task || task.shared) return;
        if (motion !== 'minimal') burstFrom(e.currentTarget);
        playSound('done');
        dispatch(updateTaskProps({ done: true }, task));
    };

    return (
        <section className={styles.taskCard} aria-labelledby="focus-task-title">
            <h2 id="focus-task-title" className={styles.cardLabel}>{t('focusRoomTask')}</h2>
            {task
                ? <div className={styles.taskNow}>
                    <p className={styles.taskName}>{task.name}</p>
                    <p className={styles.taskMeta}>
                        {task.shared && <span>{task.shared.sessionName}</span>}
                        {seconds > 0 && <span>{fill(t('focusOnTaskThisSession'), { time: formatClock(seconds * 1000) })}</span>}
                    </p>
                    {!task.shared &&
                        <button type="button" className={styles.doneBtn} onClick={finish}>
                            <Icon name="check" size={16} strokeWidth={2.2} /> {t('focusTaskDone')}
                        </button>}
                </div>
                : <p className={styles.taskNone}>{t('focusRoomNoTask')}</p>}
            <label className={styles.pick}>
                <span className={styles.srOnly}>{t('focusRoomPick')}</span>
                <select value={task ? String(task.id) : ''} onChange={e => pick(e.target.value)}>
                    <option value="">{t('focusRoomPickNone')}</option>
                    {open.length > 0 && <optgroup label={t('focusRoomMine')}>
                        {open.map(item => <option key={item.id} value={String(item.id)}>{item.name}</option>)}
                    </optgroup>}
                    {openShared.length > 0 && <optgroup label={t('focusRoomShared')}>
                        {openShared.map(item => <option key={item.id} value={String(item.id)}>{item.name}</option>)}
                    </optgroup>}
                </select>
            </label>
        </section>
    );
}

// Today in numbers: focus minutes and sessions (saved ones plus the one going on)
function TodayLine() {
    const { t } = useTranslation();
    const saved = useSelector(state => state.session.workedSessionData);
    const current = useSelector(state => state.session.currentSessionData.totalTime);
    const { round } = useSelector(state => state.session.pomodoro);
    const today = new Date();
    const todays = saved.filter(session => { const d = parseDate(session.date); return d && sameDay(d, today); });
    const minutes = Math.round((todays.reduce((sum, s) => sum + (s.totalTime ?? 0), 0) + current) / 60);
    return (
        <p className={styles.todayLine}>
            <span>{fill(t('focusTodayMinutes'), { n: minutes })}</span>
            <span>{fill(t(todays.length === 1 ? 'focusTodaySessionsOne' : 'focusTodaySessions'), { n: todays.length })}</span>
            {round > 0 && <span>{fill(t('focusTodayPomodoros'), { n: round })}</span>}
        </p>
    );
}

// Full screen: nothing but the Fokusraum (Escape leaves it)
function useFullscreen() {
    const [full, setFull] = useState(() => typeof document !== 'undefined' && Boolean(document.fullscreenElement));
    useEffect(() => {
        const update = () => setFull(Boolean(document.fullscreenElement));
        document.addEventListener('fullscreenchange', update);
        return () => document.removeEventListener('fullscreenchange', update);
    }, []);
    const supported = typeof document !== 'undefined' && Boolean(document.documentElement.requestFullscreen);
    const toggle = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});
    return { full, toggle, supported };
}

// The Fokusraum (/focus): the place to work and study. The big timer (Pomodoro, countdown or
// stopwatch), the task in focus, what this session is for, a parking lot for stray thoughts,
// focus sounds, study methods, a recap after each Pomodoro, and the notebook beside it all.
export default function FocusRoom() {
    const { t } = useTranslation();
    const task = useSelector(selectFocusTask);
    const [notesVersion, setNotesVersion] = useState(0);
    const { full, toggle, supported } = useFullscreen();

    return (
        <div className={styles.page} data-part="focus-room">
            <header className={styles.head}>
                <div>
                    <h1 className={styles.title}>{t('focusRoom')}</h1>
                    <p className={styles.subtitle}>{t('focusRoomSubtitle')}</p>
                </div>
                <div className={styles.headActions}>
                    <Link to="/routines" className={styles.ghostLink}><Icon name="routine" size={16} /> {t('routines')}</Link>
                    {supported &&
                        <button type="button" className={styles.ghostLink} onClick={toggle} aria-pressed={full}>
                            <Icon name="expand" size={16} /> {full ? t('focusFullscreenLeave') : t('focusFullscreen')}
                        </button>}
                </div>
            </header>

            <div className={styles.columns}>
                <div className={styles.mainCol}>
                    <FocusTimer />
                    <SessionIntent />
                    <FocusTaskCard task={task} />
                    <RoundRecap focusTask={task} onSaved={() => setNotesVersion(v => v + 1)} />
                    <TodayLine />
                    <div className={styles.tools}>
                        <ParkingLot />
                        <FocusSounds />
                        <StudyMethod />
                    </div>
                </div>
                <aside className={styles.notesCol} aria-labelledby="notebook-title">
                    <h2 id="notebook-title" className={styles.cardLabel}><Icon name="note" size={16} /> {t('notebook')}</h2>
                    <Notebook key={notesVersion} focusTask={task} />
                </aside>
            </div>
        </div>
    );
}
