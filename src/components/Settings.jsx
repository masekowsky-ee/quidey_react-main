import styles from './Settings.module.css';
import { useEffect, useRef, useState } from 'react';
import {useTranslation} from '../i18n/useTranslation'
import {useSelector, useDispatch} from 'react-redux';
import {setLanguage, setTheme, setAccent, setPalette, setDefaultSessionMinutes, setMotion, setSound, setShowSharedTasks, setShowTutorial} from '../features/settings/settingsAction';
import {MOTION_LEVELS} from '../features/settings/motion';
import {SOUND_LEVELS, SOUND_NAMES, playSound} from '../features/settings/sound';
import {setSessionParams} from '../features/session/sessionAction';
import {SESSION_LENGTHS, PALETTES, COLOR_SCHEMES, ACCENT_SWATCHES as ACCENT_OPTIONS} from '../features/settings/preferences';
import { DEFAULT_UI_VARIANT, OWN_COLORS, VARIANT_COLORS, setUiColors, useColorChoice } from '../features/tester/variants';
import HomeLayoutSwitch from './together/HomeLayoutSwitch';
import {useInstallState, promptInstall} from '../features/pwa/install';
import { PUSH_KINDS, disablePush, enablePush, refreshPush, sendTestPush, setPushKind, usePushState } from '../features/pwa/push';
import { fill, formatDate } from '../features/helperFunction';
import { selectUsageConsent, setUsageConsent } from '../features/auth/authAction';
import { showToast } from '../features/toast/toast';
import { saveAllDayTime, selectAllDayTime } from '../features/tasks/reminders';
import EventTypeSettings from './EventTypeSettings.jsx';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useHashTarget } from '../features/layout/hashTarget';
import UntisSettings from './untis/UntisSettings.jsx';
import MicrophoneSettings from './voice/MicrophoneSettings.jsx';
import { isNativeApp } from '../features/native/native';
import { APK_URL, apkOffer, formatSize } from '../features/native/androidApk';
import { setAnalyticsConsent, useAnalytics } from '../features/native/analytics';
import AlarmSettings from './reminders/AlarmSettings.jsx';
import StudySettings from './study/StudySettings.jsx';
import { resetTips } from '../features/tips/tips';
import { useMotionLevel } from '../features/settings/motion';

const LANGUAGES = [
    { code: 'de', label: 'german' },
    { code: 'en', label: 'english' },
];

const THEME_OPTIONS = [
    { value: 'dark', label: 'themeDark' },
    { value: 'light', label: 'themeLight' },
    { value: 'system', label: 'themeSystem' },
];

// The settings are one long page: every section under the other, with a list of them always in
// sight (a column beside the page; on a phone a row of chips under the header) that jumps to a
// section and shows the one being read. A section's id in the address (#event-types from the
// editor, #appearance from the command bar) scrolls to it. The old areas' names (#plan, #app)
// lead to the first section of what they held.
const GROUPS = [
    { key: 'look', sections: [['language', 'settingsLanguageTitle'], ['appearance', 'appearance']] },
    { key: 'plan', sections: [['start', 'settingsStartTitle'], ['timer', 'sessionSettings'], ['event-types', 'eventTypes'], ['untis', 'untisSettingsTitle'], ['study', 'studySettingsTitle']] },
    { key: 'app', sections: [['notifications', 'pushTitle'], ['microphone', 'micTitle'], ['tour', 'tutorial'], ['alarms', 'reminderAlarmSetting'], ['privacy', 'privacySetting'], ['analytics', 'analyticsSetting'], ['android', 'androidApp'], ['install', 'installApp']] },
];
const LEGACY_AREAS = { look: 'language', plan: 'start', app: 'notifications' };

