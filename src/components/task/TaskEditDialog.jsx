import styles from './TaskEditDialog.module.css';
import { useId } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { deleteTaskAsking, leaveTask, updateTaskProps } from '../../features/tasks/taskAction';
import { removeSharedTask, updateSharedTask } from '../../features/together/togetherAction';
import { showToast } from '../../features/toast/toast';
import TaskEditor from '../calendar/TaskEditor.jsx';
import Icon from '../icons.jsx';
import Dialog from '../Dialog.jsx';

// The calendar's task editor as a dialog (a sheet from the bottom on phones), for the task
// list on Home: every option (time, reminder, repeat, colour, sharing, groups) in one place.
// Escape, the close button or a click next to it closes without saving.
// shared: { sessionId, canRemove, subGroups? } for a task in a shared session (its own fields, no groups).
// handlers: { save(changes), remove?, subGroups?, allowEvents?, remindsAll? } (promises) for a task kept somewhere else, e.g. a
// family's calendar: the same fields as a shared session's task; without remove there is no delete
// button. subGroups (testers): the session's / family's sub-groups to move it between.
export default function TaskEditDialog({ task, onClose, shared, handlers }) {
    const titleId = useId();
    // on phones a sheet: pulled down, it closes like a click next to it (without saving). Escape
    // outside the editor's fields only (nested: the editor handles its own first)
    return (
        <Dialog onClose={onClose} labelledBy={titleId} nested backdropClassName={styles.backdrop}
            className={`${styles.panel} ${styles.panelWide}`} panelProps={{ tabIndex: -1 }}>
            {(dismiss) => <TaskEditBody task={task} shared={shared} handlers={handlers} dismiss={dismiss} titleId={titleId} />}
        </Dialog>
    );
}

function TaskEditBody({ task, shared, handlers, dismiss, titleId }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();

    const toast = (text, tone = 'success') => dispatch(showToast(text, tone));
    const reportError = () => toast(t('friendError_generic'), 'error');

    const run = async (action, doneText) => {
        try {
            // a thunk for the store, or a promise from handlers; false: cancelled (stays open)
            const result = await (typeof action === 'function' ? dispatch(action) : action);
            if (result === false) return false;
            if (doneText) toast(doneText, 'info');
            dismiss();
            return true;
        } catch {
            reportError();
            return false;
        }
    };

    const where = handlers ? {
        personal: false,
        allowEvents: Boolean(handlers.allowEvents),
        remindsAll: Boolean(handlers.remindsAll),
        subGroups: handlers.subGroups,
        onSave: (changes) => run(handlers.save(changes)),
        onDelete: handlers.remove ? () => run(handlers.remove(), t('taskDeleted')) : undefined,
    } : shared ? {
        personal: false,
        allowEvents: true,
        subGroups: shared.subGroups,
        onSave: (changes) => run(updateSharedTask(shared.sessionId, task.id, changes)),
        onDelete: shared.canRemove ? () => run(removeSharedTask(shared.sessionId, task.id), t('taskDeleted')) : undefined,
    } : {
        onSave: (changes) => run(updateTaskProps(changes, task)),
        onDelete: () => run(deleteTaskAsking(task), t('taskDeleted')),
        onLeave: () => run(leaveTask(task), t('taskLeft')),
    };

    return (
        <>
                <div className={styles.head} data-sheet-drag>
                    <div className={styles.titles}>
                        <h2 id={titleId} className={styles.title}>{t(task.kind === 'event' ? 'editEvent' : 'editTask')}</h2>
                    </div>
                    <button type="button" className={styles.closeBtn} onClick={() => dismiss()} aria-label={t('close')} title={`${t('close')} (Esc)`}>
                        <Icon name="mClose" size={22} />
                    </button>
                </div>
                <TaskEditor
                    task={task}
                    onCancel={() => dismiss()}
                    {...where}
                />
        </>
    );
}
