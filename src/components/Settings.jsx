import styles from './Settings.module.css';
import {useTranslation} from '../i18n/useTranslation'
import {useSelector, useDispatch} from 'react-redux';
import {setLanguage, setTheme} from '../features/settings/settingsAction';

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
    const dispatch = useDispatch();

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
            </section>
        </div>
    );
}
