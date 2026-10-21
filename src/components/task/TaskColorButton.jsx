import styles from './TaskOptions.module.css';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { TASK_COLORS } from '../../features/tasks/taskColors';
import TaskColorPicker from './TaskColorPicker.jsx';

// distance kept to the window's edges
const EDGE = 8;

// A small dot in the task's colour; a click opens the swatches right next to it.
// Picking one (or Escape, a click elsewhere, scrolling) closes them again.
// Works for anything with a .color (a group too); label: what the colour is of (default "Colour").
// The swatches float in document.body, placed under the dot (above it when there's no room)
// and kept inside the window, so a narrow card or a phone screen doesn't cut them off.
export default function TaskColorButton({ task, onChange, label }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const popRef = useRef(null);
    const popId = useId();
    const color = TASK_COLORS.includes(task.color) ? task.color : null;

    useEffect(() => {
        if (!open) return;
        const close = (e) => {
            if (!ref.current?.contains(e.target) && !popRef.current?.contains(e.target)) setOpen(false);
        };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        const onMove = () => setOpen(false);
        document.addEventListener('pointerdown', close);
        document.addEventListener('keydown', onKey);
        window.addEventListener('resize', onMove);
        window.addEventListener('scroll', onMove, true);
        return () => {
            document.removeEventListener('pointerdown', close);
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('resize', onMove);
            window.removeEventListener('scroll', onMove, true);
        };
    }, [open]);

    useLayoutEffect(() => {
        const popEl = popRef.current;
        const button = ref.current?.getBoundingClientRect();
        if (!open || !popEl || !button) return;
        const pop = popEl.getBoundingClientRect();
        const vw = document.documentElement.clientWidth || window.innerWidth;
        const vh = window.innerHeight;
        const left = Math.max(EDGE, Math.min(button.right - pop.width, vw - pop.width - EDGE));
        const below = button.bottom + 6;
        const top = below + pop.height > vh - EDGE && button.top - 6 - pop.height >= EDGE
            ? button.top - 6 - pop.height
            : below;
        popEl.style.left = `${left}px`;
        popEl.style.top = `${top}px`;
        popEl.style.visibility = 'visible';
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
            {open && createPortal(
                <div id={popId} ref={popRef} className={styles.colorPopover}
                    style={{ left: 0, top: 0, visibility: 'hidden' }}>
                    <TaskColorPicker value={color} onChange={pick} hideLabel />
                </div>,
                document.body
            )}
        </span>
    );
}
