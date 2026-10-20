import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { addTask, shareTask } from '../features/tasks/taskAction'
import styles from './Form.module.css';
import {useTranslation} from '../i18n/useTranslation';
import {setCustomError} from '../features/settings/settingsAction';
import { showToast } from '../features/toast/toast';
import TaskOptionsFields from './task/TaskOptionsFields.jsx';
import { linkIsValid } from '../features/tasks/taskFields';
import { useFriends } from '../features/friends/useFriends';
import FriendPicker from './together/FriendPicker.jsx';

const EMPTY_EXTRAS = { duration_minutes: null, reminder_minutes: null, location: '', link: '', details: '', repeat: null };

// New task: name and day, optionally a time (otherwise for the whole day), description and
// priority. "More options" adds duration, reminder, location, link, extra info and friends
// to share it with (they get an invite once it's created).
export default function TaskForm(props){
    const {setCreateTask} = props;

    const dispatch = useDispatch();

    const { t } = useTranslation();

    const groupToDisplay = useSelector((state)=>state.task.groupToDisplay)

    const [name, setName] = useState('');
    const [due, setDue] = useState('');
    const [time, setTime] = useState('');
    const [description, setDescription] = useState('');
    const [prio, setPrio] = useState(50);
    const [showMore, setShowMore] = useState(false);
    const [extras, setExtras] = useState(EMPTY_EXTRAS);
    const [shareWith, setShareWith] = useState([]);
    const [busy, setBusy] = useState(false);

    const friends = useFriends();

    async function handleSubmit(e){
        e.preventDefault();
        if (!name.trim() || !due) {
            dispatch( setCustomError({bool: true, message: t('dateNameTaskError') }) );
            return;
        }
        if (!linkIsValid(extras.link)) {
            setShowMore(true);
            return;
        }
        // the shown group gets the new task (not a shared session's group: those aren't real groups)
        const groupId = groupToDisplay.group?.id;
        const activeGroupId = typeof groupId === 'number' && groupToDisplay.group.name !== 'all' ? groupId : null;
        setBusy(true);
        try {
            const task = await dispatch(addTask(name.trim(), due, description.trim(), prio, activeGroupId, undefined, {
                due_time: time || null,
                duration_minutes: extras.duration_minutes,
                reminder_minutes: time ? extras.reminder_minutes : null,
                location: extras.location.trim(),
                link: extras.link.trim(),
                details: extras.details.trim(),
                // repeating needs a day
                repeat: due ? extras.repeat : null,
            }));
            if (shareWith.length > 0) {
                await dispatch(shareTask(task.id, shareWith));
                dispatch(showToast(t('shareInviteSent'), 'success'));
            }
            setCreateTask(false);
        } catch (err) {
            dispatch(setCustomError({ bool: true, message: err.message || t('friendError_generic') }));
            setBusy(false);
        }
    }

    return (
        <div className={`${styles.div}`}>
            <button className={styles.closeBtn} onClick={()=>{setCreateTask(false)}} aria-label={t('close')}>
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>
            </button>
            <h2>{t('createTaskH2')}</h2>
            <form className={`${styles.form}`} onSubmit={handleSubmit} noValidate>
                <input className={styles.input} type="text" placeholder={t('taskName')} aria-label={t('taskName')}
                    value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
                <div className={styles.rowDiv}>
                    <input className={`${styles.input} ${styles.grow}`} type="date" aria-label={t('dueDate')}
                        value={due} onChange={(e) => setDue(e.target.value)} />
                    <input className={styles.input} type="time" aria-label={`${t('taskTime')} (${t('allDay')}: –)`} title={t('taskTime')}
                        value={time} onChange={(e) => setTime(e.target.value)} />
                </div>
                <input className={styles.input} type="text" placeholder={t('description')} aria-label={t('description')}
                    value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
                <label htmlFor="prioritise">{t('prioritise')}</label>
                <div className={styles.rowDiv}>
                    <p>{t('low')}</p>
                    <input type="range" id="prioritise" min="0" max="100" step="1" value={prio} onChange={(e) => setPrio(Number(e.target.value))} />
                    <p>{t('high')}</p>
                </div>

                <button type="button" className={styles.moreToggle} aria-expanded={showMore} onClick={() => setShowMore(!showMore)}>
                    <span aria-hidden="true">{showMore ? '▾' : '▸'}</span> {showMore ? t('fewerOptions') : t('moreOptions')}
                </button>
                {showMore &&
                    <div className={styles.more}>
                        <TaskOptionsFields value={extras} hasTime={Boolean(time)} hasDate={Boolean(due)} onChange={(change) => setExtras(prev => ({ ...prev, ...change }))} />
                        <div className={styles.shareBlock}>
                            <span className={styles.shareLabel}>{t('shareWithFriends')}</span>
                            {friends.length > 0
                                ? <>
                                    <FriendPicker friends={friends} selected={shareWith} onChange={setShareWith} />
                                    {shareWith.length > 0 && <p className={styles.shareHint}>{t('shareOnCreateHint')}</p>}
                                </>
                                : <p className={styles.shareHint}>{t('noFriendsToShare')} <Link to="/social">{t('findFriends')} →</Link></p>}
                        </div>
                    </div>}

                <button type="submit" className={styles.createBtn} disabled={busy}>{t('createBtn')}</button>
            </form>
        </div>
    )
}
