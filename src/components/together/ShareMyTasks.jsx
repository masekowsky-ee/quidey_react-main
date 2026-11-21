import styles from '../Together.module.css';
import { useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { dateKey } from '../../features/calendar/calendar';
import { addSharedTask } from '../../features/together/togetherAction';
import { useTogetherRun } from '../../features/together/hooks';
import Icon from '../icons';
import OpenTaskList from './OpenTaskList';
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
        <OpenTaskList title={t('myOwnTasks')} emptyText={t('noOwnTasks')} tasks={open}
            showMeta={(task) => Boolean(task.due || task.kind === 'event')}
            renderAction={(task) => shared.has(task.id)
                ? <span className={styles.sharedTag}><Icon name="check" size={13} strokeWidth={2.2} /> {t('inSession')}</span>
                : (
                    <button className={styles.secondaryBtn} onClick={() => run(addSharedTask(session.id, { taskId: task.id }), 'toast_taskShared')}>
                        {t('shareTask')}
                    </button>
                )} />
    );
}
