import styles from '../CalendarDay.module.css';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { deleteTaskAsking, leaveTask, updateTaskProps } from '../../features/tasks/taskAction';
import { removeSharedTask, updateSharedTask } from '../../features/together/togetherAction';
import { showToast } from '../../features/toast/toast';
import TaskEditor from '../calendar/TaskEditor.jsx';
import GroupPicker from '../GroupPicker.jsx';
import Icon from '../calendar/icons.jsx';

// The calendar's task editor as a dialog (a sheet from the bottom on phones), for the task
// list on Home: every option (time, reminder, repeat, colour, sharing, groups) in one place.
// Escape, the close button or a click next to it closes without saving.
// shared: { sessionId, canRemove, subGroups? } for a task in a shared session (its own fields, no groups).
// handlers: { save(changes), remove?, subGroups? } (promises) for a task kept somewhere else, e.g. a
// family's calendar: the same fields as a shared session's task; without remove there is no delete
// button. subGroups (testers): the session's / family's sub-groups to move it between.
export default function TaskEditDialog({ task, onClose, shared, handlers }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const titleId = useId();
    const panelRef = useRef(null);
    const [pickerTask, setPickerTask] = useState(null);
    const closePicker = useCallback(() => setPickerTask(null), []);

    const toast = (text, tone = 'success') => dispatch(showToast(text, tone));
    const reportError = () => toast(t('friendError_generic'), 'error');

    // focus goes back to where it was (the edit button) once the dialog is gone
    useEffect(() => {
        const previous = document.activeElement;
        return () => previous?.focus?.();
    }, []);

    // Escape outside the editor's fields (the editor handles its own)
    useEffect(() => {
        const onKey = (e) => {
            if (pickerTask || e.defaultPrevented) return;
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [pickerTask, onClose]);

    const run = async (action, doneText) => {
        try {
            // a thunk for the store, or a promise from handlers; false: cancelled (stays open)
            const result = await (typeof action === 'function' ? dispatch(action) : action);
            if (result === false) return false;
            if (doneText) toast(doneText, 'info');
            onClose();
            return true;
        } catch {
            reportError();
            return false;
        }
    };

    return createPortal(
        <div className={styles.backdrop} onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className={`${styles.panel} ${styles.panelWide}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panelRef} tabIndex={-1}>
                <div className={styles.head}>
                    <div className={styles.titles}>
                        <h2 id={titleId} className={styles.title}>{t(task.kind === 'event' ? 'editEvent' : 'editTask')}</h2>
                    </div>
                    <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={t('close')} title={`${t('close')} (Esc)`}>
                        <Icon name="close" size={22} />
                    </button>
                </div>
                {handlers
                    ? <TaskEditor
                        task={task}
                        personal={false}
                        subGroups={handlers.subGroups}
                        onSave={(changes) => run(handlers.save(changes))}
                        onCancel={onClose}
                        onDelete={handlers.remove ? () => run(handlers.remove(), t('taskDeleted')) : undefined}
                    />
                    : shared
                    ? <TaskEditor
                        task={task}
                        personal={false}
                        allowEvents
                        subGroups={shared.subGroups}
                        onSave={(changes) => run(updateSharedTask(shared.sessionId, task.id, changes))}
                        onCancel={onClose}
                        onDelete={shared.canRemove ? () => run(removeSharedTask(shared.sessionId, task.id), t('taskDeleted')) : undefined}
                    />
                    : <TaskEditor
                        task={task}
                        onSave={(changes) => run(updateTaskProps(changes, task))}
                        onCancel={onClose}
                        onDelete={() => run(deleteTaskAsking(task), t('taskDeleted'))}
                        onLeave={() => run(leaveTask(task), t('taskLeft'))}
                        onPickGroups={setPickerTask}
                    />}
            </div>
            {pickerTask && <GroupPicker task={pickerTask} onClose={closePicker} />}
        </div>,
        document.body
    );
}
