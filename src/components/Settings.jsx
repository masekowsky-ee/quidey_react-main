import styles from './Settings.module.css';
import { useEffect, useState } from 'react';
import {useTranslation} from '../i18n/useTranslation'
import {useSelector, useDispatch} from 'react-redux';
import {setLanguage, setTheme, setAccent, setPalette, setDefaultSessionMinutes, setMotion, setShowSharedTasks, setShowTutorial} from '../features/settings/settingsAction';
import {MOTION_LEVELS} from '../features/settings/motion';
import {setSessionParams} from '../features/session/sessionAction';
import {SESSION_LENGTHS, PALETTES, ACCENT_SWATCHES as ACCENT_OPTIONS} from '../features/settings/preferences';
import { DEFAULT_UI_VARIANT, OWN_COLORS, VARIANT_COLORS, setUiColors, useColorChoice } from '../features/tester/variants';
import HomeLayoutSwitch from './together/HomeLayoutSwitch';
import {useInstallState, promptInstall} from '../features/pwa/install';
import { PUSH_KINDS, disablePush, enablePush, refreshPush, sendTestPush, setPushKind, usePushState } from '../features/pwa/push';
import { fill } from '../features/helperFunction';
import EventTypeSettings from './EventTypeSettings.jsx';

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
// time. The area is in the address's hash (#plan, #app; the editor's #event-types opens "plan").
// "App": notifications on this device, the intro tour and, where the browser can, installing Quidey.
const AREAS = ['look', 'plan', 'app'];
const areaFromHash = () => {
    const hash = typeof window === 'undefined' ? '' : window.location.hash.slice(1);
    if (hash === 'event-types') return 'plan';
    return AREAS.includes(hash) ? hash : 'look';
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
            {push.error && <p className={styles.pushError} role="alert">{t(push.error)}</p>}
        </>
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
    const defaultSessionMinutes = useSelector((state) => state.settings.defaultSessionMinutes);
    const showSharedTasks = useSelector((state) => state.settings.showSharedTasks);
    const installState = useInstallState();
    const dispatch = useDispatch();
    const [chosenArea, setArea] = useState(areaFromHash);
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
