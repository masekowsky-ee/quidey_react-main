import styles from './Together.module.css';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../i18n/useTranslation';
import { displayName } from '../features/helperFunction';
import { fetchSharedSessions, joinSharedSession, removeSharedMember } from '../features/together/togetherAction';
import { selectWork } from '../features/together/work';
import { useSharedSession, useTogetherRun } from '../features/together/hooks';
import { SessionTitle } from './SharedSession';
import HomeLayoutSwitch from './together/HomeLayoutSwitch';
import QuickStart from './together/QuickStart';
import WorkPanel from './together/WorkPanel';
import SharedTaskList from './together/SharedTaskList';
import TeamPresence from './together/TeamPresence';
import ActivityFeed from './together/ActivityFeed';
import WorkSummary from './together/WorkSummary';
import ShareMyTasks from './together/ShareMyTasks';

const LIST_REFRESH_MS = 30 * 1000;
const STORAGE_KEY = 'teamSessionId';

function readStoredSessionId() {
    try { return Number(localStorage.getItem(STORAGE_KEY)) || null; } catch { return null; }
}

// Home page in the team layout: one shared session as a workspace. Session tasks on the left,
// my focus in the middle (clock, my own tasks to share, the summary), the team and chat on the right.
// Tabs switch between my running sessions; the last one is remembered.
export default function TeamHome() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const run = useTogetherRun();
    const { sessions, invites } = useSelector(state => state.together);
    const work = useSelector(selectWork);
    const [searchParams, setSearchParams] = useSearchParams();

    const [loaded, setLoaded] = useState(false);
    const [chosenId, setChosenId] = useState(readStoredSessionId);
    const creating = searchParams.get('new') === '1';
    const setCreating = (on) => setSearchParams(on ? { new: '1' } : {}, { replace: true });

    useEffect(() => {
        const load = () => dispatch(fetchSharedSessions()).catch(() => {}).finally(() => setLoaded(true));
        load();
        const interval = setInterval(load, LIST_REFRESH_MS);
        return () => clearInterval(interval);
    }, [dispatch]);

    const open = sessions.filter(s => !s.endedAt);
    // the one I picked, else the one I'm working in, else the newest
    const selectedId = open.some(s => s.id === chosenId)
        ? chosenId
        : (open.find(s => s.id === work.sessionId) ?? open[0])?.id ?? null;

    const choose = (id) => {
        setChosenId(id);
        try { localStorage.setItem(STORAGE_KEY, String(id)); } catch { /* not remembered */ }
        if (creating) setCreating(false);
    };

    const showStart = loaded && (creating || open.length === 0);
    const { session, missing } = useSharedSession(showStart ? null : selectedId);

    // removed from the selected session meanwhile: the list knows which ones are left
    useEffect(() => {
        if (missing) dispatch(fetchSharedSessions()).catch(() => {});
    }, [missing, dispatch]);

    const join = async (id) => {
        if (await run(joinSharedSession(id), 'toast_joined')) {
            await dispatch(fetchSharedSessions()).catch(() => {});
            choose(id);
        }
    };

    return (
        <div className={styles.teamPage}>
            <div className={styles.teamBar}>
                <HomeLayoutSwitch />
                <nav className={styles.sessionTabs} aria-label={t('openSessions')}>
                    {open.map(s => (
                        <button
                            key={s.id}
                            className={!showStart && s.id === selectedId ? styles.sessionTabOn : styles.sessionTab}
                            aria-current={!showStart && s.id === selectedId ? 'page' : undefined}
                            onClick={() => choose(s.id)}
                        >
                            {work.sessionId === s.id
                                ? <span className={styles.playIcon} aria-label={t('workingOnIt')}>▶</span>
                                : s.workingCount > 0 && <span className={styles.liveDot} aria-hidden="true" />}
                            {s.name}
                        </button>
                    ))}
                    <button className={showStart ? styles.sessionTabOn : styles.sessionTab} onClick={() => setCreating(true)}>
                        + {t('newSession')}
                    </button>
                </nav>
            </div>

            {invites.length > 0 && (
                <ul className={styles.inviteBanner}>
                    {invites.map(invite => (
                        <li key={invite.id}>
                            <span>
                                <strong>{displayName(invite.invitedBy ?? invite.owner)}</strong> {t('invitesYouTo')} <strong>{invite.name}</strong>
                            </span>
                            <span className={styles.actions}>
                                <button className={styles.acceptBtn} onClick={() => join(invite.id)}>{t('join')}</button>
                                <button className={styles.quietBtn} onClick={() => run(removeSharedMember(invite.id, 'me', 'me'))}>{t('decline')}</button>
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            {!loaded ? <div aria-busy="true" /> : showStart ? (
                <section className={`${styles.card} ${styles.onboarding}`}>
                    <h1 className={styles.onboardingTitle}>{t(open.length ? 'startSharedSession' : 'teamWelcome')}</h1>
                    {open.length === 0 && <p className={styles.intro}>{t('teamWelcomeText')}</p>}
                    <QuickStart onStarted={(created) => choose(created.id)} onCancel={open.length ? () => setCreating(false) : undefined} />
                </section>
            ) : session ? (
                <div className={styles.teamGrid}>
                    <div className={styles.teamColTasks}>
                        <SharedTaskList session={session} showShareSelect={false} />
                    </div>
                    <div className={styles.teamColFocus}>
                        <div className={styles.teamSessionHead}>
                            <SessionTitle session={session} className={styles.teamSessionTitle} />
                            <Link to={`/together/${session.id}`} className={styles.quietLink}>{t('sessionDetails')} →</Link>
                        </div>
                        <WorkPanel session={session} large />
                        <ShareMyTasks session={session} />
                        <WorkSummary session={session} />
                    </div>
                    <div className={styles.teamColTeam}>
                        <TeamPresence session={session} />
                        <ActivityFeed session={session} tall />
                    </div>
                </div>
            ) : <div aria-busy="true" />}
        </div>
    );
}
