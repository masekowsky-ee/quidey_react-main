import styles from './PushOffer.module.css';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../i18n/useTranslation';
import { answerPushOffer, usePushState } from '../features/pwa/push';
import Icon from './icons';

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

    useEffect(() => {
        const previous = document.activeElement;
        yesRef.current?.focus();
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            e.preventDefault();
            e.stopPropagation();
            answerPushOffer(false);
        };
        window.addEventListener('keydown', onKey, true);
        return () => {
            window.removeEventListener('keydown', onKey, true);
            previous?.focus?.();
        };
    }, []);

    return createPortal(
        <div className={styles.backdrop} onPointerDown={(e) => { if (e.target === e.currentTarget) answerPushOffer(false); }}>
            <div className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={textId}>
                <span className={styles.badge} aria-hidden="true"><Icon name="bell" size={20} /></span>
                <h2 id={titleId} className={styles.title}>{t('pushOfferTitle')}</h2>
                <p id={textId} className={styles.text}>{t('pushOfferText')}</p>
                <button ref={yesRef} type="button" className={styles.yes} onClick={() => answerPushOffer(true)}>{t('pushOfferYes')}</button>
                <button type="button" className={styles.later} onClick={() => answerPushOffer(false)}>{t('pushOfferLater')}</button>
            </div>
        </div>,
        document.body
    );
}
