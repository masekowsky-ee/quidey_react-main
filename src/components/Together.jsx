import styles from './Together.module.css';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../i18n/useTranslation';
import { formatDate, formatDuration, displayName } from '../features/helperFunction';
import {
    fetchSharedSessions, joinSharedSession, removeSharedMember,
} from '../features/together/togetherAction';
import { useTogetherRun } from '../features/together/hooks';
import Avatar from './together/Avatar';
import QuickStart from './together/QuickStart';

function SessionRow({ session, t }) {
    return (
        <li>
            <Link to={`/together/${session.id}`} className={styles.sessionLink}>
                <div className={styles.who}>
                    <span className={styles.name}>{session.name}</span>
                    <span className={styles.meta}>
                        {session.endedAt
                            ? `${t('endedOn')} ${formatDate(session.endedAt)}`
                            : `${displayName(session.owner)} · ${session.memberCount} ${t(session.memberCount === 1 ? 'member' : 'members')}`}
                    </span>
                </div>
                {session.workingCount > 0 && (
                    <span className={styles.live}><span className={styles.liveDot} />{session.workingCount} {t('workingNow')}</span>
                )}
                <div className={styles.times}>
                    <span className={styles.timeMain}>{formatDuration(session.myMs)}</span>
                    <span className={styles.meta}>{t('ofTotal')} {formatDuration(session.totalMs)}</span>
                </div>
            </Link>
        </li>
    );
}

export default function Together() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const run = useTogetherRun();
    const { sessions, invites } = useSelector(state => state.together);
    const [searchParams] = useSearchParams();

    useEffect(() => {
        dispatch(fetchSharedSessions()).catch(() => {});
    }, [dispatch]);

    // "New session" from the header jumps straight to the form
    const wantsNew = searchParams.get('new') === '1';
    useEffect(() => {
        if (wantsNew) document.getElementById('sharedSessionName')?.focus();
    }, [wantsNew]);

    const [busyId, setBusyId] = useState(null);

    const handleJoin = async (id) => {
        setBusyId(id);
        if (await run(joinSharedSession(id), 'toast_joined')) navigate(`/together/${id}`);
        else dispatch(fetchSharedSessions()).catch(() => {});
        setBusyId(null);
    };

    const handleDecline = async (invite) => {
        setBusyId(invite.id);
        // "me": the server takes my id from the login
        await run(removeSharedMember(invite.id, 'me', 'me'));
        setBusyId(null);
    };

    const open = sessions.filter(s => !s.endedAt);
    const past = sessions.filter(s => s.endedAt);

    return (
        <div className={styles.page}>
            <h1 className={styles.title}>{t('together')}</h1>
            <p className={styles.intro}>{t('togetherIntro')}</p>

            {invites.length > 0 && (
                <section className={`${styles.card} ${styles.inviteCard}`}>
                    <h2 className={styles.cardTitle}>{t('sessionInvites')}</h2>
                    <ul className={styles.list}>
                        {invites.map(invite => (
                            <li key={invite.id} className={styles.row}>
                                <Avatar user={invite.invitedBy ?? invite.owner} />
                                <div className={styles.who}>
                                    <span className={styles.name}>{invite.name}</span>
                                    <span className={styles.meta}>
                                        {t('invitedBy')} {displayName(invite.invitedBy ?? invite.owner)} · {invite.memberCount} {t(invite.memberCount === 1 ? 'member' : 'members')}
                                        {invite.workingCount > 0 && ` · ${invite.workingCount} ${t('workingNow')}`}
                                    </span>
                                </div>
                                <div className={styles.actions}>
                                    <button className={styles.acceptBtn} disabled={busyId === invite.id} onClick={() => handleJoin(invite.id)}>
                                        {t('join')}
                                    </button>
                                    <button className={styles.quietBtn} disabled={busyId === invite.id} onClick={() => handleDecline(invite)}>
                                        {t('decline')}
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <section className={styles.card}>
                <h2 className={styles.cardTitle}>{t('openSessions')}</h2>
                {open.length === 0
                    ? <p className={styles.emptyLine}>{t('noOpenSessions')}</p>
                    : <ul className={styles.list}>{open.map(s => <SessionRow key={s.id} session={s} t={t} />)}</ul>}
            </section>

            <section className={`${styles.card} ${wantsNew ? styles.highlight : ''}`}>
                <h2 className={styles.cardTitle}>{t('startSharedSession')}</h2>
                <QuickStart onStarted={(session) => navigate(`/together/${session.id}`)} />
            </section>

            {past.length > 0 && (
                <section className={styles.card}>
                    <h2 className={styles.cardTitle}>{t('pastSessions')}</h2>
                    <ul className={styles.list}>{past.map(s => <SessionRow key={s.id} session={s} t={t} />)}</ul>
                </section>
            )}
        </div>
    );
}
