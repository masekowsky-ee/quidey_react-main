import { forwardRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import styles from './TaskRow.module.css';
import Icon from '../icons';
import TaskMeta from './TaskMeta.jsx';
import TaskLabels from '../TaskLabels.jsx';
import ConfirmDeleteButton from '../ConfirmDeleteButton.jsx';
import { isRepeating } from '../../features/tasks/deleteScope';
import { isSharedWithMe } from '../../features/tasks/taskAction';
import { useTranslation } from '../../i18n/useTranslation';
import { dueText, formatDate, formatDuration, isOverdue, toInputDate } from '../../features/helperFunction';
import { prioLevel } from '../../features/calendar/calendar';
import { taskColorAttr } from '../../features/tasks/taskColors';

// The round check at the start of a row: empty while open (a tick shows on hover), filled when done
function Check({ done, onToggle, label }) {
    return (
        <button type="button" className={`${styles.check} ${done ? styles.checkDone : ''}`} onClick={onToggle} data-part="task-check"
            aria-label={label} title={label} aria-pressed={done}>
            <Icon name="check" className={styles.checkIcon} strokeWidth={2.2} />
        </button>
    );
}

// Grabbed to drag the task into the focus area
function DragHandle({ onPointerDown, label }) {
    return (
        <span className={styles.drag} onPointerDown={onPointerDown} style={{ touchAction: 'none' }} aria-hidden="true" title={label}>
            <Icon name="drag" className={styles.dragIcon} />
        </span>
    );
}

// "High" / "Medium" for the two upper thirds of the 0-100 priority; nothing below
function Prio({ prio }) {
    const { t } = useTranslation();
    const level = prioLevel(prio);
    if (level !== 'high' && level !== 'medium') return null;
    return (
        <span className={`${styles.prio} ${level === 'high' ? styles.prioHigh : ''}`} title={`${t('prioritise')}: ${prio}`}>
            {t(`prioLevel_${level}`)}
        </span>
    );
}

// One task in the list. Open tasks: check, name (a click renames it), one line of details,
// the day (a click changes it), the priority, and the actions (focus, edit, delete). Tasks from
// a shared session carry my time instead of a day and link to their session.
// The row cascades in and out of the list (motion props come from the list).
const TaskRow = forwardRef(function TaskRow({
    task, hidden, motionProps,
    onToggleDone, onRename, onChangeDue, onEdit, onDelete, deleteLabel,
    onFocus, onDragStart, onRemoveFromGroup, onOpenGroup,
}, ref) {
    const { t } = useTranslation();
    const [editing, setEditing] = useState(null); // 'name' | 'due' | null
    const shared = Boolean(task.shared);
    const overdue = !task.done && isOverdue(task);

    const finish = (field, value) => {
        setEditing(null);
        if (field === 'name') {
            const name = value.trim();
            if (name && name !== task.name) onRename?.(name);
        } else if (field === 'due' && value !== toInputDate(task.due)) {
            onChangeDue?.(value);
        }
    };
    const fieldKeys = (field) => (e) => {
        if (e.key === 'Enter') finish(field, e.currentTarget.value);
        if (e.key === 'Escape') setEditing(null);
    };

    const name = editing === 'name'
        ? <input className={styles.nameInput} autoFocus defaultValue={task.name} aria-label={t('taskName')}
            onBlur={(e) => finish('name', e.target.value)} onKeyDown={fieldKeys('name')} />
        : <p className={`${styles.name} ${onRename && !task.done ? styles.renamable : ''}`}
            onClick={onRename && !task.done ? () => setEditing('name') : undefined}>{task.name}</p>;

    let when = null;
    if (shared) {
        when = task.myMs > 0 && <span className={styles.myTime} title={t('myTimeInSession')}>{formatDuration(task.myMs)}</span>;
    } else if (editing === 'due') {
        when = <input className={styles.dueInput} type="date" autoFocus defaultValue={toInputDate(task.due)} aria-label={t('dueDate')}
            onBlur={(e) => finish('due', e.target.value)} onKeyDown={fieldKeys('due')} />;
    } else if (!task.done) {
        const text = task.due ? dueText(task.due, t) : t('noDate');
        when = (
            <button type="button" className={`${styles.due} ${task.due ? '' : styles.noDue} ${overdue ? styles.overdue : ''}`}
                onClick={onChangeDue ? () => setEditing('due') : undefined} disabled={!onChangeDue}
                title={task.due ? [formatDate(task.due), overdue && t('overdue')].filter(Boolean).join(' · ') : undefined}>
                {text}{task.due && task.due_time && <span className={styles.dueTime}>{task.due_time}</span>}
            </button>
        );
    }

    return (
        <motion.li ref={ref} {...motionProps}
            className={`${styles.row} ${shared ? styles.sharedRow : ''} ${task.done ? styles.doneRow : ''}`}
            data-task-color={shared ? undefined : taskColorAttr(task)} data-part="task-row"
            style={hidden ? { visibility: 'hidden' } : undefined}>
            {onDragStart && !task.done ? <DragHandle onPointerDown={onDragStart} label={t('dragATask')} /> : <span className={styles.drag} />}
            <Check done={task.done} onToggle={onToggleDone}
                label={`${t(task.done ? 'reopen' : 'markDone')}: ${task.name}`} />
            <div className={styles.body}>
                {name}
                <div className={styles.details}>
                    <TaskMeta task={task} showTime={false} />
                    {task.description && <span className={styles.description} title={task.description}>{task.description}</span>}
                    <TaskLabels task={task} onOpenGroup={onOpenGroup} />
                </div>
            </div>
            <div className={styles.when}>
                {when}
                {!task.done && <Prio prio={task.prio} />}
            </div>
            <div className={styles.actions}>
                {onFocus && !task.done &&
                    <button type="button" className={styles.action} onClick={onFocus}
                        title={t('makeActive')} aria-label={`${t('makeActive')}: ${task.name}`}>
                        <Icon name="focus" className={styles.actionIcon} />
                    </button>}
                {shared
                    ? <Link to={`/together/${task.shared.sessionId}`} className={styles.sessionLink}>{t('openSession')}</Link>
                    : <>
                        {onEdit &&
                            <button type="button" className={styles.action} onClick={onEdit}
                                title={t('editTask')} aria-label={`${t('editTask')}: ${task.name}`}>
                                <Icon name="edit" className={styles.actionIcon} />
                            </button>}
                        {onRemoveFromGroup &&
                            <button type="button" className={styles.action} onClick={onRemoveFromGroup}
                                title={t('removeFromGroup')} aria-label={`${t('removeFromGroup')}: ${task.name}`}>
                                <Icon name="close" className={styles.actionIcon} />
                            </button>}
                        {/* a repeating task asks what goes instead (DeleteScopeDialog) */}
                        {onDelete && <ConfirmDeleteButton onConfirm={onDelete} label={`${deleteLabel}: ${task.name}`} title={deleteLabel} ask={!isRepeating(task) || isSharedWithMe(task)} />}
                    </>}
            </div>
        </motion.li>
    );
});

export default TaskRow;
