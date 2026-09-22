import { useSelector, useDispatch } from 'react-redux';
import { deleteGroup, editDisplaygroup } from '../features/tasks/taskAction';
import styles from './GroupBtnContainer.module.css';

export default function GroupBtnContainer(props){
    const { t, setCreateGroup } = props;

    const dispatch = useDispatch();

    const groups = useSelector(state => state.task.groups)

    const groupToDisplay = useSelector(state => state.task.groupToDisplay);

    const handleRemoveGroup = (groupId) => {
        dispatch(deleteGroup(groupId));
    }

    const handleDisplayGroups = (group) => {
        dispatch(editDisplaygroup(group, groupToDisplay.group.id));
    }

    return (
        <div className={styles.groupBtnDiv}>
            <div className={styles.inner}>
                <button onClick={()=>{setCreateGroup(true)}}>
                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M440-440v120q0 17 11.5 28.5T480-280q17 0 28.5-11.5T520-320v-120h120q17 0 28.5-11.5T680-480q0-17-11.5-28.5T640-520H520v-120q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640v120H320q-17 0-28.5 11.5T280-480q0 17 11.5 28.5T320-440h120Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/></svg>
                </button>
                {groups.map(group => (
                    <div className={styles.groupBtnDivInner} key={group.name + 'Div'}>
                        <button className={`${styles.groupBtn} ${groupToDisplay.group?.id === group.id ? styles.activeGroup : ''}`} key={group.name + 'DisplayBtn'} onClick={() => handleDisplayGroups(group)}>
                            {group.name === 'all' ? t('all') : group.name}
                        </button>
                        {group.name !== 'all' && <svg onClick={()=>handleRemoveGroup(group.id)} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520q-17 0-28.5-11.5T160-760q0-17 11.5-28.5T200-800h160q0-17 11.5-28.5T400-840h160q17 0 28.5 11.5T600-800h160q17 0 28.5 11.5T800-760q0 17-11.5 28.5T760-720v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM428.5-291.5Q440-303 440-320v-280q0-17-11.5-28.5T400-640q-17 0-28.5 11.5T360-600v280q0 17 11.5 28.5T400-280q17 0 28.5-11.5Zm160 0Q600-303 600-320v-280q0-17-11.5-28.5T560-640q-17 0-28.5 11.5T520-600v280q0 17 11.5 28.5T560-280q17 0 28.5-11.5ZM280-720v520-520Z"/></svg>}
                    </div>
                ))}
            </div>
        </div>
    )
}