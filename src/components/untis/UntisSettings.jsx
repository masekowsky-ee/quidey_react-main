// Settings → Planen → Stundenplan (Untis): connect the WebUntis timetable (features/untis/untis.js).
// Two ways: sign in (find the school, or type server + school; user name + password, which the
// server keeps encrypted) or paste the timetable's iCal link. Connected: what, when last fetched,
// "Jetzt aktualisieren", "Im Kalender zeigen", "Trennen" (deletes the login and every lesson).

import { useEffect, useState } from 'react';
import {
    useUntisStatus, rememberUntisStatus, searchUntisSchools, connectUntis, disconnectUntis, syncUntis,
    useShowLessons, setShowLessons, setHomeworkToTasks,
} from '../../features/untis/untis';
import { fill } from '../../features/helperFunction';
import { useTranslation } from '../../i18n/useTranslation';
import PasswordInput from '../PasswordInput.jsx';
import Icon from '../icons.jsx';
import { Bone } from '../skeleton/Skeleton.jsx';
import styles from './UntisSettings.module.css';

const ERRORS = {
    UNTIS_LOGIN_FAILED: 'untisErrorLogin', UNTIS_NOT_ALLOWED: 'untisErrorNotAllowed', UNTIS_UNREACHABLE: 'untisErrorUnreachable',
    UNTIS_TIMEOUT: 'untisErrorUnreachable', UNTIS_UNAVAILABLE: 'untisNotSetUp', INVALID_INPUT: 'untisErrorInput',
};

function SchoolSearch({ picked, onPick }) {
    const { t } = useTranslation();
    const [query, setQuery] = useState('');
    const [found, setFound] = useState([]);
    useEffect(() => {
        const q = query.trim();
        if (q.length < 3) return undefined;
        const id = setTimeout(() => searchUntisSchools(q).then(list => setFound(Array.isArray(list) ? list : [])).catch(() => setFound([])), 400);
        return () => clearTimeout(id);
    }, [query]);
    // fewer than three letters: nothing listed (the last search's results wait for the next)
    const shown = query.trim().length >= 3 ? found : [];
    if (picked) {
        return (
            <div className={styles.picked}>
                <Icon name="book" size={16} />
                <span>{picked.label}</span>
                <button type="button" className={styles.link} onClick={() => onPick(null)}>{t('untisChangeSchool')}</button>
            </div>
        );
    }
    return (
        <div className={styles.search}>
            <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('untisSchoolPlaceholder')} aria-label={t('untisSchoolSearch')} />
            {shown.length > 0 &&
                <ul className={styles.results}>
                    {shown.map(school =>
                        <li key={`${school.server}/${school.school}`}>
                            <button type="button" onClick={() => onPick(school)}>
                                <span>{school.label}</span>
                                {school.address && <span className={styles.muted}>{school.address}</span>}
                            </button>
                        </li>)}
                </ul>}
        </div>
    );
}

