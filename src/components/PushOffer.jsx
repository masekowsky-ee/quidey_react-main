import styles from './PushOffer.module.css';
import { useId, useRef } from 'react';
import { useTranslation } from '../i18n/useTranslation';
import { answerPushOffer, usePushState } from '../features/pwa/push';
import Icon from './icons';
import Dialog from './Dialog.jsx';

// "Notifications on this device?", asked once after creating a task (offerPushAfterTask in
// features/pwa/push.js). Mounted once in the app shell. Yes asks the browser for the permission
// (it needs this click); "Later" or Escape closes it, the settings (App) can still turn them on.
export default function PushOffer() {
    const { asking } = usePushState();
    if (!asking) return null;
    return <Question />;
}

function Question() {
    const { t } = useTranslation();
    const titleId = useId();
    const textId = useId();
    const yesRef = useRef(null);
    // on phones a sheet: pulled down, it is a no
    return (
        <Dialog onClose={() => answerPushOffer(false)} role="alertdialog" labelledBy={titleId} describedBy={textId}
            initialFocus={yesRef} drag backdropClassName={styles.backdrop} className={styles.dialog}>
            {(dismiss) => (<>
                <span className={styles.badge} aria-hidden="true"><Icon name="bell" size={20} /></span>
                <h2 id={titleId} className={styles.title}>{t('pushOfferTitle')}</h2>
                <p id={textId} className={styles.text}>{t('pushOfferText')}</p>
                <button ref={yesRef} type="button" className={styles.yes} onClick={() => answerPushOffer(true)}>
                    <Icon name="bell" size={18} />{t('pushOfferYes')}
                </button>
                <button type="button" className={styles.later} onClick={() => dismiss()}>{t('pushOfferLater')}</button>
            </>)}
        </Dialog>
    );
}
