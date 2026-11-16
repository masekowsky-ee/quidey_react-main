import Icon from '../icons.jsx';
import { useTranslation } from '../../i18n/useTranslation';
import { useAiQuota } from '../../features/ai/ai';
import styles from '../Form.module.css';

// "Material scannen" under the kind switch of the plus button's forms (task, note, reminder): a quiet
// way to the scan sheet (QuickAdd swaps it in). Only where the AI is set up.
export default function ScanLink({ onScan }) {
    const { t } = useTranslation();
    const quota = useAiQuota();
    if (!onScan || !quota?.available) return null;
    return (
        <button type="button" className={styles.scanLink} onClick={onScan}>
            <Icon name="brain" size={14} /> {t('scanFromForm')}
        </button>
    );
}
