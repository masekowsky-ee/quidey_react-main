import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { refreshTasks } from '../../features/tasks/taskAction';
import { fetchSessions } from '../../features/session/sessionAction';
import { CONNECTION_EVENT, SYNCED_EVENT, acknowledgeFailures, connectionState } from '../../features/offline/offline';
import { useTranslation } from '../../i18n/useTranslation';
import { fill } from '../../features/helperFunction';
import styles from './OfflineStatus.module.css';
import { quietly } from '../../features/api/quietly';

// While there is no connection the app shows what it saved on the device and keeps changes in a
// queue (features/offline/offline.js). This line says so, and once the queue went out it
// loads the lists again, so temporary entries are replaced by the real ones.
export default function OfflineStatus() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [state, setState] = useState(connectionState);

    useEffect(() => {
        const onChange = (event) => setState(event.detail);
        const onSynced = () => {
            quietly(dispatch(refreshTasks()));
            quietly(dispatch(fetchSessions()));
        };
        window.addEventListener(CONNECTION_EVENT, onChange);
        window.addEventListener(SYNCED_EVENT, onSynced);
        return () => {
            window.removeEventListener(CONNECTION_EVENT, onChange);
            window.removeEventListener(SYNCED_EVENT, onSynced);
        };
    }, [dispatch]);

    const { offline, pending, failed } = state;
    if (!offline && pending === 0 && failed === 0) return null;

    let text;
    if (failed > 0) text = fill(t('offlineFailed'), { count: failed });
    else if (offline && pending > 0) text = fill(t('offlinePending'), { count: pending });
    else if (offline) text = t('offlineSaved');
    else text = fill(t('offlineSyncing'), { count: pending });

    return (
        <div className={`${styles.bar} ${failed > 0 ? styles.warn : ''}`} role="status" data-tip="offline">
            <span className={styles.text}>{text}</span>
            {failed > 0 && <button type="button" className={styles.ok} onClick={acknowledgeFailures}>{t('offlineOk')}</button>}
        </div>
    );
}
