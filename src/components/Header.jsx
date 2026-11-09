import styles from './Header.module.css';
import {Link, useLocation} from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { setShowMenu } from '../features/settings/settingsAction'
import Icon from './icons'
import { selectTimerProgress, selectTimerInProgress } from '../features/session/sessionAction'
import TeamWorkPill from './together/TeamWorkPill'
import TeamQuickPanel from './together/TeamQuickPanel'
import DailyTicker from './DailyTicker'
import Logo from './Logo'
import { selectMenuBadgeCount, selectInboxCount } from '../features/inbox/inbox'
import { selectHasNews } from '../features/realtime/news'
import { useTranslation } from '../i18n/useTranslation'
import { fill } from '../features/helperFunction'
import TopNav from './variants/TopNav'
import { openCommands } from '../features/tester/commands'
import { UI_VARIANTS, useNavModel, useUiVariant } from '../features/tester/variants'

function formatTime(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const mmss = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return h > 0 ? `${h}:${mmss}` : mmss;
}

// The streak in the bar, on every page: a flame and the days. Burning once today counts, an
// outline while today still waits. Opens Home, where the streak has its own panel.
function StreakPill() {
    const { t } = useTranslation();
    const progress = useSelector((state) => state.progress.data);
    if (!progress || progress.streak <= 0) return null;
    const label = fill(t(progress.streakToday ? 'streakPillDone' : 'streakPillWaiting'), { days: progress.streak });
    return (
        <Link to="/" className={styles.streakPill} data-lit={progress.streakToday} aria-label={label} title={label}>
            <Icon name="flame" size={16} strokeWidth={1.8} />
            <span>{progress.streak}</span>
        </Link>
    );
}

export default function Header(){
    const activeTimer = useSelector(selectTimerInProgress);
    const percentWidth = useSelector(selectTimerProgress);
    const dispatch = useDispatch();
    const showMenu = () => {
        dispatch(setShowMenu(true));
    }
    const token = useSelector((state) => state.auth.token);
    const badgeCount = useSelector(selectMenuBadgeCount);
    const inboxCount = useSelector(selectInboxCount);
    const { pathname } = useLocation();
    const hasNews = useSelector(selectHasNews);
    const { t } = useTranslation();
    const timer = useSelector((state) => state.session.timer);
    const timerMode = useSelector((state) => state.session.timerMode);
    // wide screens: the main places in the bar ("bar", the app's own look), or for testers'
    // interface variants tabs on top (with the menu as a drawer), a rail or a command bar
    const nav = useNavModel();
    const commandBar = UI_VARIANTS[useUiVariant()].nav === 'command';
    return (
        <div className={`${styles.header} ${nav === 'top' ? styles.undocked : ''} ${nav === 'bar' ? styles.bar : ''}`} data-part="header">
            {token && <>
                <div className={styles.div} data-part="header-row">
                    {/* tablets only: desktop has the sidebar, phones the tab bar's "More" */}
                    <button onClick={()=>showMenu()} className={`${styles.btn} ${styles.menuBtn}`}
                        aria-label={badgeCount > 0 ? `${t('menu')}, ${badgeCount} ${t('inboxUnread')}` : hasNews ? `${t('menu')}, ${t('menuNews')}` : t('menu')}>
                        <svg className={styles.svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
                        {badgeCount > 0 && <span className={styles.menuBadge} aria-hidden="true">{badgeCount > 9 ? '9+' : badgeCount}</span>}
                        {badgeCount === 0 && hasNews && <span className={styles.menuDot} aria-hidden="true" />}
                    </button>
                    <Link to="/" className={styles.brand} aria-label="Quidey">
                        <Logo className={styles.brandMark} />
                        <span className={styles.brandText}>Quidey</span>
                    </Link>
                    {/* the app's own look on wide screens: the main places as words beside the logo */}
                    {nav === 'bar' && <TopNav inline />}
                    <div className={styles.center}>
                        {activeTimer &&
                            <Link to="/focus" className={styles.timerChip} title={timer.active ? 'running' : 'paused'}>
                                <span className={`${styles.timerDot} ${timer.active ? styles.timerDotLive : ''}`}></span>
                                <span className={styles.timerTime}>{formatTime(timer.time)}</span>
                                {/* a stopwatch has no end to measure against */}
                                {timerMode !== 'stopwatch' && <div className={styles.timerTrack}>
                                    <div className={styles.timerFill} style={{width: `${percentWidth}%`}}></div>
                                </div>}
                            </Link>}
                        <TeamWorkPill />
                        {commandBar &&
                            <button type="button" className={styles.commandBtn} onClick={openCommands}
                                aria-label={`${t('commandOpen')} (${t('commandShortcut')})`} aria-keyshortcuts="Control+K Meta+K">
                                <Icon name="search" size={16} />
                                <span className={styles.commandText}>{t('commandPlaceholder')}</span>
                                <kbd className={styles.commandKbd}>{t('commandShortcut')}</kbd>
                            </button>}
                    </div>
                    <div className={styles.end}>
                        {/* the command bar from everywhere (Übersicht has its field in the middle) */}
                        {!commandBar &&
                            <button type="button" className={styles.btn} onClick={openCommands}
                                aria-label={`${t('commandSearch')} (${t('commandShortcut')})`} title={`${t('commandSearch')} (${t('commandShortcut')})`}
                                aria-keyshortcuts="Control+K Meta+K /">
                                <Icon name="search" size={20} />
                            </button>}
                        <StreakPill />
                        <DailyTicker />
                        <TeamQuickPanel />
                        {/* messages and notifications, from every page (new tasks: Home's add button,
                            N, the command bar) */}
                        <Link to="/inbox" className={`${styles.btn} ${styles.inboxBtn}`}
                            aria-current={pathname.startsWith('/inbox') ? 'page' : undefined}
                            aria-label={inboxCount > 0 ? `${t('inbox')}, ${inboxCount} ${t('inboxUnread')}` : t('inbox')} title={t('inbox')}>
                            <Icon name="inbox" size={20} />
                            {inboxCount > 0 && <span className={styles.menuBadge} aria-hidden="true">{inboxCount > 9 ? '9+' : inboxCount}</span>}
                        </Link>
                    </div>
                </div>
                {nav === 'top' && <TopNav />}
            </>}
        </div>
    );
}