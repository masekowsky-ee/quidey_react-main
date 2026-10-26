import styles from './Settings.module.css';
import { useEffect, useState } from 'react';
import {useTranslation} from '../i18n/useTranslation'
import {useSelector, useDispatch} from 'react-redux';
import {setLanguage, setTheme, setAccent, setPalette, setDefaultSessionMinutes, setMotion, setSound, setShowSharedTasks, setShowTutorial} from '../features/settings/settingsAction';
import {MOTION_LEVELS} from '../features/settings/motion';
import {SOUND_LEVELS, SOUND_NAMES, playSound} from '../features/settings/sound';
import {setSessionParams} from '../features/session/sessionAction';
import {SESSION_LENGTHS, PALETTES, ACCENT_SWATCHES as ACCENT_OPTIONS} from '../features/settings/preferences';
import { DEFAULT_UI_VARIANT, OWN_COLORS, VARIANT_COLORS, setUiColors, useColorChoice } from '../features/tester/variants';
import HomeLayoutSwitch from './together/HomeLayoutSwitch';
import {useInstallState, promptInstall} from '../features/pwa/install';
import { PUSH_KINDS, disablePush, enablePush, refreshPush, sendTestPush, setPushKind, usePushState } from '../features/pwa/push';
import { fill } from '../features/helperFunction';
import { saveAllDayTime, selectAllDayTime } from '../features/tasks/reminders';
import EventTypeSettings from './EventTypeSettings.jsx';
import { useLocation } from 'react-router-dom';
import { useHashTarget } from '../features/layout/hashTarget';
import { SECTION_AREAS } from '../features/search/places';

const LANGUAGES = [
    { code: 'de', label: 'german' },
    { code: 'en', label: 'english' },
];

const THEME_OPTIONS = [
    { value: 'dark', label: 'themeDark' },
    { value: 'light', label: 'themeLight' },
    { value: 'system', label: 'themeSystem' },
];

// The settings come in three areas, one view each, so only a few choices are in sight at a
// time. The area is in the address's hash (#plan, #app); a section's id opens its area and
// scrolls to it (#event-types from the editor, #appearance … from the command bar).
// "App": notifications on this device, the intro tour and, where the browser can, installing Quidey.
const AREAS = ['look', 'plan', 'app'];
const areaFromHash = (hash) => {
    const name = hash.slice(1);
    return AREAS.includes(name) ? name : SECTION_AREAS[name] ?? 'look';
};

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

    return (
        <>
            <SettingRow title={t('pushDevice')} hint={t(PUSH_HINTS[push.status])}>
                {(on || push.status === 'off') && (
                    <Choice label={t('pushDevice')} value={on} disabled={push.busy} options={ON_OFF}
                        onChange={(next) => {
                            if (next === on) return;
                            setTested(false);
                            if (next) enablePush(); else disablePush();
                        }} />
                )}
            </SettingRow>
            {on && push.kinds && PUSH_KINDS.map(kind => (
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
    const dispatch = useDispatch();
    const { hash, key } = useLocation();
    const [chosenArea, setArea] = useState(() => areaFromHash(hash));
    // a new address while the page is open (the command bar) opens its area
    const [shownKey, setShownKey] = useState(key);
    if (shownKey !== key) {
        setShownKey(key);
        setArea(areaFromHash(hash));
    }
    useHashTarget();
    const areas = AREAS;
    const area = areas.includes(chosenArea) ? chosenArea : 'look';

    const openArea = (next) => {
        setArea(next);
        try { window.history.replaceState(window.history.state, '', next === 'look' ? window.location.pathname : `#${next}`); } catch { /* only the address stays */ }
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
                <div className={styles.areas} role="tablist" aria-label={t('settings')}>
                    {areas.map(name => (
                        <button key={name} type="button" role="tab" id={`settings-tab-${name}`} aria-selected={area === name}
                            aria-controls={`settings-${name}`} className={area === name ? styles.areaActive : undefined}
                            onClick={() => openArea(name)}>
                            {t(`settingsArea_${name}`)}
                        </button>
                    ))}
                </div>
            </header>

            <div className={styles.view} role="tabpanel" id={`settings-${area}`} aria-labelledby={`settings-tab-${area}`}>
                {area === 'look' && <>
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
                </>}

                {area === 'plan' && <>
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
                </>}

                {area === 'app' && <>
                    <SettingSection id="notifications" title={t('pushTitle')} description={t('pushHint')}>
                        <PushSettings />
                        <AllDayTimeSetting />
                    </SettingSection>
                    <SettingSection id="tour" title={t('tutorial')} description={t('settingsTourHint')}>
                        <SettingRow title={t('settingsTourRow')} hint={t('settingsTourRowHint')}>
                            <button type="button" className={styles.tourButton} onClick={() => dispatch(setShowTutorial(true))}>
                                {t('settingsTourStart')}
                            </button>
                        </SettingRow>
                    </SettingSection>
                    {/* only where this browser can install it */}
                    {installState !== 'unavailable' &&
                        <SettingSection id="install" title={t('installApp')} description={t('settingsAppHint')}>
                            <SettingRow title={t('installApp')}
                                hint={t({ installed: 'installAppDone', ios: 'installAppIos', prompt: 'installAppHint' }[installState])}>
                                {installState === 'prompt' && (
                                    <button type="button" className={styles.installButton} onClick={promptInstall}>{t('installAppButton')}</button>
                                )}
                            </SettingRow>
                        </SettingSection>}
                </>}
            </div>
        </div>
    );
}
