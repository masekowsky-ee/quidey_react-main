import styles from './OnlineDot.module.css';
import { useTranslation } from '../../i18n/useTranslation';

// The green dot on an avatar (the avatar is aria-hidden: say "online" in the row's text too).
// The avatar it sits on gets `host` from OnlineDot.module.css.
export default function OnlineDot({ large = false }) {
    return <span className={`${styles.dot} ${large ? styles.large : ''}`} aria-hidden="true" />;
}

// "online" as a word with a small dot, next to a name
export function OnlineLabel() {
    const { t } = useTranslation();
    return <span className={styles.label}>{t('online')}</span>;
}
