import React, { useState } from 'react'
import styles from './GroupForm.module.css';

export default function GroupForm(props){
    const {t, setGroups, groups, setCustomError, showForms} = props;

    const handleSubmit = (e) => {
        e.preventDefault();
        const name = e.target[0].value;
        const description = e.target[1].value;
        if(name && name !== 'all' && !groups.some(g => g.name === name)){
            setGroups((prev) => [...prev, { name: name, tasks: [], description: description }]);
            e.target[0].value = '';
            e.target[1].value = '';
        } else{
            setCustomError({bool: true, message: t('groupError')})
        }
    }

    return (
        <div className={`${styles.div} ${showForms ? '' : styles.height}`}>
            <h2 className={styles.h2}>{t('createGroupH2')}</h2>
            <form className={`${styles.form} ${showForms ? '' : styles.hidden}`} onSubmit={(e)=>{handleSubmit(e)}}>
                <input type="text" className={styles.input} placeholder={t('groupName')} />
                <input type="text" className={styles.input} placeholder={t('description')} />
                <button type="submit" className={styles.createBtn}>{t('createBtn')}</button>
            </form>
        </div>
    )
}