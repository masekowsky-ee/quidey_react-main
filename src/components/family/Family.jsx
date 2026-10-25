import styles from '../Together.module.css';
import own from './Family.module.css';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { displayName, fill } from '../../features/helperFunction';
import { fetchFriends } from '../../features/friends/friendsAction';
import { createFamily, fetchFamilies, joinFamily, removeFamilyMember } from '../../features/family/family';
import { useFamilyRun } from './useFamilyRun';
import { calendarLink } from '../../features/calendar/sources';
import Avatar from '../together/Avatar';
import FriendPicker from '../together/FriendPicker';
import { friendsPath } from '../../features/community/paths';

// Start a family: name + friends to invite
function NewFamily({ onCreated }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const run = useFamilyRun();
    const friends = useSelector(state => state.friends.friends);
    const [name, setName] = useState('');
    const [invitees, setInvitees] = useState([]);
    const [busy, setBusy] = useState(false);

    useEffect(() => { dispatch(fetchFriends()).catch(() => {}); }, [dispatch]);

    const submit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setBusy(true);
        const family = await run(createFamily(name.trim(), invitees), 'toast_familyCreated');
        setBusy(false);
        if (family) onCreated(family);
    };

    return (
        <form className={styles.form} onSubmit={submit}>
            <label htmlFor="familyName" className={styles.label}>{t('familyName')}</label>
            <input id="familyName" value={name} maxLength={60} autoComplete="off"
                onChange={(e) => setName(e.target.value)} placeholder={t('familyNamePlaceholder')} />
            <span className={styles.label}>{t('inviteFriends')}</span>
            {friends.length > 0
                ? <FriendPicker friends={friends} selected={invitees} onChange={setInvitees} />
                : <p className={styles.hint}>{t('noFriendsToInvite')} <Link to={friendsPath('add')}>{t('addFriend')}</Link></p>}
            <div className={styles.formActions}>
                <button type="submit" className={styles.primaryBtn} disabled={busy || !name.trim()}>{t('createFamily')}</button>
            </div>
        </form>
    );
}

// Quidey Family (testers): my families, the invites waiting for me, and a form to start one
export default function Family() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const run = useFamilyRun();
    const { families, invites } = useSelector(state => state.family);
    const [busyId, setBusyId] = useState(null);

    useEffect(() => { dispatch(fetchFamilies()).catch(() => {}); }, [dispatch]);

    const join = async (id) => {
        setBusyId(id);
        if (await run(joinFamily(id), 'toast_familyJoined')) navigate(`/family/${id}`);
        setBusyId(null);
    };
    const decline = async (id) => {
        setBusyId(id);
        await run(removeFamilyMember(id, 'me'));
        setBusyId(null);
    };

    return (
        // a tab of the Gemeinschaft page, which has the title
        <div className={styles.embedded}>
            <p className={styles.lead}>{t('familyIntro')}</p>

            {invites.length > 0 &&
                <section className={`${styles.card} ${styles.inviteCard}`}>
                    <h2 className={styles.cardTitle}>{t('familyInvites')}</h2>
                    <ul className={styles.list}>
                        {invites.map(invite => (
                            <li key={invite.id} className={styles.row}>
                                <Avatar user={invite.invitedBy ?? invite.owner} />
                                <div className={styles.who}>
                                    <span className={styles.name}>{invite.name}</span>
                                    <span className={styles.meta}>
                                        {fill(t('familyInvitedBy'), { name: displayName(invite.invitedBy ?? invite.owner) })} · {invite.memberCount} {t(invite.memberCount === 1 ? 'member' : 'members')}
                                    </span>
                                </div>
                                <div className={styles.actions}>
                                    <button className={styles.acceptBtn} disabled={busyId === invite.id} onClick={() => join(invite.id)}>{t('join')}</button>
                                    <button className={styles.quietBtn} disabled={busyId === invite.id} onClick={() => decline(invite.id)}>{t('decline')}</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>}

            <section className={styles.card}>
                <h2 className={styles.cardTitle}>{t('myFamilies')}</h2>
                {families.length === 0
                    ? <p className={styles.emptyLine}>{t('noFamilies')}</p>
                    : <ul className={styles.list}>
                        {families.map(family => (
                            <li key={family.id} className={own.familyItem}>
                                <Link to={`/family/${family.id}`} className={own.familyLink}>
                                    <span className={own.listEmoji} data-task-color={family.color ?? undefined} aria-hidden="true">{family.emoji ?? '🏡'}</span>
                                    <div className={styles.who}>
                                        <span className={styles.name}>{family.name}</span>
                                        <span className={styles.meta}>
                                            {displayName(family.owner)} · {family.memberCount} {t(family.memberCount === 1 ? 'member' : 'members')}
                                        </span>
                                    </div>
                                </Link>
                                <Link to={calendarLink('family', family.id)} className={styles.quietLink}>{t('calendar')} →</Link>
                            </li>
                        ))}
                    </ul>}
            </section>

            <section className={styles.card}>
                <h2 className={styles.cardTitle}>{t('createFamily')}</h2>
                <NewFamily onCreated={(family) => navigate(`/family/${family.id}`)} />
            </section>
        </div>
    );
}
