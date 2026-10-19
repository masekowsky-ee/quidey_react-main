import styles from './TaskOptions.module.css';
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { displayName, fill, formatDate, getInitials } from '../../features/helperFunction';
import { acceptTaskInvite, declineTaskInvite } from '../../features/tasks/taskAction';
import { showToast } from '../../features/toast/toast';
import TaskMeta from './TaskMeta.jsx';

// Tasks friends sent me: accept (it joins my list) or decline. Nothing when there are none.
export default function TaskInvites() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const invites = useSelector(state => state.task.invites);
    const [busyId, setBusyId] = useState(null);

    if (invites.length === 0) return null;

    const answer = async (invite, accept) => {
        setBusyId(invite.id);
        try {
            await dispatch(accept ? acceptTaskInvite(invite.id) : declineTaskInvite(invite.id));
            dispatch(showToast(t(accept ? 'taskInviteAccepted' : 'taskInviteDeclined'), accept ? 'success' : 'info'));
        } catch {
            dispatch(showToast(t('friendError_generic'), 'error'));
        } finally {
            setBusyId(null);
        }
    };

    return (
        <section className={styles.invites} aria-labelledby="taskInvitesTitle">
            <h2 id="taskInvitesTitle" className={styles.invitesTitle}>
                {t('taskInvitesTitle')}<span className={styles.invitesCount}>{invites.length}</span>
            </h2>
            <ul className={styles.inviteList}>
                {invites.map(invite => (
                    <li key={invite.id} className={styles.invite}>
                        <span className={styles.avatar} aria-hidden="true">{getInitials(displayName(invite.from))}</span>
                        <div className={styles.inviteText}>
                            <span className={styles.inviteFrom}>{fill(t('taskInviteFrom'), { name: displayName(invite.from) })}</span>
                            <span className={styles.inviteName}>{invite.task.name}</span>
                            <span className={styles.inviteWhen}>
                                {invite.task.due && <span>{formatDate(invite.task.due)}</span>}
                                <TaskMeta task={invite.task} />
                            </span>
                        </div>
                        <div className={styles.inviteActions}>
                            <button type="button" className={styles.acceptBtn} disabled={busyId === invite.id} onClick={() => answer(invite, true)}>
                                {t('accept')}
                            </button>
                            <button type="button" className={styles.declineBtn} disabled={busyId === invite.id} onClick={() => answer(invite, false)}
                                aria-label={`${t('decline')}: ${invite.task.name}`}>
                                {t('decline')}
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}
