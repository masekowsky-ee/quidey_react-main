import styles from './Form.module.css';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import TaskColorPicker from './task/TaskColorPicker.jsx';
import {useTranslation} from '../i18n/useTranslation';
import Icon from './icons.jsx';
import {setCustomError} from '../features/settings/settingsAction';
import SheetGrabber from './SheetGrabber.jsx';
import { createCollection, COLLECTION_NAME_MAX } from '../features/collections/collections';
import { noteAction } from '../features/onboarding/onboarding';
import { showToast } from '../features/toast/toast';

// A new collection (collections took the place of groups)
export default function GroupForm(props){
    const {setCreateGroup, sheet} = props;

    const dispatch = useDispatch();

    const { t } = useTranslation();

    const [color, setColor] = useState(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        const name = e.target[0].value;
        const description = e.target[1].value;
        if (!name.trim()) {
            dispatch(setCustomError({bool: true, message: t('collectionNameMissing')}));
            return;
        }
        dispatch(createCollection({ name: name.trim(), description: description.trim(), color }))
            .then(() => { noteAction('group'); setCreateGroup(false); })
            .catch(err => dispatch(showToast(t(err.code === 'COLLECTION_LIMIT' ? 'collectionLimit' : 'collectionError'), 'error')));
    }

    return (
        <div className={`${styles.div}`} role="dialog" aria-modal="true" aria-labelledby="createGroupTitle" {...sheet?.panel}>
            {sheet && <SheetGrabber />}
            <button className={styles.closeBtn} onClick={()=>{setCreateGroup(false)}} aria-label={t('close')}>
                <Icon name="mCross" size={24} />
            </button>
            <h2 id="createGroupTitle" data-sheet-drag>{t('collectionNew')}</h2>
            <form className={`${styles.form}`} onSubmit={(e)=>{handleSubmit(e)}}>
                <input type="text" className={styles.input} placeholder={t('collectionName')}
                    maxLength={COLLECTION_NAME_MAX} />
                <input type="text" className={styles.input} placeholder={t('description')} />
                <TaskColorPicker value={color} onChange={setColor} />
                <button type="submit" className={styles.createBtn}>{t('createBtn')}</button>
            </form>
        </div>
    )
}