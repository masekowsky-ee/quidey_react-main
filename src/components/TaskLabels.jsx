import styles from './TaskLabels.module.css';
import { useContext } from 'react';
import Icon from './icons';
import { useTranslation } from '../i18n/useTranslation';
import { displayName, fill } from '../features/helperFunction';
import { groupColorAttr } from '../features/tasks/taskColors';
import { useTaskGroups } from '../features/collections/collections';
import { OpenGroupContext } from '../features/collections/openGroup';

// Small labels under a task's name: the groups it is in, or for a task from a shared
// session that session (and who it's assigned to). A click on a label opens that group.
// A group with a colour shows a dot in it. For testers the collections it is in take the
// place of groups (with their emoji).
export default function TaskLabels({ task, onOpenGroup: openFromProp }) {
    const { t } = useTranslation();
    const openFromPage = useContext(OpenGroupContext);
    const onOpenGroup = openFromProp ?? openFromPage;
    const { groupsOf } = useTaskGroups();

    if (task.shared) {
        return (
            <span className={styles.labels}>
                <button className={styles.sessionLabel} onClick={() => onOpenGroup?.({ shared: true, sessionId: task.shared.sessionId })}
                    title={t('sharedSessionLabel')}>
                    <Icon name="mTeam" size={13} />
                    {task.shared.sessionName}
                </button>
                {task.assignee && <span className={styles.assignee}>→ {displayName(task.assignee)}</span>}
            </span>
        );
    }

    const names = groupsOf(task);
    const joined = (task.sharedWith ?? []).filter(share => share.status === 'accepted');
    const sharedText = task.owner
        ? fill(t('sharedBy'), { name: displayName(task.owner) })
        : joined.length > 0 ? joined.map(share => displayName(share.user)).join(', ') : '';
    if (names.length === 0 && !sharedText) return null;
    return (
        <span className={styles.labels}>
            {sharedText &&
                <span className={styles.friendLabel} title={task.owner ? sharedText : `${t('sharedWithLabel')}: ${sharedText}`}>
                    <Icon name="mTeam" size={13} />
                    {task.owner ? sharedText : <><span className={styles.srOnly}>{t('sharedWithLabel')}: </span>{sharedText}</>}
                </span>}
            {names.map(group => (
                <button key={group.id} className={styles.label} data-task-color={groupColorAttr(group)} onClick={() => onOpenGroup?.(group)}
                    title={t('collectionShow')}>
                    {group.emoji
                        ? <span aria-hidden="true">{group.emoji}</span>
                        : groupColorAttr(group) && <span className={styles.dot} aria-hidden="true" />}
                    {group.name}
                </button>
            ))}
        </span>
    );
}
