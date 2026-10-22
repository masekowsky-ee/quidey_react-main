import styles from './SessionList.module.css';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {useTranslation} from '../../i18n/useTranslation'
import { fetchSharedHistory } from '../../features/together/togetherAction';
import { inPeriod } from '../../features/stats/period';

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

// The team icon used on shared-session labels
function TeamIcon() {
    return <svg xmlns="http://www.w3.org/2000/svg" height="13px" viewBox="0 -960 960 960" width="13px" fill="currentColor" aria-hidden="true"><path d="M40-272q0-34 17.5-62.5T104-378q62-31 126-46.5T360-440q66 0 130 15.5T616-378q29 15 46.5 43.5T680-272v32q0 33-23.5 56.5T600-160H120q-33 0-56.5-23.5T40-240v-32Zm320-208q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Z"/></svg>;
}

// My focus sessions in a period (see features/stats/period.js), newest first: solo sessions
// with the tasks worked on, and my work in shared sessions between them (by when I last worked
// on it). Numbers for the period above the list.
export default function SessionList({ period }){
    const { t } = useTranslation();
    const dispatch = useDispatch();

    // my work in shared sessions; shown between the solo sessions, by when I last worked on it
    const allShared = useSelector(state => state.together.history);
    const sharedHistory = (allShared ?? []).filter(entry => inPeriod(period, entry.lastWorkedAt));
    useEffect(() => {
        dispatch(fetchSharedHistory()).catch(() => {});
    }, [dispatch]);

    const allSessions = useSelector(state => state.session.workedSessionData);
    const workedSessionData = allSessions.filter(ws => inPeriod(period, ws.date));
    const language = useSelector(state => state.settings.language);
    const locale = language === 'de' ? 'de-DE' : 'en-GB';

    const browserTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const totalMinutes = workedSessionData.reduce((sum, ws) => sum + Math.ceil((ws.totalTime ?? 0) / 60), 0);
    const sharedMinutes = Math.round(sharedHistory.reduce((sum, entry) => sum + entry.myMs, 0) / 60000);

    const timeline = [
        ...workedSessionData.map(ws => ({ kind: 'solo', key: `solo-${ws.id}`, date: new Date(ws.date), data: ws })),
        ...sharedHistory.map(entry => ({ kind: 'shared', key: `shared-${entry.id}`, date: new Date(entry.lastWorkedAt), data: entry })),
    ].sort((a, b) => b.date - a.date);

    // each row's length bar is measured against the longest entry in the list
    const entryMinutes = (entry) => entry.kind === 'shared'
        ? Math.max(1, Math.round(entry.data.myMs / 60000))
        : Math.ceil((entry.data.totalTime ?? 0) / 60);
    const longest = Math.max(1, ...timeline.map(entryMinutes));
    const lengthBar = (entry) => (
        <span className={styles.lengthBar} style={{ '--share': entryMinutes(entry) / longest }} aria-hidden="true" />
    );

    const dateText = (date) => date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const timeText = (date) => date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: browserTZ });

    return timeline.length > 0 ?
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
                        <div className={styles.stat}>
                            <span className={styles.statValue}>{formatMinutes(sharedMinutes)}</span>
                            <span className={styles.statLabel}>{t('togetherTime')}</span>
                        </div>
                    </div>

                    <ul className={styles.list}>
                        {timeline.map((entry) => {
                            const { kind, key, date, data } = entry;
                            if (kind === 'shared') {
                                return (
                                    <li key={key} className={styles.session}>
                                        <div className={styles.sessionHead}>
                                            <div>
                                                <span className={styles.sharedLabel}><TeamIcon />{t('sharedSessionLabel')}</span>
                                                <p className={styles.sessionDate}>
                                                    <Link to={`/together/${data.id}`} className={styles.sessionLink}>{data.name}</Link>
                                                </p>
                                                <p className={styles.sessionMeta}>
                                                    {t('lastWorked')} {dateText(date)}, {timeText(date)}
                                                    {data.endedAt && ` · ${t('ended')}`}
                                                </p>
                                            </div>
                                            <span className={styles.duration}>{formatMinutes(Math.max(1, Math.round(data.myMs / 60000)))}</span>
                                        </div>
                                        {lengthBar(entry)}
                                        <ul className={styles.tags}>
                                            {data.tasks.map(task => (
                                                <li key={task.id} className={styles.tag}>
                                                    {task.done && '✓ '}{task.name}
                                                    <span className={styles.tagTime}>{formatTaskTime(Math.round(task.ms / 1000))}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </li>
                                );
                            }
                            const ws = data;
                            return (
                                <li key={key} className={styles.session}>
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
                                    {lengthBar(entry)}
                                    {ws.workedTasks.length > 0 &&
                                        <ul className={styles.tags}>
                                            {[...ws.workedTasks]
                                                .sort((a, b) => (b.time ?? 0) - (a.time ?? 0))
                                                .map((task) => {
                                                    const time = formatTaskTime(task.time);
                                                    return (
                                                        <li key={task.id} className={task.shared ? `${styles.tag} ${styles.sharedTag}` : styles.tag}
                                                            title={task.shared ? `${t('sharedSessionLabel')}: ${task.shared.sessionName}` : undefined}>
                                                            {task.shared && <TeamIcon />}
                                                            {task.name}
                                                            {task.shared && <span className={styles.tagSession}>{task.shared.sessionName}</span>}
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
                <div className={`${styles.card} ${styles.empty}`}>{t(period.from ? 'noSessionsInPeriod' : 'noSessionsYet')}</div>;
}

