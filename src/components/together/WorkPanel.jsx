import styles from '../Together.module.css';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { formatClock, displayName } from '../../features/helperFunction';
import { timeOf, setSharedTaskDone } from '../../features/together/togetherAction';
import { selectWork, startWork, stopWork, localMs, useNow } from '../../features/together/work';
import { useTogetherRun } from '../../features/together/hooks';

// "My work" in a session: the task I'm on with my clock, or what I could start with
// (tasks assigned to me first)
export default function WorkPanel({ session, large = false }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const run = useTogetherRun();
    const work = useSelector(selectWork);
    const now = useNow(Boolean(work.taskId));

    if (session.endedAt) return null;

    const here = work.sessionId === session.id;
    const current = here ? session.tasks.find(task => task.id === work.taskId) : null;
    const elsewhere = work.taskId && !here;

    const finish = async () => {
        await dispatch(stopWork());
        run(setSharedTaskDone(session.id, current.id, true), 'toast_taskDone');
    };

    const open = session.tasks.filter(task => !task.done);
    const suggestions = [
        ...open.filter(task => task.assignee?.id === session.me),
        ...open.filter(task => !task.assignee),
    ].slice(0, 3);

    return (
        <section className={`${styles.card} ${current ? styles.workingCard : ''} ${large ? styles.workLarge : ''}`} aria-live="polite">
            <h2 className={styles.cardTitle}>{t('myWork')}</h2>
            {current ? (
                <div className={styles.workRow}>
                    <div className={styles.who}>
                        <span className={styles.workTask}>{current.name}</span>
                        <span className={styles.meta}>
                            <span className={styles.liveDot} /> {t('workingOnIt')}
                            {current.assignee && ` · ${t('assignedTo')} ${displayName(current.assignee)}`}
                        </span>
                        {current.description && <span className={styles.desc}>{current.description}</span>}
                    </div>
                    <span className={styles.clock}>{formatClock(timeOf(current, session.me) + localMs(work, current.id, now))}</span>
                    <div className={styles.workButtons}>
                        <button className={styles.secondaryBtn} onClick={() => dispatch(stopWork())}>{t('pause')}</button>
                        <button className={styles.acceptBtn} onClick={finish}>{t('markDone')}</button>
                    </div>
                </div>
            ) : elsewhere ? (
                <p className={styles.emptyLine}>
                    {t('workingElsewhere')} <Link to={`/together/${work.sessionId}`}>{work.sessionName}</Link>
                </p>
            ) : (
                <>
                    <p className={styles.emptyLine}>{t(open.length ? 'pickTaskHint' : 'noOpenSharedTasks')}</p>
                    {suggestions.length > 0 && (
                        <ul className={styles.suggestions}>
                            {suggestions.map(task => (
                                <li key={task.id}>
                                    <button className={styles.suggestion} onClick={() => dispatch(startWork(session, task))}>
                                        <span className={styles.playIcon} aria-hidden="true">▶</span>
                                        <span className={styles.suggestionName}>{task.name}</span>
                                        {task.assignee?.id === session.me && <span className={styles.assignedChip}>{t('forYou')}</span>}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </section>
    );
}
