import styles from '../Header.module.css';
import { COMMUNITY_PATHS, friendsPath } from '../../features/community/paths';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { displayName, formatDuration } from '../../features/helperFunction';
import { selectIncomingCount } from '../../features/friends/friendsAction';
import {
    fetchSharedSessions, joinSharedSession, removeSharedMember, selectInviteCount,
} from '../../features/together/togetherAction';
import { useTogetherRun } from '../../features/together/hooks';

import Icon from '../icons';
// Header button with everything collaborative one click away: invites, running sessions,
// starting a new one, friend requests. The badge counts what is waiting for me.
export default function TeamQuickPanel() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const run = useTogetherRun();
    const { sessions, invites } = useSelector(state => state.together);
    const inviteCount = useSelector(selectInviteCount);
    const requestCount = useSelector(selectIncomingCount);
    const homeLayout = useSelector(state => state.settings.homeLayout);
    const [open, setOpen] = useState(false);
    const panelRef = useRef(null);

    const waiting = inviteCount + requestCount;
    const running = sessions.filter(s => !s.endedAt);

    // fresh numbers when opened; closes on Escape and on clicks outside
    useEffect(() => {
        if (!open) return;
        dispatch(fetchSharedSessions()).catch(() => {});
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        const onClick = (e) => { if (!panelRef.current?.contains(e.target)) setOpen(false); };
        window.addEventListener('keydown', onKey);
        window.addEventListener('pointerdown', onClick);
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('pointerdown', onClick);
        };
    }, [open, dispatch]);

    const go = (path) => { setOpen(false); navigate(path); };
    const sessionPath = (id) => `/together/${id}`;

    const join = async (id) => {
        if (await run(joinSharedSession(id), 'toast_joined')) go(sessionPath(id));
    };

    return (
        <div className={styles.quickWrap} ref={panelRef}>
            <button
                className={styles.btn}
                onClick={() => setOpen(v => !v)}
                aria-expanded={open}
                aria-haspopup="dialog"
                aria-label={waiting > 0 ? `${t('together')} (${waiting})` : t('together')}
                title={t('together')}
            >
                <svg className={styles.svg} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M40-272q0-34 17.5-62.5T104-378q62-31 126-46.5T360-440q66 0 130 15.5T616-378q29 15 46.5 43.5T680-272v32q0 33-23.5 56.5T600-160H120q-33 0-56.5-23.5T40-240v-32Zm698 112q11-18 16.5-38.5T760-240v-40q0-44-24.5-84.5T666-434q51 6 96 20.5t84 35.5q36 20 55 44.5t19 53.5v40q0 33-23.5 56.5T840-160H738ZM360-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm400-160q0 66-47 113t-113 47q-11 0-28-2.5t-28-5.5q27-32 41.5-71t14.5-81q0-42-14.5-81T544-792q14-5 28-6.5t28-1.5q66 0 113 47t47 113ZM120-240h480v-32q0-11-5.5-20T580-306q-54-27-109-40.5T360-360q-56 0-111 13.5T140-306q-9 5-14.5 14t-5.5 20v32Zm240-320q33 0 56.5-23.5T440-640q0-33-23.5-56.5T360-720q-33 0-56.5 23.5T280-640q0 33 23.5 56.5T360-560Zm0 320Zm0-400Z"/></svg>
                {waiting > 0 && <span className={styles.quickBadge}>{waiting}</span>}
            </button>
            {open && (
                <div className={styles.quickPanel} role="dialog" aria-label={t('together')}>
                    {invites.length > 0 && (
                        <div className={styles.quickSection}>
                            <h3 className={styles.quickTitle}>{t('sessionInvites')}</h3>
                            <ul className={styles.quickList}>
                                {invites.map(invite => (
                                    <li key={invite.id} className={styles.quickRow}>
                                        <div className={styles.quickWho}>
                                            <span className={styles.quickName}>{invite.name}</span>
                                            <span className={styles.quickMeta}>{t('invitedBy')} {displayName(invite.invitedBy ?? invite.owner)}</span>
                                        </div>
                                        <button className={styles.quickPrimary} onClick={() => join(invite.id)}>{t('join')}</button>
                                        <button className={styles.quickQuiet} onClick={() => run(removeSharedMember(invite.id, 'me', 'me'))} aria-label={`${t('decline')}: ${invite.name}`} title={t('decline')}><Icon name="close" size={16} /></button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <div className={styles.quickSection}>
                        <h3 className={styles.quickTitle}>{t('openSessions')}</h3>
                        {running.length === 0 ? <p className={styles.quickMeta}>{t('noOpenSessions')}</p> : (
                            <ul className={styles.quickList}>
                                {running.map(s => (
                                    <li key={s.id}>
                                        <button className={styles.quickRowBtn} onClick={() => go(sessionPath(s.id))}>
                                            <div className={styles.quickWho}>
                                                <span className={styles.quickName}>{s.name}</span>
                                                <span className={styles.quickMeta}>
                                                    {s.workingCount > 0
                                                        ? <><span className={styles.quickLive} />{s.workingCount} {t('workingNow')}</>
                                                        : `${s.memberCount} ${t(s.memberCount === 1 ? 'member' : 'members')}`}
                                                </span>
                                            </div>
                                            <span className={styles.quickMeta}>{formatDuration(s.myMs)}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div className={styles.quickActions}>
                        <button className={styles.quickPrimary} onClick={() => go(homeLayout === 'team' ? '/?new=1' : `${COMMUNITY_PATHS.sessions}?new=1`)}>+ {t('newSession')}</button>
                        <Link to={COMMUNITY_PATHS.sessions} className={styles.quickLink} onClick={() => setOpen(false)}>{t('allSessions')}</Link>
                        <Link to={friendsPath(requestCount > 0 ? 'requests' : null)} className={styles.quickLink} onClick={() => setOpen(false)}>
                            {t('friends')}{requestCount > 0 && <span className={styles.quickBadgeInline}>{requestCount}</span>}
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
