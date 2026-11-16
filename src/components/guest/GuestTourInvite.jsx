import { useDispatch } from 'react-redux';
import { setShowTutorial } from '../../features/settings/settingsAction';
import { markInviteDone, useInviteDone } from '../../features/guest/tourInvite';
import { useTranslation } from '../../i18n/useTranslation';
import styles from './GuestTourInvite.module.css';

// "Neu hier?" on the start page, for visitors without an account: a quiet offer of the short tour.
// Opening the tour (here or from the menu) or "Nicht jetzt" puts it away for good (features/guest/tourInvite.js).
export default function GuestTourInvite() {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const done = useInviteDone();
    if (done) return null;
    return (
        <section className={styles.card} data-part="guest-tour-invite" aria-label={t('guestInviteTitle')}>
            <div className={styles.copy}>
                <h2 className={styles.title}>{t('guestInviteTitle')}</h2>
                <p className={styles.text}>{t('guestInviteText')}</p>
            </div>
            <div className={styles.actions}>
                <button type="button" className={styles.open} onClick={() => dispatch(setShowTutorial(true))}>{t('guestInviteOpen')}</button>
                <button type="button" className={styles.later} onClick={markInviteDone}>{t('guestInviteLater')}</button>
            </div>
        </section>
    );
}
