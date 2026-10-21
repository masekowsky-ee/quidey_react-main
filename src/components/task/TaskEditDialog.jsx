import styles from '../CalendarDay.module.css';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { deleteTask, leaveTask, updateTaskProps } from '../../features/tasks/taskAction';
import { showToast } from '../../features/toast/toast';
import TaskEditor from '../calendar/TaskEditor.jsx';
import GroupPicker from '../GroupPicker.jsx';
import Icon from '../calendar/icons.jsx';

// The calendar's task editor as a dialog (a sheet from the bottom on phones), for the task
// list on Home: every option (time, reminder, repeat, colour, sharing, groups) in one place.
// Escape, the close button or a click next to it closes without saving.
export default function TaskEditDialog({ task, onClose }) {
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
            await dispatch(action);
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
                        <h2 id={titleId} className={styles.title}>{t('editTask')}</h2>
                    </div>
                    <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={t('close')} title={`${t('close')} (Esc)`}>
                        <Icon name="close" size={22} />
                    </button>
                </div>
                <TaskEditor
                    task={task}
                    onSave={(changes) => run(updateTaskProps(changes, task))}
                    onCancel={onClose}
                    onDelete={() => run(deleteTask(task.id), t('taskDeleted'))}
                    onLeave={() => run(leaveTask(task), t('taskLeft'))}
                    onPickGroups={setPickerTask}
                />
            </div>
            {pickerTask && <GroupPicker task={pickerTask} onClose={closePicker} />}
        </div>,
        document.body
    );
}
