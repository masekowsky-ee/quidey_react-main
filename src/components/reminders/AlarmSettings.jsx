import styles from '../Settings.module.css';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { alarmStatus, openAlarmSettings } from '../../features/native/alarms';

const PERMISSIONS = [
    { key: 'exact', label: 'reminderPermExact' },
    { key: 'fullScreen', label: 'reminderPermFullScreen' },
    { key: 'notifications', label: 'reminderPermNotifications' },
];

// Settings → App in the Android app (testers): what reminders need to ring like an alarm clock,
// each with a button to Android's page for it. Asked again when the app comes back from there.
export default function AlarmSettings() {
    const { t } = useTranslation();
    const [status, setStatus] = useState(undefined); // undefined: asking, null: no plugin

    useEffect(() => {
        const check = () => alarmStatus().then(setStatus);
        check();
        window.addEventListener('focus', check);
        return () => window.removeEventListener('focus', check);
    }, []);

    if (status === undefined) return null;
    if (status === null) return <p className={styles.rowHint}>{t('reminderAlarmOld')}</p>;
    return PERMISSIONS.map(({ key, label }) => (
        <div key={key} className={styles.row}>
            <div className={styles.rowText}>
                <span className={styles.rowLabel}>{t(label)}</span>
            </div>
            {status[key]
                ? <span className={styles.rowHint}>{t('reminderPermOk')}</span>
                : <button type="button" className={styles.tourButton} onClick={() => openAlarmSettings(key)}>{t('reminderPermAllow')}</button>}
        </div>
    ));
}
