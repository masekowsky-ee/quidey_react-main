import styles from './GroupPicker.module.css';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../i18n/useTranslation';
import { addGroup, addGroupTasks, deleteGroupTasks } from '../features/tasks/taskAction';
import { setCustomError } from '../features/settings/settingsAction';

// Dialog to put a task into groups or take it out: every group is a toggle with a tick.
// Closes with Escape, the close button, or a click next to it. A new group can be made
// right here and the task goes straight into it.
export default function GroupPicker({ task, onClose }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const groups = useSelector(state => state.task.groups).filter(group => group.name !== 'all');
    // read live, so the ticks follow each change
    const groupIds = useSelector(state => state.task.tasks.find(x => x.id === task.id)?.group_ids ?? []);
    const [busyId, setBusyId] = useState(null);
    const [newName, setNewName] = useState('');
    const dialogRef = useRef(null);

    // Escape closes; focus starts inside the dialog and comes back to where it was
    useEffect(() => {
        const previous = document.activeElement;
        dialogRef.current?.querySelector('button, input')?.focus();
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            previous?.focus?.();
        };
    }, [onClose]);

    const run = async (id, action) => {
        setBusyId(id);
        try {
            await dispatch(action);
        } catch (err) {
            dispatch(setCustomError({ bool: true, message: err.message || t('friendError_generic') }));
        } finally {
            setBusyId(null);
        }
    };

    const toggle = (group) => run(group.id, groupIds.includes(group.id)
        ? deleteGroupTasks(task.id, group.id)
        : addGroupTasks(group.id, task.id));

    const createAndAdd = async (e) => {
        e.preventDefault();
        const name = newName.trim();
        if (!name) return;
        if (groups.some(group => group.name.toLowerCase() === name.toLowerCase())) {
            dispatch(setCustomError({ bool: true, message: t('groupError') }));
            return;
        }
        await run('new', async (dispatch) => {
            const group = await dispatch(addGroup(name, ''));
            await dispatch(addGroupTasks(group.id, task.id));
        });
        setNewName('');
    };

    return createPortal(
        <div className={styles.backdrop} onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="groupPickerTitle" ref={dialogRef}>
                <div className={styles.head}>
                    <div className={styles.titles}>
                        <h2 id="groupPickerTitle" className={styles.title}>{t('assignGroup')}</h2>
                        <p className={styles.taskName}>{task.name}</p>
                    </div>
                    <button className={styles.close} onClick={onClose} aria-label={t('close')} title={`${t('close')} (Esc)`}>
                        <svg xmlns="http://www.w3.org/2000/svg" height="22px" viewBox="0 -960 960 960" width="22px" fill="currentColor"><path d="M480-424 284-228q-11 11-28 11t-28-11q-11-11-11-28t11-28l196-196-196-196q-11-11-11-28t11-28q11-11 28-11t28 11l196 196 196-196q11-11 28-11t28 11q11 11 11 28t-11 28L536-480l196 196q11 11 11 28t-11 28q-11 11-28 11t-28-11L480-424Z"/></svg>
                    </button>
                </div>

                {groups.length === 0
                    ? <p className={styles.empty}>{t('noGroupsYet')}</p>
                    : (
                        <ul className={styles.list}>
                            {groups.map(group => {
                                const inGroup = groupIds.includes(group.id);
                                return (
                                    <li key={group.id}>
                                        <button
                                            className={inGroup ? styles.optionOn : styles.option}
                                            aria-pressed={inGroup}
                                            disabled={busyId === group.id}
                                            onClick={() => toggle(group)}
                                        >
                                            <span className={styles.check} aria-hidden="true">{inGroup ? '✓' : ''}</span>
                                            <span className={styles.optionName}>{group.name}</span>
                                            {group.description && <span className={styles.optionDesc}>{group.description}</span>}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                <form className={styles.newGroup} onSubmit={createAndAdd}>
                    <input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder={t('newGroupPlaceholder')}
                        aria-label={t('newGroupPlaceholder')}
                        maxLength={60}
                    />
                    <button type="submit" disabled={!newName.trim() || busyId === 'new'}>{t('add')}</button>
                </form>

                <div className={styles.foot}>
                    <span className={styles.hint}>{t('groupPickerHint')}</span>
                    <button className={styles.done} onClick={onClose}>{t('sessionDone')}</button>
                </div>
            </div>
        </div>,
        document.body
    );
}
