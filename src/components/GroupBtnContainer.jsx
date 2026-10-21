import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { deleteGroup, editDisplaygroup } from '../features/tasks/taskAction';
import { selectSharedGroups } from '../features/together/togetherAction';
import styles from './GroupBtnContainer.module.css';
import { groupColorAttr } from '../features/tasks/taskColors';
import {useTranslation} from '../i18n/useTranslation'

export default function GroupBtnContainer(props){
    const { setCreateGroup } = props;
    const {t} = useTranslation();

    const dispatch = useDispatch();

    const groups = useSelector(state => state.task.groups)

    const groupToDisplay = useSelector(state => state.task.groupToDisplay);

    // one group per shared session I'm in; not deletable, they go away when I leave or it ends
    const sharedGroups = useSelector(selectSharedGroups);
    const shownSharedGone = groupToDisplay.group?.shared && !sharedGroups.some(g => g.id === groupToDisplay.group.id);

    // the shown session's group just went away: back to all tasks
    useEffect(() => {
        if (shownSharedGone) dispatch(editDisplaygroup(groupToDisplay.group, groupToDisplay.group.id));
    }, [shownSharedGone, groupToDisplay.group, dispatch]);

    const handleRemoveGroup = (groupId) => {
        dispatch(deleteGroup(groupId));
    }

    const handleDisplayGroups = (group) => {
        dispatch(editDisplaygroup(group, groupToDisplay.group.id));
    }

    return (
        <div className={styles.groupBtnDiv}>
            <div className={styles.inner}>
                <button className={styles.addGroupBtn} onClick={()=>{setCreateGroup(true)}} title={t('createGroupH2')} aria-label={t('createGroupH2')}>
                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M440-440H240q-17 0-28.5-11.5T200-480q0-17 11.5-28.5T240-520h200v-200q0-17 11.5-28.5T480-760q17 0 28.5 11.5T520-720v200h200q17 0 28.5 11.5T760-480q0 17-11.5 28.5T720-440H520v200q0 17-11.5 28.5T480-200q-17 0-28.5-11.5T440-240v-200Z"/></svg>
                </button>
                {groups.map(group => (
                    <div className={styles.groupBtnDivInner} key={group.name + 'Div'}>
                        <button className={`${styles.groupBtn} ${groupToDisplay.group?.id === group.id ? styles.activeGroup : ''}`} key={group.name + 'DisplayBtn'} onClick={() => handleDisplayGroups(group)}
                            data-task-color={group.name === 'all' ? undefined : groupColorAttr(group)}>
                            {group.name !== 'all' && groupColorAttr(group) && <svg className={styles.flag} xmlns="http://www.w3.org/2000/svg" height="12px" viewBox="0 -960 960 960" width="12px" fill="currentColor" aria-hidden="true"><path d="M200-120v-680h360l16 80h224v400H520l-16-80H280v280h-80Z"/></svg>}
                            {group.name === 'all' ? t('all') : group.name}
                        </button>
                        {group.name !== 'all' && <svg className={styles.deleteIcon} onClick={()=>handleRemoveGroup(group.id)} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520q-17 0-28.5-11.5T160-760q0-17 11.5-28.5T200-800h160q0-17 11.5-28.5T400-840h160q17 0 28.5 11.5T600-800h160q17 0 28.5 11.5T800-760q0 17-11.5 28.5T760-720v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM428.5-291.5Q440-303 440-320v-280q0-17-11.5-28.5T400-640q-17 0-28.5 11.5T360-600v280q0 17 11.5 28.5T400-280q17 0 28.5-11.5Zm160 0Q600-303 600-320v-280q0-17-11.5-28.5T560-640q-17 0-28.5 11.5T520-600v280q0 17 11.5 28.5T560-280q17 0 28.5-11.5ZM280-720v520-520Z"/></svg>}
                    </div>
                ))}
                {sharedGroups.map(group => (
                    <div className={styles.groupBtnDivInner} key={group.id}>
                        <button
                            className={`${styles.groupBtn} ${styles.sharedGroupBtn} ${groupToDisplay.group?.id === group.id ? styles.activeGroup : ''}`}
                            onClick={() => handleDisplayGroups(group)}
                            title={t('sharedGroupTitle')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor" aria-hidden="true"><path d="M40-272q0-34 17.5-62.5T104-378q62-31 126-46.5T360-440q66 0 130 15.5T616-378q29 15 46.5 43.5T680-272v32q0 33-23.5 56.5T600-160H120q-33 0-56.5-23.5T40-240v-32Zm698 112q11-18 16.5-38.5T760-240v-40q0-44-24.5-84.5T666-434q51 6 96 20.5t84 35.5q36 20 55 44.5t19 53.5v40q0 33-23.5 56.5T840-160H738ZM360-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm400-160q0 66-47 113t-113 47q-11 0-28-2.5t-28-5.5q27-32 41.5-71t14.5-81q0-42-14.5-81T544-792q14-5 28-6.5t28-1.5q66 0 113 47t47 113Z"/></svg>
                            {group.name}
                            <span className={styles.sharedCount}>{group.tasks.filter(task => !task.done).length}</span>
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}