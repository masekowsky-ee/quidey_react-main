import styles from '../Together.module.css';
import own from './Family.module.css';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { fill, formatDate } from '../../features/helperFunction';
import { movableTasks, moveToFamily } from '../../features/family/family';
import { refreshTasks } from '../../features/tasks/taskAction';
import { useSheet } from '../../features/layout/dragDismiss';
import { useFamilyRun } from './useFamilyRun';
import SheetGrabber from '../SheetGrabber.jsx';
import Icon from '../icons';

// "From my tasks": my own tasks and events, each moved into the family after a question (it
// leaves my list). subGroup: the shown sub-group, which it goes into. onChanged(family).
export default function MoveMyTasks({ family, subGroup = null, onChanged }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const run = useFamilyRun();
    const tasks = movableTasks(useSelector(state => state.task.tasks));
    const [asking, setAsking] = useState(null);

    const move = async (task) => {
        const changed = await run(moveToFamily(family.id, task.id, subGroup ? { group_id: subGroup } : {}), 'toast_movedToFamily');
        if (!changed) return;
        onChanged(changed);
        await dispatch(refreshTasks()).catch(() => {});
    };

    return (
        <section className={styles.card}>
            <h2 className={styles.cardTitle}>{t('familyMoveTitle')}</h2>
            {tasks.length === 0 ? <p className={styles.emptyLine}>{t('familyMoveEmpty')}</p> : (
                <ul className={styles.scrollList}>
                    {tasks.map(task => (
                        <li key={task.id} className={styles.row}>
                            <div className={styles.who}>
                                <span className={styles.name}>{task.name}</span>
                                <span className={styles.meta}>
                                    {[task.kind === 'event' && t('kind_event'), task.due && formatDate(task.due)].filter(Boolean).join(' · ')}
                                </span>
                            </div>
                            <button type="button" className={styles.secondaryBtn} onClick={() => setAsking(task)}
                                aria-label={`${t('familyMoveBtn')}: ${task.name}`}>
                                {t('familyMoveBtn')}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {asking && <MoveQuestion key={asking.id} task={asking}
                onAnswer={(yes) => { const task = asking; setAsking(null); if (yes) move(task); }} />}
        </section>
    );
}

// "Move “Essay”?": what it means, then Move or Cancel. A sheet on phones (pulled down: cancel).
function MoveQuestion({ task, onAnswer }) {
    const { t } = useTranslation();
    const titleId = useId();
    const yesRef = useRef(null);
    const sheet = useSheet(() => onAnswer(false));
    const { dismiss } = sheet;

    useEffect(() => {
        const previous = document.activeElement;
        yesRef.current?.focus();
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            e.preventDefault();
            e.stopPropagation();
            dismiss();
        };
        window.addEventListener('keydown', onKey, true);
        return () => {
            window.removeEventListener('keydown', onKey, true);
            previous?.focus?.();
        };
    }, [dismiss]);

    return createPortal(
        <div className={own.moveBackdrop} {...sheet.backdrop} onPointerDown={(e) => { if (e.target === e.currentTarget) dismiss(); }}>
            <div className={own.moveDialog} role="alertdialog" aria-modal="true" aria-labelledby={titleId} {...sheet.panel} data-sheet-drag>
                <SheetGrabber />
                <h2 id={titleId} className={own.moveTitle}>{fill(t('familyMoveConfirmTitle'), { name: task.name })}</h2>
                <p className={own.moveText}>{t('familyMoveConfirm')}</p>
                <div className={own.moveActions}>
                    <button type="button" className={own.moveNo} onClick={() => dismiss()}>{t('cancel')}</button>
                    <button type="button" ref={yesRef} className={own.moveYes} onClick={() => dismiss(() => onAnswer(true))}>
                        <Icon name="arrowRight" size={18} /> {t('familyMoveYes')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
