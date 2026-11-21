import styles from '../Together.module.css';
import own from './Family.module.css';
import { useId, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { fill } from '../../features/helperFunction';
import { movableTasks, moveToFamily } from '../../features/family/family';
import { refreshTasks } from '../../features/tasks/taskAction';
import { useFamilyRun } from './useFamilyRun';
import Dialog from '../Dialog.jsx';
import Icon from '../icons';
import OpenTaskList from '../together/OpenTaskList';
import { quietly } from '../../features/api/quietly';

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
        await quietly(dispatch(refreshTasks()));
    };

    return (
        <OpenTaskList title={t('familyMoveTitle')} emptyText={t('familyMoveEmpty')} tasks={tasks}
            renderAction={(task) => (
                <button type="button" className={styles.secondaryBtn} onClick={() => setAsking(task)}
                    aria-label={`${t('familyMoveBtn')}: ${task.name}`}>
                    {t('familyMoveBtn')}
                </button>
            )}>
            {asking && <MoveQuestion key={asking.id} task={asking}
                onAnswer={(yes) => { const task = asking; setAsking(null); if (yes) move(task); }} />}
        </OpenTaskList>
    );
}

// "Move “Essay”?": what it means, then Move or Cancel. A sheet on phones (pulled down: cancel).
function MoveQuestion({ task, onAnswer }) {
    const { t } = useTranslation();
    const titleId = useId();
    const yesRef = useRef(null);
    return (
        <Dialog onClose={() => onAnswer(false)} role="alertdialog" labelledBy={titleId} initialFocus={yesRef} drag
            backdropClassName={own.moveBackdrop} className={own.moveDialog}>
            {(dismiss) => (<>
                <h2 id={titleId} className={own.moveTitle}>{fill(t('familyMoveConfirmTitle'), { name: task.name })}</h2>
                <p className={own.moveText}>{t('familyMoveConfirm')}</p>
                <div className={own.moveActions}>
                    <button type="button" className={own.moveNo} onClick={() => dismiss()}>{t('cancel')}</button>
                    <button type="button" ref={yesRef} className={own.moveYes} onClick={() => dismiss(() => onAnswer(true))}>
                        <Icon name="arrowRight" size={18} /> {t('familyMoveYes')}
                    </button>
                </div>
            </>)}
        </Dialog>
    );
}
