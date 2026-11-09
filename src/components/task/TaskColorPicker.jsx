import styles from './TaskOptions.module.css';
import { useId, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { TASK_COLORS, isOwnColor } from '../../features/tasks/taskColors';
import ColorWheel from './ColorWheel.jsx';

// The colour of a task: a row of round swatches (radio buttons, so arrow keys move between
// them), the first one is "no colour", the last one opens the colour wheel for a colour of one's
// own ("#rrggbb"). value: a colour name, an own colour or null; onChange(colour | null).
// hideLabel: the "Colour" heading only for screen readers (where the place already says it).
export default function TaskColorPicker({ value, onChange, hideLabel = false }) {
    const { t } = useTranslation();
    const name = useId();
    const current = TASK_COLORS.includes(value) ? value : null;
    const own = isOwnColor(value);
    // the wheel is open from the start when the colour is an own one
    const [wheel, setWheel] = useState(own);

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
                <button type="button" className={styles.ownSwatch} aria-expanded={wheel} aria-pressed={own}
                    title={t('taskColorOwn')} aria-label={own ? `${t('taskColorOwn')}: ${value}` : t('taskColorOwn')}
                    onClick={() => setWheel(!wheel)}>
                    <span className={`${styles.swatchDot} ${own ? '' : styles.ownDot}`} data-task-color={own ? value : undefined} aria-hidden="true" />
                </button>
            </div>
            {wheel && <ColorWheel value={own ? value : null} onCommit={onChange} />}
        </fieldset>
    );
}
