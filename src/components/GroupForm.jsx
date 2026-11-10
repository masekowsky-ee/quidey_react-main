import styles from './Form.module.css';
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import TaskColorPicker from './task/TaskColorPicker.jsx';
import { addGroup } from '../features/tasks/taskAction';
import {useTranslation} from '../i18n/useTranslation';
import {setCustomError} from '../features/settings/settingsAction';
import SheetGrabber from './SheetGrabber.jsx';
import { createCollection, COLLECTION_NAME_MAX } from '../features/collections/collections';
import { noteAction } from '../features/onboarding/onboarding';
import { showToast } from '../features/toast/toast';

// A new group; for testers a new collection (collections take the place of groups for them)
export default function GroupForm(props){
    // sheet: the FormSheet it sits in (slides in, swiped down on phones)
    const {setCreateGroup, sheet} = props;

    const dispatch = useDispatch();

    const { t } = useTranslation();

    const groups = useSelector(state => state.task.groups);
    const asCollection = true;
    // the group's colour: its tasks get a dot in it
    const [color, setColor] = useState(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        const name = e.target[0].value;
        const description = e.target[1].value;
        if (asCollection) {
            if (!name.trim()) {
                dispatch(setCustomError({bool: true, message: t('collectionNameMissing')}));
                return;
            }
            dispatch(createCollection({ name: name.trim(), description: description.trim(), color }))
                .then(() => { noteAction('group'); setCreateGroup(false); })
                .catch(err => dispatch(showToast(t(err.code === 'COLLECTION_LIMIT' ? 'collectionLimit' : 'collectionError'), 'error')));
            return;
        }
        if(name && name !== 'all' && !groups.some(g => g.name === name)){
            dispatch(addGroup(name, description, color));
            e.target[0].value = '';
            e.target[1].value = '';
            setCreateGroup(false);
        } else{
            dispatch(setCustomError({bool: true, message: t('groupError')}))
        }
    }

    return (
        <div className={`${styles.div}`} role="dialog" aria-modal="true" aria-labelledby="createGroupTitle" {...sheet?.panel}>
            {sheet && <SheetGrabber />}
            <button className={styles.closeBtn} onClick={()=>{setCreateGroup(false)}} aria-label={t('close')}>
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>
            </button>
            <h2 id="createGroupTitle" data-sheet-drag>{t(asCollection ? 'collectionNew' : 'createGroupH2')}</h2>
            <form className={`${styles.form}`} onSubmit={(e)=>{handleSubmit(e)}}>
                <input type="text" className={styles.input} placeholder={t(asCollection ? 'collectionName' : 'groupName')}
                    maxLength={asCollection ? COLLECTION_NAME_MAX : undefined} />
                <input type="text" className={styles.input} placeholder={t('description')} />
                <TaskColorPicker value={color} onChange={setColor} />
                <button type="submit" className={styles.createBtn}>{t('createBtn')}</button>
            </form>
        </div>
    )
}