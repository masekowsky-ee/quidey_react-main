import styles from './Together.module.css';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useTranslation } from '../i18n/useTranslation';
import { formatDate, displayName } from '../features/helperFunction';
import {
    endSharedSession, deleteSharedSession, removeSharedMember, renameSharedSession,
} from '../features/together/togetherAction';
import { stopWork } from '../features/together/work';
import { useSharedSession, useTogetherRun } from '../features/together/hooks';
import WorkPanel from './together/WorkPanel';
import SharedTaskList from './together/SharedTaskList';
import TeamPresence from './together/TeamPresence';
import ActivityFeed from './together/ActivityFeed';
import WorkSummary from './together/WorkSummary';
import { calendarLink } from '../features/calendar/sources';

import Icon from './icons';
// Title of a session; the owner can click it to rename the session
export function SessionTitle({ session, className }) {
    const { t } = useTranslation();
    const run = useTogetherRun();
    const [editing, setEditing] = useState(false);
    const canRename = session.isOwner && !session.endedAt;

    const save = (e) => {
        const name = e.target.value.trim();
        setEditing(false);
        if (name && name !== session.name) run(renameSharedSession(session.id, name));
    };

    if (editing) {
        return (
            <input
                className={styles.titleInput}
                defaultValue={session.name}
                maxLength={100}
                autoFocus
                aria-label={t('sessionName')}
                onBlur={save}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') setEditing(false);
                }}
            />
        );
    }
    return canRename
        ? (
            <h1 className={className}>
                <button className={styles.renamable} title={t('rename')} onClick={() => setEditing(true)}>
                    {session.name} <span className={styles.editHint} aria-hidden="true"><Icon name="edit" size={18} /></span>
                </button>
            </h1>
        )
        : <h1 className={className}>{session.name}</h1>;
}

// End / delete (owner) or leave (member), each with a confirmation step
export function SessionActions({ session, onGone }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const run = useTogetherRun();
    const [confirm, setConfirm] = useState(null); // 'end' | 'delete' | 'leave'
    const isOpen = !session.endedAt;

    const handleConfirmed = async () => {
        const action = confirm;
        setConfirm(null);
        await dispatch(stopWork());
        if (action === 'end') {
            run(endSharedSession(session.id), 'toast_sessionEnded');
        } else if (action === 'delete') {
            if (await run(deleteSharedSession(session.id), 'toast_sessionDeleted')) onGone?.();
        } else if (action === 'leave') {
            if (await run(removeSharedMember(session.id, session.me, session.me), 'toast_sessionLeft')) onGone?.();
        }
    };

    return (
        <div className={styles.footerActions}>
            {confirm ? (
                <>
                    <span className={styles.confirmText}>{t({ end: 'confirmEndSession', delete: 'confirmDeleteSession', leave: 'confirmLeaveSession' }[confirm])}</span>
                    <button className={styles.dangerBtn} onClick={handleConfirmed}>
                        {t({ end: 'endSession', delete: 'deleteSession', leave: 'leaveSession' }[confirm])}
                    </button>
                    <button onClick={() => setConfirm(null)}>{t('cancel')}</button>
                </>
            ) : session.isOwner ? (
                <>
                    {isOpen && <button className={styles.secondaryBtn} onClick={() => setConfirm('end')}>{t('endSession')}</button>}
                    <button className={styles.quietDangerBtn} onClick={() => setConfirm('delete')}>{t('deleteSession')}</button>
                </>
            ) : (
                <button className={styles.quietDangerBtn} onClick={() => setConfirm('leave')}>{t('leaveSession')}</button>
            )}
        </div>
    );
}

export default function SharedSession() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const id = Number(useParams().id);
    const { session, missing } = useSharedSession(id);

    if (missing) {
        return (
            <div className={styles.page}>
                <h1 className={styles.title}>{t('together')}</h1>
                <section className={`${styles.card} ${styles.empty}`}>
                    <p>{t('sessionNotFound')}</p>
                    <Link to="/together" className={styles.primaryBtn}>{t('backToTogether')}</Link>
                </section>
            </div>
        );
    }
    if (!session) return <div className={styles.page} aria-busy="true" />;

    return (
        <div className={styles.pageWide}>
            <Link to="/together" className={styles.back}>← {t('together')}</Link>
            <div className={styles.titleRow}>
                <div className={styles.titleBlock}>
                    <SessionTitle session={session} className={styles.title} />
                    <p className={styles.meta}>
                        {t('startedBy')} {displayName(session.owner)} · {formatDate(session.createdAt)}
                        {session.endedAt && ` · ${t('endedOn')} ${formatDate(session.endedAt)}`}
                        {' · '}<Link to={calendarLink('session', session.id)}>{t('calendarOpenCalendar')}</Link>
                    </p>
                </div>
                {session.endedAt && <span className={styles.endedBadge}>{t('ended')}</span>}
            </div>

            <div className={styles.roomGrid}>
                <div className={styles.roomMain}>
                    <WorkPanel session={session} />
                    <SharedTaskList session={session} />
                    <WorkSummary session={session} />
                </div>
                <div className={styles.roomSide}>
                    <TeamPresence session={session} />
                    <ActivityFeed session={session} />
                </div>
            </div>

            <SessionActions session={session} onGone={() => navigate('/together')} />
        </div>
    );
}
