import styles from '../Header.module.css';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { formatClock } from '../../features/helperFunction';
import { selectWork, workTotalMs, useNow } from '../../features/together/work';
import Icon from '../icons';
import { pauseFocus } from '../../features/session/sessionAction';

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
            <button className={styles.teamPillPause} onClick={() => dispatch(pauseFocus())} aria-label={t('pause')} title={t('pause')}>
                <Icon name="pause" size={18} />
            </button>
        </div>
    );
}
