import styles from '../Together.module.css';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { displayName, formatDuration } from '../../features/helperFunction';
import { fetchFriends } from '../../features/friends/friendsAction';
import { inviteToSharedSession, removeSharedMember } from '../../features/together/togetherAction';
import { selectWork, localMs, othersRunningMs, othersWorking, useNow } from '../../features/together/work';
import { useTogetherRun } from '../../features/together/hooks';
import Avatar from './Avatar';
import FriendPicker from './FriendPicker';

import Icon from '../icons';
// Members with what they are doing right now, their time, and inviting more friends
export default function TeamPresence({ session }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const run = useTogetherRun();
    const friends = useSelector(state => state.friends.friends);
    const work = useSelector(selectWork);
    const now = useNow(Boolean(work.taskId) || othersWorking(session));

    const [showInvite, setShowInvite] = useState(false);
    const [invitees, setInvitees] = useState([]);

    useEffect(() => {
        dispatch(fetchFriends()).catch(() => {});
    }, [dispatch]);

    const me = session.me;
    const isOpen = !session.endedAt;
    const taskById = new Map(session.tasks.map(task => [task.id, task]));
    const myExtra = session.tasks.reduce((sum, task) => sum + localMs(work, task.id, now), 0);

    const people = session.people.filter(p => p.status !== 'left').map(person => {
        const taskId = person.user.id === me ? (work.sessionId === session.id ? work.taskId : null) : person.workingOn;
        return {
            ...person,
            task: taskById.get(taskId) ?? null,
            total: person.totalMs + (person.user.id === me ? myExtra : othersRunningMs(session, person.user.id, undefined, now)),
        };
    });
    // working people first, then the others, invited last
    const rank = (p) => (p.status === 'invited' ? 2 : p.task ? 0 : 1);
    people.sort((a, b) => rank(a) - rank(b));
    const workingCount = people.filter(p => p.task).length;

    const invitable = friends.filter(f => !session.people.some(p => p.user.id === f.id && p.status !== 'left'));

    const handleInvite = async () => {
        if (await run(inviteToSharedSession(session.id, invitees), 'toast_invited')) {
            setInvitees([]);
            setShowInvite(false);
        }
    };

    return (
        <section className={styles.card}>
            <div className={styles.cardHead}>
                <h2 className={styles.cardTitle}>{t('team')}</h2>
                {workingCount > 0 && <span className={styles.live}><span className={styles.liveDot} />{workingCount} {t('workingNow')}</span>}
            </div>
            <ul className={styles.scrollList}>
                {people.map(person => (
                    <li key={person.user.id} className={styles.row}>
                        <Avatar user={person.user} live={Boolean(person.task)} />
                        <div className={styles.who}>
                            <span className={styles.name}>
                                {displayName(person.user)}{person.user.id === me && ` (${t('you')})`}
                                {person.isOwner && <span className={styles.ownerTag}>{t('owner')}</span>}
                            </span>
                            <span className={person.task ? styles.liveText : styles.meta}>
                                {person.status === 'invited'
                                    ? t('invitedWaiting')
                                    : person.task ? `${t('on')} ${person.task.name}` : t('idle')}
                            </span>
                        </div>
                        {person.status === 'joined' && person.total > 0 && <span className={styles.timeSmall}>{formatDuration(person.total)}</span>}
                        {isOpen && session.isOwner && !person.isOwner && (
                            <button
                                className={styles.quietBtn}
                                onClick={() => run(removeSharedMember(session.id, person.user.id, me))}
                                title={t(person.status === 'invited' ? 'withdrawRequest' : 'removeFriend')}
                                aria-label={`${t(person.status === 'invited' ? 'withdrawRequest' : 'removeFriend')}: ${displayName(person.user)}`}
                            ><Icon name="close" size={16} /></button>
                        )}
                    </li>
                ))}
            </ul>
            {isOpen && (showInvite ? (
                <div className={styles.invite}>
                    {invitable.length > 0
                        ? <FriendPicker friends={invitable} selected={invitees} onChange={setInvitees} />
                        : <p className={styles.hint}>{t('everyoneInvited')}</p>}
                    <div className={styles.formActions}>
                        <button className={styles.quietBtn} onClick={() => { setShowInvite(false); setInvitees([]); }}>{t('cancel')}</button>
                        <button className={styles.primaryBtn} disabled={invitees.length === 0} onClick={handleInvite}>{t('invite')}</button>
                    </div>
                </div>
            ) : (
                <button className={styles.addPersonBtn} onClick={() => setShowInvite(true)}>+ {t('inviteFriends')}</button>
            ))}
        </section>
    );
}