export default function UntisSettings() {
    const { t, language } = useTranslation();
    const status = useUntisStatus();
    const show = useShowLessons();
    const [mode, setMode] = useState('login');
    const [school, setSchool] = useState(null);
    const [byHand, setByHand] = useState(false);
    const [server, setServer] = useState('');
    const [schoolName, setSchoolName] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [url, setUrl] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [askDisconnect, setAskDisconnect] = useState(false);

    if (!status) return <Bone h="6rem" />;
    if (!status.available && !status.connected) return <p className={styles.muted}>{t('untisNotSetUp')}</p>;

    const run = async (job) => {
        setBusy(true);
        setError(null);
        try {
            await job();
        } catch (err) {
            setError(t(ERRORS[err.code] ?? 'untisErrorFailed'));
        } finally {
            setBusy(false);
        }
    };

    if (status.connected) {
        const when = status.lastSyncAt
            ? new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(status.lastSyncAt))
            : null;
        return (
            <div className={styles.box}>
                <p className={styles.connected}>
                    <Icon name="check" size={16} />
                    <span>{status.mode === 'login'
                        ? fill(t('untisConnectedLogin'), { school: status.schoolLabel, user: status.username })
                        : fill(t('untisConnectedIcal'), { school: status.schoolLabel })}</span>
                </p>
                <p className={styles.muted}>
                    {status.lastError ? t(ERRORS[status.lastError] ?? 'untisErrorFailed') : when ? fill(t('untisLastSync'), { when }) : t('untisNotSyncedYet')}
                </p>
                <label className={styles.switch}>
                    <input type="checkbox" checked={show} onChange={e => setShowLessons(e.target.checked)} />
                    <span>{t('untisShowInCalendar')}</span>
                </label>
                {/* homework put in Untis becomes a task (day, the lesson's time, the text); only with a login */}
                {status.mode === 'login' &&
                    <label className={styles.switch}>
                        <input type="checkbox" checked={status.homeworkToTasks !== false} disabled={busy}
                            onChange={e => run(async () => rememberUntisStatus(await setHomeworkToTasks(e.target.checked)))} />
                        <span>{t('untisHomeworkToTasks')}</span>
                    </label>}
                {status.mode === 'login' && <p className={styles.muted}>{t('untisHomeworkHint')}</p>}
                {error && <p className={styles.error} role="alert">{error}</p>}
                <div className={styles.actions}>
                    <button type="button" className={styles.button} disabled={busy} onClick={() => run(async () => rememberUntisStatus(await syncUntis()))}>
                        {t('untisSyncNow')}
                    </button>
                    <button type="button" className={styles.danger} disabled={busy}
                        onBlur={() => setAskDisconnect(false)}
                        onClick={() => {
                            if (!askDisconnect) { setAskDisconnect(true); return; }
                            run(async () => { await disconnectUntis(); rememberUntisStatus({ available: status.available, connected: false }); setAskDisconnect(false); });
                        }}>
                        {askDisconnect ? t('untisDisconnectSure') : t('untisDisconnect')}
                    </button>
                </div>
            </div>
        );
    }

    const target = byHand ? { server: server.trim(), school: schoolName.trim(), label: schoolName.trim() } : school;
    const canLogin = target?.server && target?.school && username.trim() && password;
    const connect = () => run(async () => {
        const body = mode === 'login'
            ? { mode: 'login', server: target.server, school: target.school, schoolLabel: target.label, username: username.trim(), password }
            : { mode: 'ical', url: url.trim() };
        const next = await connectUntis(body);
        setPassword('');
        rememberUntisStatus(next);
    });

    return (
        <div className={styles.box}>
            <div className={styles.tabs} role="tablist" aria-label={t('untisHow')}>
                {['login', 'ical'].map(kind =>
                    <button key={kind} type="button" role="tab" aria-selected={mode === kind} onClick={() => { setMode(kind); setError(null); }}>
                        {t(kind === 'login' ? 'untisWithLogin' : 'untisWithIcal')}
                    </button>)}
            </div>
            {mode === 'login'
                ? <>
                    {byHand
                        ? <div className={styles.fields}>
                            <input value={server} onChange={e => setServer(e.target.value)} placeholder="xyz.webuntis.com" aria-label={t('untisServer')} />
                            <input value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder={t('untisSchoolNamePlaceholder')} aria-label={t('untisSchoolName')} />
                        </div>
                        : <SchoolSearch picked={school} onPick={setSchool} />}
                    <button type="button" className={styles.link} onClick={() => setByHand(!byHand)}>{t(byHand ? 'untisSearchSchool' : 'untisSchoolByHand')}</button>
                    <div className={styles.fields}>
                        <input value={username} onChange={e => setUsername(e.target.value)} autoComplete="off" aria-label={t('untisUser')} placeholder={t('untisUser')} />
                        <PasswordInput value={password} onChange={e => setPassword(e.target.value)} autoComplete="off" aria-label={t('untisPassword')} placeholder={t('untisPassword')} />
                    </div>
                    <p className={styles.muted}>{t('untisLoginHint')}</p>
                </>
                : <>
                    <input className={styles.url} type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://….webuntis.com/…" aria-label={t('untisIcalLabel')} />
                    <p className={styles.muted}>{t('untisIcalHint')}</p>
                </>}
            {error && <p className={styles.error} role="alert">{error}</p>}
            <div className={styles.actions}>
                <button type="button" className={styles.primary} disabled={busy || (mode === 'login' ? !canLogin : !url.trim())} onClick={connect}>
                    {busy ? t('untisConnecting') : t('untisConnect')}
                </button>
            </div>
        </div>
    );
}
