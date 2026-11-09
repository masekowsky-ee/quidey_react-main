import styles from './MailSpamHint.module.css';
import Icon from '../icons.jsx';
import { useTranslation } from '../../i18n/useTranslation';

// Wherever a confirmation mail went out: a small "i" with the hint to look in the spam folder,
// always written out beside it (not a tooltip, so it is seen on touch too)
export default function MailSpamHint() {
    const { t } = useTranslation();
    return (
        <p className={styles.hint}>
            <Icon name="info" size={16} />
            <span>{t('mailSpamHint')}</span>
        </p>
    );
}
