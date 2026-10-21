import styles from './TaskLabels.module.css';
import { useSelector } from 'react-redux';
import { useTranslation } from '../i18n/useTranslation';
import { displayName, fill } from '../features/helperFunction';
import { groupColorAttr } from '../features/tasks/taskColors';

// Small labels under a task's name: the groups it is in, or for a task from a shared
// session that session (and who it's assigned to). A click on a label opens that group.
// A group with a colour shows a dot in it.
export default function TaskLabels({ task, onOpenGroup }) {
    const { t } = useTranslation();
    const groups = useSelector(state => state.task.groups);

    if (task.shared) {
        return (
            <span className={styles.labels}>
                <button className={styles.sessionLabel} onClick={() => onOpenGroup?.({ shared: true, sessionId: task.shared.sessionId })}
                    title={t('sharedSessionLabel')}>
                    <svg xmlns="http://www.w3.org/2000/svg" height="13px" viewBox="0 -960 960 960" width="13px" fill="currentColor" aria-hidden="true"><path d="M40-272q0-34 17.5-62.5T104-378q62-31 126-46.5T360-440q66 0 130 15.5T616-378q29 15 46.5 43.5T680-272v32q0 33-23.5 56.5T600-160H120q-33 0-56.5-23.5T40-240v-32Zm320-208q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Z"/></svg>
                    {task.shared.sessionName}
                </button>
                {task.assignee && <span className={styles.assignee}>→ {displayName(task.assignee)}</span>}
            </span>
        );
    }

    const names = (task.group_ids ?? [])
        .map(id => groups.find(group => group.id === id))
        .filter(group => group && group.name !== 'all');
    // a task a friend shared with me, or my task that friends joined
    const joined = (task.sharedWith ?? []).filter(share => share.status === 'accepted');
    const sharedText = task.owner
        ? fill(t('sharedBy'), { name: displayName(task.owner) })
        : joined.length > 0 ? joined.map(share => displayName(share.user)).join(', ') : '';
    if (names.length === 0 && !sharedText) return null;
    return (
        <span className={styles.labels}>
            {sharedText &&
                <span className={styles.friendLabel} title={task.owner ? sharedText : `${t('sharedWithLabel')}: ${sharedText}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" height="13px" viewBox="0 -960 960 960" width="13px" fill="currentColor" aria-hidden="true"><path d="M40-272q0-34 17.5-62.5T104-378q62-31 126-46.5T360-440q66 0 130 15.5T616-378q29 15 46.5 43.5T680-272v32q0 33-23.5 56.5T600-160H120q-33 0-56.5-23.5T40-240v-32Zm320-208q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Z"/></svg>
                    {task.owner ? sharedText : <><span className={styles.srOnly}>{t('sharedWithLabel')}: </span>{sharedText}</>}
                </span>}
            {names.map(group => (
                <button key={group.id} className={styles.label} data-task-color={groupColorAttr(group)} onClick={() => onOpenGroup?.(group)} title={t('openGroup')}>
                    {groupColorAttr(group) && <span className={styles.dot} aria-hidden="true" />}
                    {group.name}
                </button>
            ))}
        </span>
    );
}
