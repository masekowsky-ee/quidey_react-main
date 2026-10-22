import styles from './Settings.module.css';
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
            <h1 className={styles.title}>{t('settings')}</h1>
            <section className={styles.card}>
                <h2 className={styles.cardTitle}>{t('general')}</h2>
                <div className={styles.row}>
                    <span className={styles.rowLabel}>{t('language')}</span>
                    <div className={styles.segmented} role="group" aria-label={t('language')}>
                        {LANGUAGES.map(({ code, label }) => (
                            <button
                                key={code}
                                className={language === code ? styles.segmentActive : undefined}
                                aria-pressed={language === code}
                                onClick={() => dispatch(setLanguage(code))}
                            >
                                {t(label)}
                            </button>
                        ))}
                    </div>
                </div>
                <div className={styles.row}>
                    <span className={styles.rowLabel}>{t('appearance')}</span>
                    <div className={styles.segmented} role="group" aria-label={t('appearance')}>
                        {THEME_OPTIONS.map(({ value, label }) => (
                            <button
                                key={value}
                                className={theme === value ? styles.segmentActive : undefined}
                                aria-pressed={theme === value}
                                onClick={() => dispatch(setTheme(value))}
                            >
                                {t(label)}
                            </button>
                        ))}
                    </div>
                </div>
                <div className={styles.row}>
                    <div className={styles.rowText}>
                        <span className={styles.rowLabel}>{t('motionSetting')}</span>
                        <span className={styles.rowHint}>{t(`motionHint_${motionLevel}`)}</span>
                    </div>
                    <div className={styles.segmented} role="group" aria-label={t('motionSetting')}>
                        {MOTION_LEVELS.map((level) => (
                            <button
                                key={level}
                                className={motionLevel === level ? styles.segmentActive : undefined}
                                aria-pressed={motionLevel === level}
                                onClick={() => dispatch(setMotion(level))}
                            >
                                {t(`motion_${level}`)}
                            </button>
                        ))}
                    </div>
                </div>
                <div className={styles.row}>
                    <div>
                        <span className={styles.rowLabel}>{t('homeLayout')}</span>
                        <p className={styles.rowHint}>{t(homeLayout === 'team' ? 'homeTeamHint' : 'homeSoloHint')}</p>
                    </div>
                    <HomeLayoutSwitch />
                </div>
                <div className={styles.row}>
                    <div className={styles.rowText}>
                        <span className={styles.rowLabel}>{t('sharedTasksSetting')}</span>
                        <span className={styles.rowHint}>{t('sharedTasksSettingHint')}</span>
                    </div>
                    <div className={styles.segmented} role="group" aria-label={t('sharedTasksSetting')}>
                        {[true, false].map((show) => (
                            <button
                                key={String(show)}
                                className={showSharedTasks === show ? styles.segmentActive : undefined}
                                aria-pressed={showSharedTasks === show}
                                onClick={() => dispatch(setShowSharedTasks(show))}
                            >
                                {t(show ? 'show' : 'hide')}
                            </button>
                        ))}
                    </div>
                </div>
                {installState !== 'unavailable' && (
                    <div className={styles.row}>
                        <div className={styles.rowText}>
                            <span className={styles.rowLabel}>{t('installApp')}</span>
                            <span className={styles.rowHint}>
                                {t({ installed: 'installAppDone', ios: 'installAppIos', prompt: 'installAppHint' }[installState])}
                            </span>
                        </div>
                        {installState === 'prompt' && (
                            <button className={styles.installButton} onClick={promptInstall}>{t('installAppButton')}</button>
                        )}
                    </div>
                )}
            </section>

            <section className={styles.card}>
                <h2 className={styles.cardTitle}>{t('accentColor')}</h2>
                <div className={styles.swatches} role="group" aria-label={t('accentColor')}>
                    {ACCENT_OPTIONS.map(({ value, label, color }) => (
                        <button
                            key={value}
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
            </section>

            <section className={styles.card}>
                <h2 className={styles.cardTitle}>{t('sessionSettings')}</h2>
                <div className={styles.row}>
                    <div className={styles.rowText}>
                        <span className={styles.rowLabel}>{t('defaultSessionLength')}</span>
                        <span className={styles.rowHint}>{t('defaultSessionLengthHint')}</span>
                    </div>
                    <div className={styles.segmented} role="group" aria-label={t('defaultSessionLength')}>
                        {SESSION_LENGTHS.map((minutes) => (
                            <button
                                key={minutes}
                                className={defaultSessionMinutes === minutes ? styles.segmentActive : undefined}
                                aria-pressed={defaultSessionMinutes === minutes}
                                onClick={() => changeSessionLength(minutes)}
                            >
                                {minutes}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <EventTypeSettings />
        </div>
    );
}
