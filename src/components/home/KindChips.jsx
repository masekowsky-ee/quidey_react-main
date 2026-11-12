import { useTranslation } from '../../i18n/useTranslation';
import { HOME_KINDS } from '../../features/home/kinds';
import styles from './KindChips.module.css';

// The small labels in Home's list head: Aufgaben, Events, Erinnerungen, Notizen. On at first;
// a tap switches that kind of entry in the list (the rules: features/home/kinds.js).
export default function KindChips({ active, onToggle }) {
    const { t } = useTranslation();
    return (
        <div className={styles.chips} role="group" aria-label={t('homeKindsLabel')}>
            {HOME_KINDS.map(kind => (
                <button key={kind} type="button" className={styles.chip} aria-pressed={active.includes(kind)}
                    onClick={() => onToggle(kind)}>
                    {t(`homeKind_${kind}`)}
                </button>
            ))}
        </div>
    );
}
