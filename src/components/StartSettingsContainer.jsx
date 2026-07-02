import React, { useState } from 'react'
import {useNavigate} from 'react-router-dom'
import styles from './StartSettingsContainer.module.css'

const StartSettingsContainer = (props) => {
    const { t, groups, setShowStartSettings, setSessionParams, setCustomError } = props;

    const navigate = useNavigate();

    const handleStartSession = (e) => {
        e.preventDefault();
        const form = e.target;
        const h = Number(form.elements.hours.value);
        const m = Number(form.elements.mins.value);
        if(h !== 0 || m !== 0){
            setSessionParams({group: form.elements.groups.value ,time: (h * 3600 * 1000 + m * 60 * 1000), breaks: form.elements.breaks.checked});
            setShowStartSettings(false);
            navigate('/working');
        } else {
            setCustomError({bool: true, message: t('sessionTimeError')});
        }
    }

    return (
        <form className={styles.form} onSubmit={(e)=>{handleStartSession(e)}}>
            <label htmlFor="groupInput">{t('group')}: </label>
            <select className={`${styles.space} ${styles.groupSelect}`} name="groups" id='groups'>
                <option key={'all'} value={'all'}>{t('all')}</option>
                {groups.map((group) =>{ 
                    if(group.name !== 'all'){
                        return(
                            <option key={group.name} value={group.name}>
                                {group.name}
                            </option>
                        );
                    }
                })}
            </select>
            <div className={styles.timerDiv + ' ' + styles.space}>
                <select name="hours">
                    <option value="1">01</option>
                    <option value="2">02</option>
                    <option value="3">03</option>
                    <option value="0">00</option>
                </select>
                <p className={styles.p}> : </p>
                <select name="mins">
                    <option value="0">00</option>
                    <option value="15">15</option>
                    <option value="30">30</option>
                    <option value="45">45</option>
                </select>
            </div>
            <div className={styles.timerDiv + ' ' + styles.space}>
                <label htmlFor="breaks">{t('breaks')}</label>
                <input type="checkbox" id="breaks" name="breaks" />
            </div>
            <button className={`${styles.space} ${styles.startBtn}`} type="submit">{t('start')}</button>
        </form>
    );
}

export default StartSettingsContainer;