import styles from '../Together.module.css';
import { useTranslation } from '../../i18n/useTranslation';
import { formatDate } from '../../features/helperFunction';

// "event · date" under a task's name
function useTaskMeta() {
    const { t } = useTranslation();
    return (task) => [task.kind === 'event' && t('kind_event'), task.due && formatDate(task.due)].filter(Boolean).join(' · ');
}

// A card with a list of my own open tasks, each with one action beside it. Which tasks, and what
// the action is, stay with the caller.
//   tasks       the tasks to list; renderAction(task) the button (or tag) at the end of the row
//   showMeta    (task) => whether the meta line is there (default: always)
//   children    after the list (a dialog)
export default function OpenTaskList({ title, emptyText, tasks, renderAction, showMeta = () => true, children }) {
    const meta = useTaskMeta();
    return (
        <section className={styles.card}>
            <h2 className={styles.cardTitle}>{title}</h2>
            {tasks.length === 0 ? <p className={styles.emptyLine}>{emptyText}</p> : (
                <ul className={styles.scrollList}>
                    {tasks.map(task => (
                        <li key={task.id} className={styles.row}>
                            <div className={styles.who}>
                                <span className={styles.name}>{task.name}</span>
                                {showMeta(task) && <span className={styles.meta}>{meta(task)}</span>}
                            </div>
                            {renderAction(task)}
                        </li>
                    ))}
                </ul>
            )}
            {children}
        </section>
    );
}
