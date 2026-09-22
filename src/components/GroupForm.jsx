import styles from './Form.module.css';
import { useDispatch, useSelector } from 'react-redux';
import { addGroup } from '../features/tasks/taskAction';

export default function GroupForm(props){
    const {t, setCustomError, showForms, setCreateGroup} = props;

    const dispatch = useDispatch();

    const groups = useSelector(state => state.task.groups);

    const handleSubmit = (e) => {
        e.preventDefault();
        const name = e.target[0].value;
        const description = e.target[1].value;
        if(name && name !== 'all' && !groups.some(g => g.name === name)){
            dispatch(addGroup(name, description));
            e.target[0].value = '';
            e.target[1].value = '';
            setCreateGroup(false);
        } else{
            setCustomError({bool: true, message: t('groupError')})
        }
    }

    return (
        <div className={`${styles.div}`}>
            <button className={styles.closeBtn} onClick={()=>{setCreateGroup(false)}}>
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>
            </button>            <h2 className={styles.h2}>{t('createGroupH2')}</h2>
            <form className={`${styles.form}`} onSubmit={(e)=>{handleSubmit(e)}}>
                <input type="text" className={styles.input} placeholder={t('groupName')} />
                <input type="text" className={styles.input} placeholder={t('description')} />
                <button type="submit" className={styles.createBtn}>{t('createBtn')}</button>
            </form>
        </div>
    )
}