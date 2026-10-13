import styles from './Settings.module.css';
import {useTranslation} from '../i18n/LanguageContext'
import {useSelector, useDispatch} from 'react-redux';
import {setLanguage} from '../features/settings/settingsAction';


export default function Settings(){
    const { t } = useTranslation();
    const language = useSelector((state) => state.settings.language);
    const dispatch = useDispatch();

    return (
        <div className={styles.div}>
            <h1 className={styles.settingsH1} >{t('settings')}</h1>
            <div className={styles.settingsSectionDiv} >
                <h2 className={styles.settingsH2} >{t('general')}</h2>
                <div className={styles.individualSettingDiv}>
                    <p>{`${t('language')} (${t('current')}: ${language === 'en' ? t('english') : t('german')})`}:</p>
                    <button onClick={()=>{
                        dispatch(setLanguage(language === 'de' ? 'en' : 'de'))
                        }}>
                        {language === 'de' ? t('english') : t('german')}
                    </button>
                </div>  
            </div>
        </div>
    );
}