// The list of sections: grouped under the old areas' names on a wide screen, one row on a phone.
function SettingsNav({ groups, current, onPick }) {
    const { t } = useTranslation();
    const nav = useRef(null);
    // on a phone the row follows the section being read
    useEffect(() => {
        const row = nav.current;
        const button = row?.querySelector(`[data-section="${current}"]`);
        if (!row || !button || row.scrollWidth <= row.clientWidth) return;
        row.scrollTo?.({ left: button.offsetLeft - 16, behavior: 'smooth' });
    }, [current]);
    return (
        <nav ref={nav} className={styles.nav} aria-label={t('settings')}>
            {groups.map(group => (
                <div key={group.key} className={styles.navGroup}>
                    <span className={styles.navGroupName}>{t(`settingsArea_${group.key}`)}</span>
                    {group.sections.map(([id, label]) => (
                        <button key={id} type="button" data-section={id} className={styles.navLink}
                            aria-current={current === id ? 'location' : undefined} onClick={() => onPick(id)}>
                            {t(label)}
                        </button>
                    ))}
                </div>
            ))}
        </nav>
    );
}

// A segmented control of options: [{ value, label }], the current value, and what a click does
function Choice({ label, options, value, onChange, disabled = false }) {
    const { t } = useTranslation();
    return (
        <div className={styles.segmented} role="group" aria-label={label}>
            {options.map(option => (
                <button key={String(option.value)} type="button" disabled={disabled}
                    className={value === option.value ? styles.segmentActive : undefined}
                    aria-pressed={value === option.value}
                    onClick={() => onChange(option.value)}>
                    {option.text ?? t(option.label)}
                </button>
            ))}
        </div>
    );
}

// One setting as a row: its name and what it does on the left, the control on the right
function SettingRow({ title, hint, children }) {
    return (
        <div className={styles.row}>
            <div className={styles.rowText}>
                <span className={styles.rowLabel}>{title}</span>
                {hint && <span className={styles.rowHint}>{hint}</span>}
            </div>
            {children}
        </div>
    );
}

// A group of settings: its title and a sentence on the left, the rows in a panel beside it
function SettingSection({ title, description, children, id }) {
    return (
        <section className={styles.section} id={id} aria-labelledby={`${id}-title`}>
            <div className={styles.sectionText}>
                <h2 id={`${id}-title`} className={styles.sectionTitle}>{title}</h2>
                {description && <p className={styles.sectionHint}>{description}</p>}
            </div>
            <div className={styles.sectionPanel}>{children}</div>
        </section>
    );
}

const ON_OFF = [{ value: true, label: 'pushOn' }, { value: false, label: 'pushOff' }];
// What the last check of this device saw (push.js `diagnosis`), in this order; the names are
// the browser's own, so a screenshot says exactly where it stops
const DIAGNOSIS_ROWS = [
    ['result', 'Ergebnis / result'], ['checkedAt', 'Geprüft / checked'], ['support', 'Push API'], ['app', 'Als App / standalone'],
    ['stored', "localStorage 'push'"], ['permission', 'Notification.permission'], ['pushPermission', 'pushManager.permissionState'],
    ['subscription', 'Push subscription'], ['worker', 'Service Worker'], ['serverKey', 'Server key (VAPID)'],
];
const diagnosisValue = (value) => (value === null || value === undefined ? '–' : String(value));

const PUSH_HINTS = {
    unknown: 'pushChecking', unsupported: 'pushUnsupported', install: 'pushInstallFirst', denied: 'pushDenied',
    unavailable: 'pushUnavailable', off: 'pushOffHint', on: 'pushOnHint',
};

