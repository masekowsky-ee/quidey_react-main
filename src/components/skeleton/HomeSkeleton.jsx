import styles from '../Home.module.css';
import timerStyles from '../TimerContainer.module.css';
import focusStyles from '../WorkingPage.module.css';
import { useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { formatClock } from '../../features/helperFunction';
import { DESKTOP_QUERY, useMediaQuery } from '../../features/layout/breakpoints';
import { DEFAULT_UI_VARIANT, useUiVariant } from '../../features/tester/variants';
import Icon from '../icons';
import { TaskListSkeleton } from './TaskListSkeleton.jsx';
import GroupBtnContainer from '../GroupBtnContainer.jsx';
import WeekDaysContainer from '../WeekDaysContainer.jsx';
import DayPlan from '../home/DayPlan.jsx';
import TitleRow from '../home/TitleRow.jsx';
import { FocusSheetSkeleton } from '../home/FocusSheet.jsx';
import { MomentumSkeleton } from '../home/Momentum.jsx';

const MODES = ['timer', 'pomodoro', 'stopwatch'];
const MODE_LABEL = { timer: 'timerModeTimer', pomodoro: 'timerModePomodoro', stopwatch: 'timerModeStopwatch' };

// Home before the app knows it may load anything (the start screen, see AppSkeleton): the same
// layout, the parts that need no data as they are, grey where tasks and progress will be
export function HomeSkeleton() {
    const desktop = useMediaQuery(DESKTOP_QUERY);
    const own = useUiVariant() === DEFAULT_UI_VARIANT;
    if (own) return (
        <div className={styles.page} data-part="home">
            <TitleRow tasks={[]} sentence />
            <div className={styles.board} data-part="home-columns">
                <div className={styles.focusArea}><FocusSheetSkeleton /></div>
                <div className={styles.dayArea}><DayPlan tasks={[]} /></div>
                <div className={`${styles.listArea} ${styles.listBlock}`} data-part="home-list">
                    <GroupBtnContainer setCreateGroup={() => {}} />
                    <TaskListSkeleton />
                </div>
                <aside className={styles.sideArea}>
                    <MomentumSkeleton stacked />
                </aside>
            </div>
        </div>
    );
    return (
        <div className={styles.page} data-part="home">
            <TitleRow tasks={[]} />
            <MomentumSkeleton />
            <WeekDaysContainer />
            <div className={styles.columns} data-part="home-columns">
                <div className={styles.mainCol} data-part="home-list">
                    <GroupBtnContainer setCreateGroup={() => {}} />
                    <TaskListSkeleton />
                </div>
                <aside className={styles.focusCol} data-part="home-focus">
                    <FocusSkeleton />
                    {desktop && <TimerSkeleton />}
                </aside>
            </div>
        </div>
    );
}

export function FocusSkeleton() {
    const { t } = useTranslation();
    return (
        <section className={focusStyles.focus} data-part="focus">
            <h2 className={focusStyles.focusTitle}>{t('focusTitle')}</h2>
            <div className={`${focusStyles.currentTaskDiv} ${focusStyles.dropZoneEmpty}`}>
                <div className={focusStyles.dropHint}>
                    <Icon name="focus" className={focusStyles.dropIcon} />
                    <p className={focusStyles.dropTitle}>{t('dragATask')}</p>
                    <p className={focusStyles.dropText}>{t('focusHint')}</p>
                </div>
            </div>
        </section>
    );
}

// from this device, so they are shown as they are; nothing in it works yet
export function TimerSkeleton() {
    const { t } = useTranslation();
    const { timer, timerMode } = useSelector(state => state.session);
    return (
        <div className={timerStyles.inlinePanel} data-part="timer">
            <div className={timerStyles.panelHead}>
                <div className={timerStyles.modeSwitch} aria-hidden="true">
                    {MODES.map(mode =>
                        <button key={mode} type="button" tabIndex={-1} className={timerMode === mode ? timerStyles.modeOn : timerStyles.mode}>
                            {t(MODE_LABEL[mode])}
                        </button>)}
                </div>
            </div>
            <div className={timerStyles.div}>
                <h2 className={timerMode === 'stopwatch' ? timerStyles.stopwatchH2 : timerStyles.timerH2}>{formatClock(timer.time)}</h2>
                <div className={timerStyles.progress} />
                <div className={timerStyles.timerNav}>
                    <button type="button" className={timerStyles.btnGo} tabIndex={-1} aria-hidden="true">
                        <Icon name="play" className={timerStyles.ctrlIcon} strokeWidth={2} />
                    </button>
                </div>
            </div>
        </div>
    );
}

// The task list on Home: the open tasks of the shown group (or all of them, with the tasks of
// my shared sessions), then, when asked for, the done ones. The task in focus is left out.
