import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { useCollections, collectionsOf, hasItem, addToCollection, removeFromCollection, createCollection, COLLECTION_NAME_MAX } from '../../features/collections/collections';
import { groupColorAttr } from '../../features/tasks/taskColors';
import { showToast } from '../../features/toast/toast';
import { fill } from '../../features/helperFunction';
import { useTranslation } from '../../i18n/useTranslation';
import Icon from '../icons.jsx';
import styles from './Collections.module.css';

const NEW = '__new';

// "In Sammlungen": the collections a task, event or note is in (each a link there, × takes it
// out), and a way to put it into another one or into a new one named after it (testers). Sits
// inside other forms (the task editor), so it has no <form> of its own: Enter makes the new one.
// item: { kind: 'task' | 'note', id }; name: what a new collection is called at first.
export default function CollectionPicker({ item, name = '' }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const collections = useCollections();
    const [naming, setNaming] = useState(null);
    const [busy, setBusy] = useState(false);
    const nameField = useRef(null);
    const isNaming = naming !== null;
    useEffect(() => { if (isNaming) nameField.current?.focus(); }, [isNaming]);

    const mine = collectionsOf(collections, item);
    const others = collections.filter(collection => !hasItem(collection, item));
    const failed = () => dispatch(showToast(t('collectionError'), 'error'));

    const pick = async (value) => {
        if (!value) return;
        if (value === NEW) { setNaming(name.slice(0, COLLECTION_NAME_MAX)); return; }
        const collection = collections.find(entry => String(entry.id) === value);
        try {
            await dispatch(addToCollection(collection.id, item));
            dispatch(showToast(fill(t('collectionAdded'), { name: collection.name }), 'success'));
        } catch { failed(); }
    };

    const create = async () => {
        const title = naming?.trim();
        if (!title || busy) return;
        setBusy(true);
        try {
            const made = await dispatch(createCollection({ name: title, items: [item] }));
            setNaming(null);
            dispatch(showToast(fill(t('collectionCreated'), { name: made.name }), 'success'));
        } catch { failed(); } finally { setBusy(false); }
    };

    const onKeyDown = (e) => {
        // the editor around it saves on Enter and closes on Escape: not here
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); create(); }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setNaming(null); }
    };

    return (
        <div className={styles.picker}>
            <span className={styles.pickerLabel}><Icon name="collection" size={15} /> {t('collectionsIn')}</span>
            {mine.length > 0 &&
                <ul className={styles.chips}>
                    {mine.map(collection =>
                        <li key={collection.id} className={styles.chip} data-task-color={groupColorAttr(collection)}>
                            <Link to={`/collections/${collection.id}`}>
                                <span aria-hidden="true">{collection.emoji || '🗂️'}</span> {collection.name}
                            </Link>
                            <button type="button" aria-label={fill(t('collectionTakeOut'), { name: collection.name })}
                                title={fill(t('collectionTakeOut'), { name: collection.name })}
                                onClick={() => dispatch(removeFromCollection(collection.id, item)).catch(failed)}>
                                <Icon name="close" size={12} />
                            </button>
                        </li>)}
                </ul>}
            {naming === null
                ? <select className={styles.pickerSelect} value="" onChange={e => pick(e.target.value)} aria-label={t('collectionAddTo')}>
                    <option value="">{mine.length ? t('collectionAddMore') : t('collectionAddTo')}</option>
                    {others.map(collection => <option key={collection.id} value={String(collection.id)}>{collection.emoji || '🗂️'} {collection.name}</option>)}
                    <option value={NEW}>{t('collectionNewFrom')}</option>
                </select>
                : <span className={styles.newRow}>
                    <input ref={nameField} value={naming} maxLength={COLLECTION_NAME_MAX} onChange={e => setNaming(e.target.value)}
                        onKeyDown={onKeyDown} aria-label={t('collectionName')} placeholder={t('collectionName')} />
                    <button type="button" className={styles.smallPrimary} onClick={create} disabled={!naming.trim() || busy}>{t('collectionCreate')}</button>
                    <button type="button" className={styles.textBtn} onClick={() => setNaming(null)}>{t('cancel')}</button>
                </span>}
        </div>
    );
}