// Push notifications on this device (features/pwa/push.js): on / off, then which kinds and a
// test. Looked at again whenever this opens, so a permission taken back in the browser shows.
function PushSettings() {
    const { t } = useTranslation();
    const push = usePushState();
    const [tested, setTested] = useState(false);
    useEffect(() => { refreshPush(); }, []);
    const on = push.status === 'on';
    // the study kind belongs to the testers' feature
    const kinds = PUSH_KINDS;

    return (
        <>
            <SettingRow title={t('pushDevice')} hint={t(isNativeApp() && push.status === 'unsupported' ? 'pushUnsupportedApp'
                : isNativeApp() && push.status === 'denied' ? 'pushDeniedApp' : PUSH_HINTS[push.status])}>
                {(on || push.status === 'off') && (
                    <Choice label={t('pushDevice')} value={on} disabled={push.busy} options={ON_OFF}
                        onChange={(next) => {
                            if (next === on) return;
                            setTested(false);
                            if (next) enablePush(); else disablePush();
                        }} />
                )}
            </SettingRow>
            {on && push.kinds && kinds.map(kind => (
                <SettingRow key={kind} title={t(`pushKind_${kind}`)} hint={t(`pushKindHint_${kind}`)}>
                    <Choice label={t(`pushKind_${kind}`)} value={push.kinds[kind] !== false} disabled={push.busy} options={ON_OFF}
                        onChange={(next) => { if (next !== (push.kinds[kind] !== false)) setPushKind(kind, next); }} />
                </SettingRow>
            ))}
            {on && (
                <SettingRow title={t('pushTest')} hint={t(tested ? 'pushTestSent' : 'pushTestHint')}>
                    <button type="button" className={styles.tourButton} onClick={async () => setTested(await sendTestPush())}>
                        {t('pushTestButton')}
                    </button>
                </SettingRow>
            )}
            {push.error &&
                <p className={styles.pushError} role="alert">
                    {t(push.error)}
                    {/* the browser's own words, so a device that can't be signed up says why */}
                    {push.detail && <small className={styles.pushDetail}>{push.detail}</small>}
                </p>}
            {push.diagnosis && (
                <details className={styles.pushDiagnosis}>
                    <summary>{t('pushDiagnosis')}</summary>
                    <p className={styles.rowHint}>{t('pushDiagnosisHint')}</p>
                    <dl>
                        {DIAGNOSIS_ROWS.filter(([key]) => key in push.diagnosis).map(([key, label]) => (
                            <div key={key}>
                                <dt>{label}</dt>
                                <dd>{diagnosisValue(push.diagnosis[key])}</dd>
                            </div>
                        ))}
                    </dl>
                </details>
            )}
        </>
    );
}

// Google Analytics for Firebase in the Android app (features/native/analytics.js): the answer to
// the question at the start, changed here. Only where the app has Firebase.
function AnalyticsSetting() {
    const { t } = useTranslation();
    const { choice } = useAnalytics();
    const on = choice === 'granted';
    return (
        <SettingRow title={t('analyticsRow')} hint={t(on ? 'analyticsRowOn' : 'analyticsRowOff')}>
            <Choice label={t('analyticsRow')} value={on} options={ON_OFF}
                onChange={(next) => { if (next !== on) setAnalyticsConsent(next); }} />
        </SettingRow>
    );
}

// Quidey's own anonymous usage statistics (every platform): my answer and when I gave it.
// A failed save leaves the choice as it was.
function UsageSetting() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { choice, at } = useSelector(selectUsageConsent);
    const on = choice === 'granted';
    const hint = choice === null ? t('usageRowNotAsked')
        : fill(t(on ? 'usageRowGranted' : 'usageRowDenied'), { date: formatDate(at) });
    const change = async (next) => {
        if (next === on) return;
        try {
            await dispatch(setUsageConsent(next));
        } catch {
            dispatch(showToast(t('pushErrorSave'), 'error'));
        }
    };
    return (
        <>
            <SettingRow title={t('usageRow')} hint={hint}>
                <Choice label={t('usageRow')} value={on} options={ON_OFF} onChange={change} />
            </SettingRow>
            <SettingRow title={t('usageRowPolicy')}>
                <Link to="/datenschutz#nutzungsstatistik" className={styles.tourButton}>{t('usageRowPolicy')}</Link>
            </SettingRow>
        </>
    );
}

