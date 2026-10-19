import styles from '../Together.module.css';
import { useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { formatDate } from '../../features/helperFunction';
import { addSharedTask } from '../../features/together/togetherAction';
import { useTogetherRun } from '../../features/together/hooks';

// My own open tasks, each one click away from the session
export default function ShareMyTasks({ session }) {
    const { t } = useTranslation();
    const run = useTogetherRun();
    const myTasks = useSelector(state => state.task.tasks);

    if (session.endedAt) return null;
    const shared = new Set(session.tasks.map(task => task.sourceTaskId).filter(Boolean));
    const open = myTasks.filter(task => !task.done);

    return (
        <section className={styles.card}>
            <h2 className={styles.cardTitle}>{t('myOwnTasks')}</h2>
            {open.length === 0 ? <p className={styles.emptyLine}>{t('noOwnTasks')}</p> : (
                <ul className={styles.list}>
                    {open.map(task => (
                        <li key={task.id} className={styles.row}>
                            <div className={styles.who}>
                                <span className={styles.name}>{task.name}</span>
                                {task.due && <span className={styles.meta}>{formatDate(task.due)}</span>}
                            </div>
                            {shared.has(task.id)
                                ? <span className={styles.sharedTag}>✓ {t('inSession')}</span>
                                : (
                                    <button className={styles.secondaryBtn} onClick={() => run(addSharedTask(session.id, { taskId: task.id }), 'toast_taskShared')}>
                                        {t('shareTask')}
                                    </button>
                                )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
