import styles from './Settings.module.css';
import { useState } from 'react';
import {useTranslation} from '../i18n/useTranslation'
import {useSelector, useDispatch} from 'react-redux';
import {setLanguage, setTheme, setAccent, setDefaultSessionMinutes, setMotion, setShowSharedTasks} from '../features/settings/settingsAction';
import {MOTION_LEVELS} from '../features/settings/motion';
import {setSessionParams} from '../features/session/sessionAction';
import {SESSION_LENGTHS} from '../features/settings/preferences';
import HomeLayoutSwitch from './together/HomeLayoutSwitch';
import {useInstallState, promptInstall} from '../features/pwa/install';
import EventTypeSettings from './EventTypeSettings.jsx';

// Swatch color shown for each palette (its dark-mode accent)
const ACCENT_OPTIONS = [
    { value: 'sunset', label: 'accentSunset', color: '#fb923c' }, // the default
    { value: 'green', label: 'accentGreen', color: '#0ed30e' },
    { value: 'ocean', label: 'accentOcean', color: '#38bdf8' },
    { value: 'violet', label: 'accentViolet', color: '#a78bfa' },
    { value: 'rose', label: 'accentRose', color: '#fb7185' },
    { value: 'gold', label: 'accentGold', color: '#facc15' },
];

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
const AREAS = ['look', 'plan', 'app'];
const areaFromHash = () => {
    const hash = typeof window === 'undefined' ? '' : window.location.hash.slice(1);
    if (hash === 'event-types') return 'plan';
    return AREAS.includes(hash) ? hash : 'look';
};

// A segmented control of options: [{ value, label }], the current value, and what a click does
function Choice({ label, options, value, onChange }) {
    const { t } = useTranslation();
    return (
        <div className={styles.segmented} role="group" aria-label={label}>
            {options.map(option => (
                <button key={String(option.value)} type="button"
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

export default function Settings(){
    const { t } = useTranslation();
    const language = useSelector((state) => state.settings.language);
    const theme = useSelector((state) => state.settings.theme);
    const homeLayout = useSelector((state) => state.settings.homeLayout);
    const accent = useSelector((state) => state.settings.accent);
    const motionLevel = useSelector((state) => state.settings.motion);
    const defaultSessionMinutes = useSelector((state) => state.settings.defaultSessionMinutes);
    const showSharedTasks = useSelector((state) => state.settings.showSharedTasks);
    const installState = useInstallState();
    const dispatch = useDispatch();
    const [chosenArea, setArea] = useState(areaFromHash);
    // "App" only where this browser can install it (elsewhere the area is left out)
    const areas = AREAS.filter(name => name !== 'app' || installState !== 'unavailable');
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
                            <span className={styles.rowLabel}>{t('accentColor')}</span>
                            <div className={styles.swatches} role="group" aria-label={t('accentColor')}>
                                {ACCENT_OPTIONS.map(({ value, label, color }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        className={`${styles.swatch} ${accent === value ? styles.swatchActive : ''}`}
                                        style={{ '--swatch': color }}
                                        aria-pressed={accent === value}
                                        onClick={() => dispatch(setAccent(value))}
                                    >
                                        <span className={styles.swatchDot} aria-hidden="true" />
                                        <span className={styles.swatchLabel}>{t(label)}</span>
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

                {area === 'app' &&
                    <SettingSection id="install" title={t('installApp')} description={t('settingsAppHint')}>
                        <SettingRow title={t('installApp')}
                            hint={t({ installed: 'installAppDone', ios: 'installAppIos', prompt: 'installAppHint' }[installState])}>
                            {installState === 'prompt' && (
                                <button type="button" className={styles.installButton} onClick={promptInstall}>{t('installAppButton')}</button>
                            )}
                        </SettingRow>
                    </SettingSection>}
            </div>
        </div>
    );
}
