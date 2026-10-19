import styles from '../Header.module.css';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { formatClock } from '../../features/helperFunction';
import { selectWork, stopWork, workTotalMs, useNow } from '../../features/together/work';

// In the header while I work on a shared task: clock, task, pause. Works from every page.
export default function TeamWorkPill() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const work = useSelector(selectWork);
    const homeLayout = useSelector(state => state.settings.homeLayout);
    const now = useNow(Boolean(work.taskId));
    if (!work.taskId) return null;

    // in the team layout, the session is right on the home page
    const target = homeLayout === 'team' ? '/' : `/together/${work.sessionId}`;

    return (
        <div className={styles.teamPill}>
            <Link to={target} className={styles.teamPillLink} title={`${work.taskName} · ${work.sessionName}`}>
                <span className={`${styles.timerDot} ${styles.timerDotLive}`} />
                <span className={styles.timerTime}>{formatClock(workTotalMs(work, now))}</span>
                <span className={styles.teamPillTask}>{work.taskName}</span>
            </Link>
            <button className={styles.teamPillPause} onClick={() => dispatch(stopWork())} aria-label={t('pause')} title={t('pause')}>
                <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="currentColor"><path d="M600-200q-33 0-56.5-23.5T520-280v-400q0-33 23.5-56.5T600-760h80q33 0 56.5 23.5T760-680v400q0 33-23.5 56.5T680-200h-80Zm-320 0q-33 0-56.5-23.5T200-280v-400q0-33 23.5-56.5T280-760h80q33 0 56.5 23.5T440-680v400q0 33-23.5 56.5T360-200h-80Z"/></svg>
            </button>
        </div>
    );
}
