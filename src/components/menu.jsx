import React from 'react'
import { Link } from 'react-router-dom';
import styles from './Menu.module.css';

export default function Menu(props){
    const { isOpen, onClose, t, setLanguage } = props;

    return (
        <>
            {isOpen && <div className={styles.overlay} onClick={onClose} />}
            <div className={`${styles.menuDiv} ${isOpen ? styles.open : ''}`}>
                <h2 className={styles.menuTitle}>{t('menu')}</h2>
                <Link to="/" className={styles.menuItem} onClick={onClose}>
                    {t('home')}
                </Link>
                <Link to="/profile" className={styles.menuItem} onClick={onClose}>
                    {t('profile')}
                </Link>
                <Link to="/history" className={styles.menuItem} onClick={onClose}>
                    {t('history')}
                </Link>
                <Link to="/settings" className={styles.menuItem} onClick={onClose}>
                    {t('settings')}
                </Link>
            </div>
        </>
    );
}