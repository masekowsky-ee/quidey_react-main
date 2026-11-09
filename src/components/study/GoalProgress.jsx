import { fill } from '../../features/helperFunction';
import { hoursNumber } from '../../features/study/study';
import { useTranslation } from '../../i18n/useTranslation';
import styles from './Study.module.css';

// A thin bar, value 0..1
export function ProgressBar({ value, label }) {
    const share = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
    return (
        <div className={styles.bar} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)}>
            <div className={styles.barFill} style={{ width: `${share * 100}%` }} />
        </div>
    );
}

// The bar and "6,5 von 16 h": credit = minutes studied (counted), estimate = minutes planned in all
export default function GoalProgress({ credit, estimate }) {
    const { t, language } = useTranslation();
    const text = fill(t('studyProgressOf'), { done: hoursNumber(credit, language), total: hoursNumber(estimate, language) });
    return (
        <div className={styles.progress}>
            <ProgressBar value={estimate > 0 ? credit / estimate : 0} label={text} />
            <span className={styles.progressText}>{text}</span>
        </div>
    );
}