// When tasks without a time of day remind me (for the account: pushes, mails and the app).
// Saved on every change; put back when that fails.
function AllDayTimeSetting() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const saved = useSelector(selectAllDayTime);
    // what is typed until it's saved (null: the saved time)
    const [draft, setDraft] = useState(null);
    const [failed, setFailed] = useState(false);
    const value = draft ?? saved;

    const change = async (next) => {
        setDraft(next);
        setFailed(false);
        if (!/^\d{2}:\d{2}$/.test(next) || next === saved) return;
        try {
            await dispatch(saveAllDayTime(next));
        } catch {
            setFailed(true);
        }
        setDraft(null);
    };

    return (
        <SettingRow title={t('allDayReminderTime')} hint={t(failed ? 'pushErrorSave' : 'allDayReminderTimeHint')}>
            <input type="time" className={styles.timeInput} value={value} aria-label={t('allDayReminderTime')}
                onChange={(e) => change(e.target.value)} />
        </SettingRow>
    );
}

// The feature tips (components/tips/FeatureTips.jsx): every one once more, from the next page on
function TipsSetting() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const reset = () => dispatch(resetTips())
        .then(() => dispatch(showToast(t('settingsTipsResetDone'))))
        .catch(() => dispatch(showToast(t('settingsTipsResetFailed'), 'error')));
    return (
        <SettingRow title={t('settingsTipsRow')} hint={t('settingsTipsRowHint')}>
            <button type="button" className={styles.tourButton} onClick={reset}>
                {t('settingsTipsReset')}
            </button>
        </SettingRow>
    );
}

