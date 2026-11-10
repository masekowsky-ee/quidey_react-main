import styles from './TaskOptions.module.css';
import { useId, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { TASK_COLORS, isOwnColor, hslToHex } from '../../features/tasks/taskColors';
import { useSavedColors, addSavedColor, removeSavedColor } from '../../features/tasks/savedColors';
import ColorWheel from './ColorWheel.jsx';

// where the wheel starts for a new colour (the wheel's own start)
const NEW_COLOR = hslToHex({ h: 200, s: 65, l: 48 });

// The colour of a task (a group, an event type, …): a row of round swatches (radio buttons, so
// arrow keys move between them): "no colour", the eight named ones, then my own colours (kept with
// the account, the same in every picker: features/tasks/savedColors.js). The small plus at the end
// opens the colour wheel; "Hinzufügen" puts the colour found there into my colours and picks it.
// An own colour the thing has that isn't one of mine (yet) shows as a swatch of its own.
// value: a colour name, an own colour ("#rrggbb") or null; onChange(colour | null).
// hideLabel: the "Colour" heading only for screen readers (where the place already says it).
export default function TaskColorPicker({ value, onChange, hideLabel = false }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const name = useId();
    const wheelId = useId();
    const saved = useSavedColors();
    const own = isOwnColor(value);
    const owns = own && !saved.includes(value) ? [value, ...saved] : saved;
    const [adding, setAdding] = useState(false);
    const [draft, setDraft] = useState(NEW_COLOR);
    const [failed, setFailed] = useState(false);

    const label = (color) => (color === null ? t('taskColorNone')
        : isOwnColor(color) ? `${t('taskColorOwn')} ${color}` : t(`taskColor_${color}`));

    const add = () => {
        setAdding(false);
        setFailed(false);
        onChange(draft);
        dispatch(addSavedColor(draft)).catch(() => setFailed(true));
    };
    const remove = () => {
        setFailed(false);
        dispatch(removeSavedColor(value)).catch(() => setFailed(true));
    };

    return (
        <fieldset className={styles.colors}>
            <legend className={hideLabel ? styles.srOnly : styles.colorsLegend}>{t('taskColor')}</legend>
            <div className={styles.swatches}>
                {[null, ...TASK_COLORS, ...owns].map(color => (
                    <label key={color ?? 'none'} className={styles.swatch} data-task-color={color ?? undefined} title={label(color)}>
                        <input type="radio" name={name} value={color ?? ''} checked={color === null ? !value : value === color}
                            onChange={() => onChange(color)} aria-label={label(color)} />
                        <span className={color ? styles.swatchDot : `${styles.swatchDot} ${styles.swatchNone}`} aria-hidden="true" />
                    </label>
                ))}
                <button type="button" className={styles.addSwatch} data-tip="color-add" aria-expanded={adding} aria-controls={adding ? wheelId : undefined}
                    title={t('taskColorAdd')} aria-label={t('taskColorAdd')}
                    onClick={() => { setAdding(!adding); setFailed(false); }}>
                    <span className={`${styles.swatchDot} ${styles.addDot}`} aria-hidden="true">
                        <svg width="10" height="10" viewBox="0 0 12 12"><path d="M6 1.5v9M1.5 6h9" /></svg>
                    </span>
                </button>
            </div>
            {adding && (
                <div id={wheelId} className={styles.addPanel}>
                    <ColorWheel value={draft} onCommit={setDraft} />
                    <div className={styles.addRow}>
                        <span className={styles.swatchDot} data-task-color={draft} aria-hidden="true" />
                        <button type="button" className={styles.addConfirm} onClick={add}>{t('taskColorAddConfirm')}</button>
                        {own && saved.includes(value) && (
                            <button type="button" className={styles.addRemove} onClick={remove}>{t('taskColorRemove')}</button>
                        )}
                    </div>
                </div>
            )}
            {failed && <p className={styles.colorError} role="alert">{t('taskColorSaveFailed')}</p>}
        </fieldset>
    );
}
