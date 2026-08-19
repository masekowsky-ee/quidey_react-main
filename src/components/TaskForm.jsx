import { useDispatch, useSelector } from 'react-redux';
import { addTask } from '../features/tasks/taskAction'
import styles from './TaskForm.module.css';

export default function TaskForm(props){
    const {t, setCustomError, showForms} = props;

    const dispatch = useDispatch();

    const groupToDisplay = useSelector((state)=>state.task.groupToDisplay)

    function handleSubmit(e){
        e.preventDefault();
        const name = e.target[0].value;
        const due = e.target[1].value;
        const description = e.target[2].value;
        const prio = e.target[3].value;
        const activeGroupId = groupToDisplay.group.id || null;
        if(name && due){

            dispatch(addTask(name, due, description, prio, activeGroupId));

            console.log('submitted task');
            e.target[0].value = '';
            e.target[1].value = '';
            e.target[2].value = '';
            e.target[3].value = '';
        } else {
            setCustomError({bool: true, message: t('dateNameTaskError')})
        }
        console.log(groupToDisplay)
    }

    return (
        <div className={`${styles.div} ${showForms ? '' : styles.height}`}>
            <h2 className={styles.h2}>{t('createTaskH2')}</h2>
            <form className={`${styles.form} ${showForms ? '' : styles.hidden}`}onSubmit={handleSubmit}>
                <input className={styles.input} type="text" placeholder={t('taskName')} />
                <input className={styles.input} type="date" />
                <input className={styles.input} type="text" placeholder={t('description')} />
                <label htmlFor="prioritise">{t('prioritise')}</label>
                <div className={styles.prioDiv}>
                    <p>{t('low')}</p>
                    <input type="range" id="prioritise" min="0" max="100" step="1" />
                    <p>{t('high')}</p>
                </div>
                <button type="submit" className={styles.createBtn}>{t('createBtn')}</button>
            </form>
        </div>
    )
}