export default function Settings(){
    const { t } = useTranslation();
    const language = useSelector((state) => state.settings.language);
    const theme = useSelector((state) => state.settings.theme);
    const homeLayout = useSelector((state) => state.settings.homeLayout);
    // the colours of the interface in use: a tester's variant keeps its own choice (its own
    // colours first), "current" the usual settings
    const { variant, palette, accent } = useColorChoice();
    const inVariant = variant !== DEFAULT_UI_VARIANT;
    const variantName = inVariant ? t(`uiVariant_${variant}`) : '';
    const choosePalette = (value) => dispatch(inVariant ? setUiColors(variant, { palette: value }) : setPalette(value));
    const chooseAccent = (value) => dispatch(inVariant ? setUiColors(variant, { accent: value }) : setAccent(value));
    const paletteOptions = [
        ...(inVariant ? [[OWN_COLORS, VARIANT_COLORS[variant].palette]] : []),
        ...Object.entries(PALETTES),
    ];
    const accentOptions = [
        ...(inVariant ? [{ value: OWN_COLORS, color: VARIANT_COLORS[variant].accent }] : []),
        ...ACCENT_OPTIONS,
    ];
    const motionLevel = useSelector((state) => state.settings.motion);
    const soundLevel = useSelector((state) => state.settings.sound);
    // a new level is heard at once
    const chooseSound = (level) => {
        dispatch(setSound(level));
        playSound('done');
    };
    const defaultSessionMinutes = useSelector((state) => state.settings.defaultSessionMinutes);
    const showSharedTasks = useSelector((state) => state.settings.showSharedTasks);
    const installState = useInstallState();
    // Android in the browser: the app as a file (features/native/androidApk.js)
    const apk = apkOffer();
    // the Android app with Firebase: may it count how it is used
    const analytics = useAnalytics();
    const dispatch = useDispatch();
    const { hash } = useLocation();
    const navigate = useNavigate();
    const smooth = useMotionLevel() !== 'minimal';
    // the old area names lead to the first section of what they held
    const legacy = LEGACY_AREAS[hash.slice(1)];
    useEffect(() => {
        if (legacy) navigate({ hash: `#${legacy}` }, { replace: true });
    }, [legacy, navigate]);
    useHashTarget();

    // the sections there are on this device (some only where they apply)
    const there = { alarms: isNativeApp(), analytics: analytics.available, android: Boolean(apk), install: installState !== 'unavailable' };
    const groups = GROUPS.map(group => ({ ...group, sections: group.sections.filter(([id]) => there[id] ?? true) }));
    const ids = groups.flatMap(group => group.sections.map(([id]) => id));
    const idsKey = ids.join();

    // the section being read: the one at the upper part of the screen
    const [current, setCurrent] = useState(() => LEGACY_AREAS[hash.slice(1)] ?? (ids.includes(hash.slice(1)) ? hash.slice(1) : ids[0]));
    useEffect(() => {
        if (typeof IntersectionObserver === 'undefined') return undefined;
        const inView = new Set();
        const watcher = new IntersectionObserver((entries) => {
            entries.forEach(entry => (entry.isIntersecting ? inView.add(entry.target.id) : inView.delete(entry.target.id)));
            const first = idsKey.split(',').find(id => inView.has(id));
            if (first) setCurrent(first);
        }, { rootMargin: '-15% 0px -70% 0px' });
        idsKey.split(',').forEach(id => { const el = document.getElementById(id); if (el) watcher.observe(el); });
        return () => watcher.disconnect();
    }, [idsKey]);

    const pick = (id) => {
        setCurrent(id);
        document.getElementById(id)?.scrollIntoView?.({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
        try { window.history.replaceState(window.history.state, '', `#${id}`); } catch { /* only the address stays */ }
    };

    // New default length; also applied to the timer right away if it is idle and untouched.
    // Reads the timer at click time (not from the last render) so a running timer is never reset.
    const changeSessionLength = (minutes) => {
        dispatch(setDefaultSessionMinutes(minutes));
        dispatch((innerDispatch, getState) => {
            const { timer, sessionParams } = getState().session;
            const timerUntouched = !timer.active && timer.time === sessionParams.time;
            if (timerUntouched) innerDispatch(setSessionParams({ ...sessionParams, time: minutes * 60 * 1000 }));
        });
    };

    return (
        <div className={styles.page}>
            <header className={styles.head}>
                <h1 className={styles.title}>{t('settings')}</h1>
            </header>

            <div className={styles.layout}>
            <SettingsNav groups={groups} current={current} onPick={pick} />
            <div className={styles.view}>
                <>
                    <SettingSection id="language" title={t('settingsLanguageTitle')} description={t('settingsLanguageHint')}>
                        <SettingRow title={t('language')}>
                            <Choice label={t('language')} value={language} onChange={(code) => dispatch(setLanguage(code))}
                                options={LANGUAGES.map(({ code, label }) => ({ value: code, label }))} />
                        </SettingRow>
                    </SettingSection>

                    <SettingSection id="appearance" title={t('appearance')} description={t('settingsAppearanceHint')}>
                        <SettingRow title={t('settingsThemeRow')}>
                            <Choice label={t('appearance')} value={theme} onChange={(value) => dispatch(setTheme(value))} options={THEME_OPTIONS} />
                        </SettingRow>
                        {!inVariant && <div className={styles.rowStack}>
                            <span className={styles.rowText}>
                                <span className={styles.rowLabel}>{t('schemeSetting')}</span>
                                <span className={styles.rowHint}>{t('schemeSettingHint')}</span>
                            </span>
                            {/* a palette and its accent in one go; each tile shows both halves with the accent on them */}
                            <div className={styles.swatches} role="group" aria-label={t('schemeSetting')}>
                                {COLOR_SCHEMES.map((scheme) => {
                                    const chosen = palette === scheme.palette && accent === scheme.accent;
                                    const { dark, light } = PALETTES[scheme.palette];
                                    const color = ACCENT_OPTIONS.find(option => option.value === scheme.accent)?.color;
                                    return (
                                        <button key={scheme.id} type="button"
                                            className={`${styles.swatch} ${styles.schemeSwatch} ${chosen ? styles.swatchActive : ''}`}
                                            aria-pressed={chosen}
                                            onClick={() => { dispatch(setPalette(scheme.palette)); dispatch(setAccent(scheme.accent)); }}>
                                            <span className={styles.palettePreview} aria-hidden="true">
                                                <span style={{ '--ground': dark[0], '--card': dark[1], '--ink': dark[2], '--dot': color }} />
                                                <span style={{ '--ground': light[0], '--card': light[1], '--ink': light[2], '--dot': scheme.accent === 'pine' ? '#1e6b55' : '#f97316' }} />
                                            </span>
                                            <span className={styles.swatchLabel}>{t(scheme.label)}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>}
                        <div className={styles.rowStack}>
                            <span className={styles.rowText}>
                                <span className={styles.rowLabel}>{t('paletteSetting')}</span>
                                <span className={styles.rowHint}>{inVariant ? fill(t('paletteSettingHintVariant'), { name: variantName }) : t('paletteSettingHint')}</span>
                            </span>
                            {/* each tile: the palette's dark half and its light half, a card on each */}
                            <div className={styles.swatches} role="group" aria-label={t('paletteSetting')}>
                                {paletteOptions.map(([value, { dark, light }]) => (
                                    <button key={value} type="button"
                                        className={`${styles.swatch} ${palette === value ? styles.swatchActive : ''}`}
                                        aria-pressed={palette === value}
                                        onClick={() => choosePalette(value)}>
                                        <span className={styles.palettePreview} aria-hidden="true">
                                            <span style={{ '--ground': dark[0], '--card': dark[1], '--ink': dark[2] }} />
                                            <span style={{ '--ground': light[0], '--card': light[1], '--ink': light[2] }} />
                                        </span>
                                        <span className={styles.swatchLabel}>{value === OWN_COLORS ? variantName : t(`palette_${value}`)}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className={styles.rowStack}>
                            <span className={styles.rowLabel}>{t('accentColor')}</span>
                            <div className={styles.swatches} role="group" aria-label={t('accentColor')}>
                                {accentOptions.map(({ value, label, color }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        className={`${styles.swatch} ${accent === value ? styles.swatchActive : ''}`}
                                        style={{ '--swatch': color }}
                                        aria-pressed={accent === value}
                                        onClick={() => chooseAccent(value)}
                                    >
                                        <span className={styles.swatchDot} aria-hidden="true" />
                                        <span className={styles.swatchLabel}>{value === OWN_COLORS ? variantName : t(label)}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <SettingRow title={t('motionSetting')} hint={t(`motionHint_${motionLevel}`)}>
                            <Choice label={t('motionSetting')} value={motionLevel} onChange={(level) => dispatch(setMotion(level))}
                                options={MOTION_LEVELS.map(level => ({ value: level, label: `motion_${level}` }))} />
                        </SettingRow>
                        <SettingRow title={t('soundSetting')} hint={t(`soundHint_${soundLevel}`)}>
                            <Choice label={t('soundSetting')} value={soundLevel} onChange={chooseSound}
                                options={SOUND_LEVELS.map(level => ({ value: level, label: `sound_${level}` }))} />
                        </SettingRow>
                        {soundLevel !== 'off' && <div className={styles.rowStack}>
                            <span className={styles.rowLabel}>{t('soundPreview')}</span>
                            <div className={styles.soundChips} role="group" aria-label={t('soundPreview')}>
                                {SOUND_NAMES.map(name => (
                                    <button key={name} type="button" className={styles.soundChip} onClick={() => playSound(name)}>
                                        {t(`sound_${name}`)}
                                    </button>
                                ))}
                            </div>
                        </div>}
                    </SettingSection>
                </>

                <>
                    <SettingSection id="start" title={t('settingsStartTitle')} description={t('settingsStartHint')}>
                        <SettingRow title={t('settingsLayoutRow')} hint={t(homeLayout === 'team' ? 'homeTeamHint' : 'homeSoloHint')}>
                            <HomeLayoutSwitch />
                        </SettingRow>
                        <SettingRow title={t('sharedTasksSetting')} hint={t('sharedTasksSettingHint')}>
                            <Choice label={t('sharedTasksSetting')} value={showSharedTasks} onChange={(show) => dispatch(setShowSharedTasks(show))}
                                options={[{ value: true, label: 'show' }, { value: false, label: 'hide' }]} />
                        </SettingRow>
                    </SettingSection>

                    <SettingSection id="timer" title={t('sessionSettings')} description={t('defaultSessionLengthHint')}>
                        <SettingRow title={t('defaultSessionLength')}>
                            <Choice label={t('defaultSessionLength')} value={defaultSessionMinutes} onChange={changeSessionLength}
                                options={SESSION_LENGTHS.map(minutes => ({ value: minutes, text: String(minutes) }))} />
                        </SettingRow>
                    </SettingSection>

                    <SettingSection id="event-types" title={t('eventTypes')} description={t('eventTypesHint')}>
                        <EventTypeSettings embedded />
                    </SettingSection>

                    <SettingSection id="untis" title={t('untisSettingsTitle')} description={t('untisSettingsHint')}>
                        <UntisSettings />
                    </SettingSection>

                    <SettingSection id="study" title={t('studySettingsTitle')} description={t('studySettingsHint')}>
                        <StudySettings />
                    </SettingSection>
                </>

                <>
                    <SettingSection id="notifications" title={t('pushTitle')} description={t('pushHint')}>
                        <PushSettings />
                        <AllDayTimeSetting />
                    </SettingSection>
                    <SettingSection id="microphone" title={t('micTitle')} description={t('micHint')}>
                        <MicrophoneSettings />
                    </SettingSection>
                    <SettingSection id="tour" title={t('tutorial')} description={t('settingsTourHint')}>
                        <SettingRow title={t('settingsTourRow')} hint={t('settingsTourRowHint')}>
                            <button type="button" className={styles.tourButton} onClick={() => dispatch(setShowTutorial(true))}>
                                {t('settingsTourStart')}
                            </button>
                        </SettingRow>
                        <TipsSetting />
                    </SettingSection>
                    {/* reminders ring like an alarm clock in the Android app: what that needs */}
                    {isNativeApp() &&
                        <SettingSection id="alarms" title={t('reminderAlarmSetting')} description={t('reminderAlarmHint')}>
                            <AlarmSettings />
                        </SettingSection>}
                    <SettingSection id="privacy" title={t('privacySetting')} description={t('privacySettingHint')}>
                        <UsageSetting />
                    </SettingSection>
                    {analytics.available &&
                        <SettingSection id="analytics" title={t('analyticsSetting')} description={t('analyticsSettingHint')}>
                            <AnalyticsSetting />
                        </SettingSection>}
                    {/* Android phones: the real app to download (with notifications through Android) */}
                    {apk &&
                        <SettingSection id="android" title={t('androidApp')} description={t('androidAppHint')}>
                            <SettingRow title={t('androidAppRow')}
                                hint={fill(t('androidAppVersion'), { version: apk.version, size: formatSize(apk.size, language) })}>
                                <a href={APK_URL} download="Quidey.apk" className={styles.installButton}>{t('androidAppDownload')}</a>
                            </SettingRow>
                        </SettingSection>}
                    {/* only where this browser can install it */}
                    {installState !== 'unavailable' &&
                        <SettingSection id="install" title={t('installApp')} description={t('settingsAppHint')}>
                            <SettingRow title={t('installApp')}
                                hint={t({ installed: 'installAppDone', ios: 'installAppIos', prompt: 'installAppHint' }[installState])}>
                                {installState === 'prompt' && (
                                    // the APK is the screen's one primary where there is one
                                    <button type="button" className={apk ? styles.tourButton : styles.installButton} onClick={promptInstall}>{t('installAppButton')}</button>
                                )}
                            </SettingRow>
                        </SettingSection>}
                </>
            </div>
            </div>
        </div>
    );
}
