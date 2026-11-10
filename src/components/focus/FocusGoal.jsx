import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setFocusTask, selectTaskTime } from '../../features/session/sessionAction';
import { selectSharedSoloTasks } from '../../features/together/togetherAction';
import { updateTaskProps } from '../../features/tasks/taskAction';
import { isEvent } from '../../features/tasks/kinds';
import { fill, formatClock } from '../../features/helperFunction';
import { burstFrom, useMotionLevel } from '../../features/settings/motion';
import { playSound } from '../../features/settings/sound';
import { useTranslation } from '../../i18n/useTranslation';
import Icon from '../icons.jsx';
import styles from './FocusRoom.module.css';

// Step one of the Fokusraum: what this session is for, in one sentence, and (if it belongs to
// one) the task it's booked on: own open tasks, then shared ones. goal / onGoal: the sentence.
export default function FocusGoal({ goal, onGoal, task }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const motion = useMotionLevel();
    const tasks = useSelector(state => state.task.tasks);
    const shared = useSelector(selectSharedSoloTasks);
    const seconds = useSelector(state => task ? selectTaskTime(state, task.id) : 0);
    const open = useMemo(() => tasks.filter(item => !item.done && !isEvent(item)), [tasks]);
    const openShared = shared.filter(item => !item.done);

    const pick = (value) => {
        if (!value) { dispatch(setFocusTask(null)); return; }
        const next = [...open, ...openShared].find(item => String(item.id) === value);
        if (next) dispatch(setFocusTask(next));
    };
    const finish = (e) => {
        if (!task || task.shared) return;
        if (motion !== 'minimal') burstFrom(e.currentTarget);
        playSound('done');
        dispatch(updateTaskProps({ done: true }, task));
    };

    return (
        <section className={styles.goal} aria-label={t('focusGoalQuestion')} data-tip="focus-goal">
            <label className={styles.goalLabel} htmlFor="focus-goal">{t('focusGoalQuestion')}</label>
            <input id="focus-goal" className={styles.goalInput} value={goal} maxLength={140}
                onChange={e => onGoal(e.target.value)} placeholder={t('focusGoalPlaceholder')} autoComplete="off" />
            <div className={styles.goalTask}>
                <label className={styles.taskChip}>
                    <span>{t('focusTaskChip')}</span>
                    <select value={task ? String(task.id) : ''} onChange={e => pick(e.target.value)}>
                        <option value="">{t('focusRoomPickNone')}</option>
                        {open.length > 0 && <optgroup label={t('focusRoomMine')}>
                            {open.map(item => <option key={item.id} value={String(item.id)}>{item.name}</option>)}
                        </optgroup>}
                        {openShared.length > 0 && <optgroup label={t('focusRoomShared')}>
                            {openShared.map(item => <option key={item.id} value={String(item.id)}>{item.name}</option>)}
                        </optgroup>}
                    </select>
                    <Icon name="chevronDown" size={14} />
                </label>
                {task?.shared && <span className={styles.goalMeta}>{task.shared.sessionName}</span>}
                {task && seconds > 0 && <span className={styles.goalMeta}>{fill(t('focusOnTaskThisSession'), { time: formatClock(seconds * 1000) })}</span>}
                {task && !task.shared &&
                    <button type="button" className={styles.goalDone} onClick={finish}>
                        <Icon name="check" size={15} strokeWidth={2.2} /> {t('focusTaskDone')}
                    </button>}
            </div>
        </section>
    );
}
