import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { fetchStudySettings, saveStudySettings, selectStudySettings } from '../../features/study/study';
import styles from './Study.module.css';

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
const SESSION_RANGE = [15, 180];
const DAILY_RANGE = [15, 720];

let nextKey = 0;
const withKeys = (windows) => windows.map(w => ({ ...w, key: ++nextKey }));
const inRange = (text, [min, max]) => /^\d+$/.test(text) && Number(text) >= min && Number(text) <= max;

function Form({ settings }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [windows, setWindows] = useState(() => withKeys(settings.windows));
    const [sessionMinutes, setSessionMinutes] = useState(String(settings.sessionMinutes));
    const [dailyMaxMinutes, setDailyMaxMinutes] = useState(String(settings.dailyMaxMinutes));
    const [aiAuto, setAiAuto] = useState(settings.aiAuto);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [saved, setSaved] = useState(false);

    const touch = (change) => { setSaved(false); setError(null); change(); };
    const add = (weekday) => touch(() => setWindows(list => [...list, { key: ++nextKey, weekday, start: '16:00', end: '18:00' }]));
    const remove = (key) => touch(() => setWindows(list => list.filter(w => w.key !== key)));
    const edit = (key, field, value) => touch(() => setWindows(list => list.map(w => (w.key === key ? { ...w, [field]: value } : w))));

    const save = async () => {
        if (!inRange(sessionMinutes, SESSION_RANGE) || !inRange(dailyMaxMinutes, DAILY_RANGE)) {
            setError('studyError_invalid_input');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await dispatch(saveStudySettings({
                windows: [...windows].sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start))
                    .map(({ weekday, start, end }) => ({ weekday, start, end })),
                sessionMinutes: Number(sessionMinutes),
                dailyMaxMinutes: Number(dailyMaxMinutes),
                aiAuto,
            }));
            setSaved(true);
        } catch (err) {
            setError(['invalid_window', 'invalid_input'].includes(err.code) ? `studyError_${err.code}` : 'studyError_default');
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <div className={styles.days}>
                {WEEKDAYS.map(weekday => {
                    const day = t('weekDays', weekday - 1);
                    const mine = windows.filter(w => w.weekday === weekday);
                    return (
                        <div key={weekday} className={styles.day} role="group" aria-label={day}>
                            <span className={styles.dayName} aria-hidden="true">{day}</span>
                            <div className={styles.windows}>
                                {mine.length === 0 && <span className={styles.none}>{t('studyWindowNone')}</span>}
                                {mine.map(w => (
                                    <div key={w.key} className={styles.window}>
                                        <input type="time" className={styles.time} value={w.start} aria-label={`${day} ${t('studyWindowStart')}`}
                                            onChange={(e) => edit(w.key, 'start', e.target.value)} />
                                        <input type="time" className={styles.time} value={w.end} aria-label={`${day} ${t('studyWindowEnd')}`}
                                            onChange={(e) => edit(w.key, 'end', e.target.value)} />
                                        <button type="button" className={styles.small} aria-label={`${t('studyWindowRemove')} (${day})`}
                                            onClick={() => remove(w.key)}>×</button>
                                    </div>
                                ))}
                                <div>
                                    <button type="button" className={styles.small} aria-label={`${t('studyWindowAdd')} (${day})`}
                                        onClick={() => add(weekday)}>+ {t('studyWindowAdd')}</button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <Row title={t('studySessionMinutes')} hint={t('studySessionMinutesHint')}>
                <NumberField label={t('studySessionMinutes')} value={sessionMinutes} range={SESSION_RANGE}
                    onChange={(v) => touch(() => setSessionMinutes(v))} />
            </Row>
            <Row title={t('studyDailyMax')} hint={t('studyDailyMaxHint')}>
                <NumberField label={t('studyDailyMax')} value={dailyMaxMinutes} range={DAILY_RANGE}
                    onChange={(v) => touch(() => setDailyMaxMinutes(v))} />
            </Row>
            {settings.aiAvailable && (
                <Row title={t('studyAiAuto')} hint={t('studyAiAutoHint')}>
                    <input type="checkbox" role="switch" checked={aiAuto} aria-label={t('studyAiAuto')}
                        onChange={(e) => touch(() => setAiAuto(e.target.checked))} />
                </Row>
            )}

            <div className={styles.footer}>
                <button type="button" disabled={busy} onClick={save}>{t('studySave')}</button>
                {saved && <span className={styles.saved} role="status">{t('studySaved')}</span>}
                {error && <p className={styles.error} role="alert">{t(error)}</p>}
            </div>
        </>
    );
}

// the rows of Settings (label and hint left, control right)
function Row({ title, hint, children }) {
    return (
        <div className={styles.rowWrap}>
            <div className={styles.rowText}>
                <span className={styles.rowLabel}>{title}</span>
                {hint && <span className={styles.rowHint}>{hint}</span>}
            </div>
            {children}
        </div>
    );
}

function NumberField({ label, value, range, onChange }) {
    const { t } = useTranslation();
    return (
        <span className={styles.field}>
            <input type="number" inputMode="numeric" className={styles.number} min={range[0]} max={range[1]} step="5"
                value={value} aria-label={label} onChange={(e) => onChange(e.target.value)} />
            <span className={styles.unit}>{t('studyMinutes')}</span>
        </span>
    );
}

// Settings → Lernen (testers): study times per weekday, session length, daily maximum, AI switch;
// one "Speichern" saves everything (PUT /api/tester/study/settings).
export default function StudySettings() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const settings = useSelector(selectStudySettings);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        dispatch(fetchStudySettings()).catch(() => setFailed(true));
    }, [dispatch]);

    if (!settings) return failed ? <p className={styles.error} role="alert">{t('studyLoadFailed')}</p> : null;
    return <Form settings={settings} />;
}
