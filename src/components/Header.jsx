import styles from './Header.module.css';
import {Link} from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { setShowMenu, showForms } from '../features/settings/settingsAction'
import Icon from './icons'
import { selectTimerProgress } from '../features/session/sessionAction'
import TeamWorkPill from './together/TeamWorkPill'
import TeamQuickPanel from './together/TeamQuickPanel'
import DailyTicker from './DailyTicker'
import Logo from './Logo'
import { selectMenuBadgeCount } from '../features/inbox/inbox'
import { selectHasNews } from '../features/realtime/news'
import { useTranslation } from '../i18n/useTranslation'

function formatTime(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const mmss = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return h > 0 ? `${h}:${mmss}` : mmss;
}

export default function Header(props){
    const {activeTimer} = props;
    const percentWidth = useSelector(selectTimerProgress);
    const dispatch = useDispatch();
    const showMenu = () => {
        dispatch(setShowMenu(true));
    }
    const token = useSelector((state) => state.auth.token);
    const badgeCount = useSelector(selectMenuBadgeCount);
    const hasNews = useSelector(selectHasNews);
    const { t } = useTranslation();
    const timer = useSelector((state) => state.session.timer);
    const timerMode = useSelector((state) => state.session.timerMode);
    return (
        <div className={styles.header}>
            {token && <>
                <div className={styles.div}>
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
                    <div className={styles.center}>
                        {activeTimer &&
                            <div className={styles.timerChip} title={timer.active ? 'running' : 'paused'}>
                                <span className={`${styles.timerDot} ${timer.active ? styles.timerDotLive : ''}`}></span>
                                <span className={styles.timerTime}>{formatTime(timer.time)}</span>
                                {/* a stopwatch has no end to measure against */}
                                {timerMode !== 'stopwatch' && <div className={styles.timerTrack}>
                                    <div className={styles.timerFill} style={{width: `${percentWidth}%`}}></div>
                                </div>}
                            </div>}
                        <TeamWorkPill />
                    </div>
                    <div className={styles.end}>
                        <DailyTicker />
                        <TeamQuickPanel />
                        {/* the most frequent job, from every page: a new task or event */}
                        <button type="button" className={styles.newBtn} onClick={() => dispatch(showForms(true))}
                            aria-label={t('newEntry')} title={t('newEntry')}>
                            <Icon name="plus" size={18} strokeWidth={2} />
                            <span className={styles.newLabel}>{t('newEntryShort')}</span>
                        </button>
                    </div>
                </div>
            </>}
        </div>
    );
}