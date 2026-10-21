import styles from './TaskOptions.module.css';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { TASK_COLORS } from '../../features/tasks/taskColors';
import TaskColorPicker from './TaskColorPicker.jsx';

// A small dot in the task's colour; a click opens the swatches right next to it.
// Picking one (or Escape, or a click elsewhere) closes them again.
// Works for anything with a .color (a group too); label: what the colour is of (default "Colour").
export default function TaskColorButton({ task, onChange, label }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const popId = useId();
    const color = TASK_COLORS.includes(task.color) ? task.color : null;

    useEffect(() => {
        if (!open) return;
        const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('pointerdown', close);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', close);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const pick = (next) => {
        setOpen(false);
        if (next !== color) onChange(next);
    };

    return (
        <span className={styles.colorButtonWrap} ref={ref}>
            <button type="button" className={styles.colorButton} aria-expanded={open} aria-controls={open ? popId : undefined}
                title={label ?? t('taskColor')} aria-label={`${label ?? t('taskColor')}: ${t(color ? `taskColor_${color}` : 'taskColorNone')}`}
                onClick={() => setOpen(!open)}>
                <span className={color ? styles.swatchDot : `${styles.swatchDot} ${styles.swatchNone}`} data-task-color={color ?? undefined} aria-hidden="true" />
            </button>
            {open &&
                <div id={popId} className={styles.colorPopover}>
                    <TaskColorPicker value={color} onChange={pick} hideLabel />
                </div>}
        </span>
    );
}
