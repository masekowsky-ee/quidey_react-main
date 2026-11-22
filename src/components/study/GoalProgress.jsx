import { fill } from '../../features/helperFunction';
import { formatDuration } from '../../features/study/liveCredit';
import { useTranslation } from '../../i18n/useTranslation';
import styles from './Study.module.css';

export function ProgressBar({ value, label }) {
    const share = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
    return (
        <div className={styles.bar} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)}>
            <div className={styles.barFill} style={{ width: `${share * 100}%` }} />
        </div>
    );
}

// The bar and "1 h 30 min von 7 h", under it what is left ("noch 5 h 30 min"):
// credit = minutes studied (counted), estimate = minutes planned in all
export default function GoalProgress({ credit, estimate }) {
    const { t } = useTranslation();
    const text = fill(t('studyProgressOf'), { done: formatDuration(credit), total: formatDuration(estimate) });
    const left = Math.max(0, estimate - credit);
    return (
        <div className={styles.progress}>
            <ProgressBar value={estimate > 0 ? credit / estimate : 0} label={text} />
            <span className={styles.progressText}>{text}</span>
            {estimate > 0 && left > 0 && <span className={styles.progressText}>{fill(t('studyRemaining'), { time: formatDuration(left) })}</span>}
        </div>
    );
}
