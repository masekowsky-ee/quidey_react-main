import styles from './History.module.css';
import { useSelector } from 'react-redux';
import {useTranslation} from '../i18n/useTranslation'

// 95 -> "1 h 35 min", 40 -> "40 min"
function formatMinutes(totalMinutes) {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

// Time on one task: "<1 min" for a few seconds, nothing for sessions saved before
// per-task times existed (they come back as 0)
function formatTaskTime(seconds) {
    if (!seconds) return null;
    if (seconds < 60) return '<1 min';
    return formatMinutes(Math.round(seconds / 60));
}

export default function History(){
    const { t } = useTranslation();

    const workedSessionData = useSelector(state => state.session.workedSessionData);
    const language = useSelector(state => state.settings.language);
    const locale = language === 'de' ? 'de-DE' : 'en-GB';

    const browserTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const totalMinutes = workedSessionData.reduce((sum, ws) => sum + Math.ceil((ws.totalTime ?? 0) / 60), 0);

    return (
        <div className={styles.page}>
            <h1 className={styles.title}>{t('history')}</h1>
            {workedSessionData.length > 0 ?
                <>
                    <div className={styles.stats}>
                        <div className={styles.stat}>
                            <span className={styles.statValue}>{workedSessionData.length}</span>
                            <span className={styles.statLabel}>{t('sessions')}</span>
                        </div>
                        <div className={styles.stat}>
                            <span className={styles.statValue}>{formatMinutes(totalMinutes)}</span>
                            <span className={styles.statLabel}>{t('focusTime')}</span>
                        </div>
                    </div>

                    <ul className={styles.list}>
                        {workedSessionData.map((ws) => {
                            const date = new Date(ws.date);
                            return (
                                <li key={ws.id} className={styles.session}>
                                    <div className={styles.sessionHead}>
                                        <div>
                                            <p className={styles.sessionDate}>
                                                {date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                                            </p>
                                            <p className={styles.sessionMeta}>
                                                {date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: browserTZ })}
                                                {ws.group && ws.group !== 'all' && ` · ${ws.group}`}
                                            </p>
                                        </div>
                                        <span className={styles.duration}>{`${Math.ceil(ws.totalTime / 60)} min`}</span>
                                    </div>
                                    {ws.workedTasks.length > 0 &&
                                        <ul className={styles.tags}>
                                            {[...ws.workedTasks]
                                                .sort((a, b) => (b.time ?? 0) - (a.time ?? 0))
                                                .map((task) => {
                                                    const time = formatTaskTime(task.time);
                                                    return (
                                                        <li key={task.id} className={styles.tag}>
                                                            {task.name}
                                                            {time && <span className={styles.tagTime}>{time}</span>}
                                                        </li>
                                                    );
                                                })}
                                        </ul>
                                    }
                                </li>
                            )
                        })}
                    </ul>
                </>
                :
                <div className={`${styles.card} ${styles.empty}`}>{t('noSessionsYet')}</div>
            }
        </div>
    );
}
