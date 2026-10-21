import styles from './TaskOptions.module.css';
import { useId } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { TASK_COLORS } from '../../features/tasks/taskColors';

// The colour of a task: a row of round swatches (radio buttons, so arrow keys move between
// them), the first one is "no colour". value: a colour name or null; onChange(colour | null).
// hideLabel: the "Colour" heading only for screen readers (where the place already says it).
export default function TaskColorPicker({ value, onChange, hideLabel = false }) {
    const { t } = useTranslation();
    const name = useId();
    const current = TASK_COLORS.includes(value) ? value : null;

    return (
        <fieldset className={styles.colors}>
            <legend className={hideLabel ? styles.srOnly : styles.colorsLegend}>{t('taskColor')}</legend>
            <div className={styles.swatches}>
                {[null, ...TASK_COLORS].map(color => (
                    <label key={color ?? 'none'} className={styles.swatch} data-task-color={color ?? undefined} title={t(color ? `taskColor_${color}` : 'taskColorNone')}>
                        <input type="radio" name={name} value={color ?? ''} checked={current === color}
                            onChange={() => onChange(color)} aria-label={t(color ? `taskColor_${color}` : 'taskColorNone')} />
                        <span className={color ? styles.swatchDot : `${styles.swatchDot} ${styles.swatchNone}`} aria-hidden="true" />
                    </label>
                ))}
            </div>
        </fieldset>
    );
}
