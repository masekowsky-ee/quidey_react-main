import styles from '../Calendar.module.css';
import { prioLevel, taskTimeText } from '../../features/calendar/calendar';
import { isOverdue } from '../../features/helperFunction';
import { useTranslation } from '../../i18n/useTranslation';

const PRIO_CLASS = { high: styles.prioHigh, medium: styles.prioMedium, low: styles.prioLow };

// Shared with friends (mine, somebody joined) or from a friend
const isShared = (task) => Boolean(task.owner) || (task.sharedWith ?? []).some(share => share.status === 'accepted');

// One task inside a day of the month or week view: its start time (in the week view with the
// end and the location), name and a mark when it's shared. Clicking opens it, dragging (mouse
// or pen) moves it to another day. The day itself is the tab stop, so the chip is left out of
// the tab order unless asked for.
export default function TaskChip({ task, today, onOpen, startDrag, dragging, showDescription = false, tabIndex = -1 }) {
    const { t } = useTranslation();
    const classes = [
        styles.chip,
        PRIO_CLASS[prioLevel(task.prio)],
        task.done && styles.chipDone,
        isOverdue(task, today) && styles.chipOverdue,
        dragging && styles.chipDragging,
    ].filter(Boolean).join(' ');
    // the month view only has room for the start
    const time = showDescription ? taskTimeText(task) : (task.due_time ?? '');
    const shared = isShared(task);

    return (
        <button
            type="button"
            className={classes}
            tabIndex={tabIndex}
            title={[time, task.name, task.location].filter(Boolean).join(' · ')}
            onPointerDown={startDrag ? (e) => startDrag(e, task) : undefined}
            onClick={(e) => { e.stopPropagation(); onOpen(task); }}
        >
            <span className={styles.chipName}>
                {time && <span className={styles.chipTime}>{time}</span>}
                {task.name}
                {shared && <span className={styles.chipShared} title={t('sharedWithLabel')} aria-label={t('sharedWithLabel')}>👥</span>}
            </span>
            {showDescription && task.location && <span className={styles.chipMeta}>⌖ {task.location}</span>}
            {showDescription && task.description && <span className={styles.chipDesc}>{task.description}</span>}
        </button>
    );
}
