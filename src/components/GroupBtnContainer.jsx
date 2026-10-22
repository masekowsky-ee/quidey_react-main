import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { editDisplaygroup } from '../features/tasks/taskAction';
import { selectSharedGroups } from '../features/together/togetherAction';
import styles from './GroupBtnContainer.module.css';
import { groupColorAttr } from '../features/tasks/taskColors';
import {useTranslation} from '../i18n/useTranslation'
import Icon from './icons';

// Which tasks the list shows: all of them, one of my groups, or a shared session's tasks.
// A row of chips that scrolls sideways when there are many; "+" makes a new group.
// (A group's colour and its deletion sit in the list's title row while it is shown.)
export default function GroupBtnContainer({ setCreateGroup }){
    const {t} = useTranslation();
    const dispatch = useDispatch();

    // a group named "all" from older accounts is the "All" chip itself
    const groups = useSelector(state => state.task.groups).filter(group => group.name !== 'all');
    const groupToDisplay = useSelector(state => state.task.groupToDisplay);
    const shown = groupToDisplay.group;
    const showingAll = !shown?.id || shown.name === 'all';

    // one group per shared session I'm in; not deletable, they go away when I leave or it ends
    const sharedGroups = useSelector(selectSharedGroups);
    const shownSharedGone = shown?.shared && !sharedGroups.some(g => g.id === shown.id);

    // the shown session's group just went away: back to all tasks
    useEffect(() => {
        if (shownSharedGone) dispatch(editDisplaygroup(shown, shown.id));
    }, [shownSharedGone, shown, dispatch]);

    // the shown group again means "all" (see editDisplaygroup)
    const show = (group) => dispatch(editDisplaygroup(group, shown?.id));
    const showAll = () => { if (!showingAll) dispatch(editDisplaygroup(shown, shown.id)); };

    return (
        <div className={styles.bar} role="group" aria-label={t('groups')}>
            <button type="button" className={`${styles.chip} ${showingAll ? styles.active : ''}`}
                aria-pressed={showingAll} onClick={showAll}>
                {t('all')}
            </button>
            {groups.map(group => (
                <button type="button" key={group.id} className={`${styles.chip} ${shown?.id === group.id ? styles.active : ''}`}
                    aria-pressed={shown?.id === group.id} onClick={() => show(group)}
                    data-task-color={groupColorAttr(group)}>
                    {groupColorAttr(group) && <span className={styles.dot} aria-hidden="true" />}
                    {group.name}
                </button>
            ))}
            {sharedGroups.map(group => (
                <button type="button" key={group.id}
                    className={`${styles.chip} ${styles.sharedChip} ${shown?.id === group.id ? styles.active : ''}`}
                    aria-pressed={shown?.id === group.id} onClick={() => show(group)} title={t('sharedGroupTitle')}>
                    <Icon name="together" className={styles.sharedIcon} />
                    {group.name}
                    <span className={styles.sharedCount}>{group.tasks.filter(task => !task.done).length}</span>
                </button>
            ))}
            <button type="button" className={styles.addChip} onClick={() => setCreateGroup(true)}
                title={t('createGroupH2')} aria-label={t('createGroupH2')}>
                <Icon name="plus" className={styles.addIcon} strokeWidth={2} />
            </button>
        </div>
    )
}
