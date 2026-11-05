import styles from '../Together.module.css';
import { useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { formatDate } from '../../features/helperFunction';
import { dateKey } from '../../features/calendar/calendar';
import { addSharedTask } from '../../features/together/togetherAction';
import { useTogetherRun } from '../../features/together/hooks';

import Icon from '../icons';
// My own open tasks and coming events, each one click away from the session (a copy goes in;
// a task's done goes both ways)
export default function ShareMyTasks({ session }) {
    const { t } = useTranslation();
    const run = useTogetherRun();
    const myTasks = useSelector(state => state.task.tasks);

    if (session.endedAt) return null;
    const shared = new Set(session.tasks.map(task => task.sourceTaskId).filter(Boolean));
    const todayKey = dateKey(new Date());
    const open = myTasks.filter(task => !task.done && (task.kind !== 'event' || (task.due && dateKey(task.due) >= todayKey)));

    return (
        <section className={styles.card}>
            <h2 className={styles.cardTitle}>{t('myOwnTasks')}</h2>
            {open.length === 0 ? <p className={styles.emptyLine}>{t('noOwnTasks')}</p> : (
                <ul className={styles.scrollList}>
                    {open.map(task => (
                        <li key={task.id} className={styles.row}>
                            <div className={styles.who}>
                                <span className={styles.name}>{task.name}</span>
                                {(task.due || task.kind === 'event') &&
                                    <span className={styles.meta}>
                                        {[task.kind === 'event' && t('kind_event'), task.due && formatDate(task.due)].filter(Boolean).join(' · ')}
                                    </span>}
                            </div>
                            {shared.has(task.id)
                                ? <span className={styles.sharedTag}><Icon name="check" size={13} strokeWidth={2.2} /> {t('inSession')}</span>
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
