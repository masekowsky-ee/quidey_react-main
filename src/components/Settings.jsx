import React from 'react'
import styles from './Settings.module.css';

export default function Settings(props){
    const { t, setLanguage, language } = props;

    return (
        <div className={styles.div}>
            <h1 className={styles.settingsH1} >{t('settings')}</h1>
            <div className={styles.settingsSectionDiv} >
                <h2 className={styles.settingsH2} >{t('general')}</h2>
                <div className={styles.individualSettingDiv}>
                    <p>{t('language')}:</p>
                    <button className={styles.settingBtn} onClick={()=>{setLanguage(language === 'de' ? 'en' : 'de')}}>
                        {language === 'de' ? t('english') : t('german')}
                    </button>
                </div>  
            </div>
        </div>
    );
}