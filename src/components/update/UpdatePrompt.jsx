import { useSyncExternalStore } from 'react';
import { subscribeUpdate, updateState, startUpdate, dismissUpdate, finishUpdate } from '../../features/native/appUpdate';
import { useTranslation } from '../../i18n/useTranslation';
import ui from '../ui.module.css';
import styles from './UpdatePrompt.module.css';

// In the Android app: a newer version is out (card), is downloading or ready to install, or this
// one is too old to keep working (a window that stays until the person updates).
// The state comes from features/native/appUpdate.js; in the browser it never leaves 'none'.
export default function UpdatePrompt() {
    const { t } = useTranslation();
    const { status, error } = useSyncExternalStore(subscribeUpdate, updateState, updateState);

    if (status === 'none') return null;

    if (status === 'required') {
        return (
            <div className={styles.backdrop}>
                <div className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby="update-title" aria-describedby="update-text">
                    <h2 id="update-title" className={styles.title}>{t('updateRequiredTitle')}</h2>
                    <p id="update-text" className={styles.text}>{t('updateRequiredText')}</p>
                    {error && <p className={styles.error} role="alert">{t('updateFailed')}</p>}
                    <div className={styles.actions}>
                        <button type="button" className={ui.btnPrimary} onClick={startUpdate}>{t('updateNow')}</button>
                    </div>
                </div>
            </div>
        );
    }

    const copy = {
        available: ['updateTitle', 'updateText'],
        downloading: ['updateTitle', 'updateDownloading'],
        ready: ['updateReadyTitle', 'updateReadyText'],
    }[status];

    return (
        <div className={styles.card} role="status">
            <h2 className={styles.title}>{t(copy[0])}</h2>
            <p className={styles.text}>{t(copy[1])}</p>
            {error && <p className={styles.error} role="alert">{t('updateFailed')}</p>}
            {status === 'available' && (
                <div className={styles.actions}>
                    <button type="button" className={ui.btnNo} onClick={dismissUpdate}>{t('updateLater')}</button>
                    <button type="button" className={ui.btnPrimary} onClick={startUpdate}>{t('updateNow')}</button>
                </div>
            )}
            {status === 'ready' && (
                <div className={styles.actions}>
                    <button type="button" className={ui.btnPrimary} onClick={finishUpdate}>{t('updateRestart')}</button>
                </div>
            )}
        </div>
    );
}
