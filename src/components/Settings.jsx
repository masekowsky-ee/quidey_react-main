import styles from './Settings.module.css';
import {useTranslation} from '../i18n/useTranslation'
import {useSelector, useDispatch} from 'react-redux';
import {setLanguage} from '../features/settings/settingsAction';

const LANGUAGES = [
    { code: 'de', label: 'german' },
    { code: 'en', label: 'english' },
];

export default function Settings(){
    const { t } = useTranslation();
    const language = useSelector((state) => state.settings.language);
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
            </section>
        </div>
    );
}
