import styles from './GoalShape.module.css';
import { useTranslation } from '../../i18n/useTranslation';
import { GOAL_SHAPES } from '../../features/study/shapes';

// A study goal's shape, in its subject's colour (--task-color from the nearest data-task-color):
// the goals of one subject told apart at a glance, in the lists, on the goal's page and on every
// planned session. Beside the goal's name it is decoration (the name says which goal it is);
// label: said aloud where the shape stands alone (the picker).

// drawn on a 20 × 20 grid, filled, so they read at 10px as well as at 24px
const PATHS = {
    circle: <circle cx="10" cy="10" r="8" />,
    square: <rect x="2.5" y="2.5" width="15" height="15" rx="2.5" />,
    triangle: <path d="M10 2.2c.5 0 1 .3 1.3.8l6.9 12.4c.6 1-.2 2.3-1.3 2.3H3.1c-1.2 0-1.9-1.3-1.3-2.3L8.7 3c.3-.5.8-.8 1.3-.8z" />,
    diamond: <path d="M10 1.5l8.5 8.5-8.5 8.5L1.5 10z" />,
    star: <path d="M10 1.6l2.5 5.3 5.8.7-4.3 4 1.1 5.7L10 14.5l-5.1 2.8 1.1-5.7-4.3-4 5.8-.7z" />,
    hexagon: <path d="M10 1.8l7.1 4.1v8.2L10 18.2l-7.1-4.1V5.9z" />,
    heart: <path d="M10 17.6s-7.6-4.6-7.6-9.9C2.4 5 4.4 3 6.8 3c1.4 0 2.6.7 3.2 1.8C10.6 3.7 11.8 3 13.2 3c2.4 0 4.4 2 4.4 4.7 0 5.3-7.6 9.9-7.6 9.9z" />,
};

export default function GoalShape({ shape, size = 14, color, label = false, className = '' }) {
    const { t } = useTranslation();
    const drawn = GOAL_SHAPES.includes(shape) ? shape : 'circle';
    return (
        <svg className={`${styles.shape} ${className}`} width={size} height={size} viewBox="0 0 20 20"
            data-task-color={color || undefined} data-shape={drawn}
            role={label ? 'img' : undefined} aria-label={label ? t(`goalShape_${drawn}`) : undefined}
            aria-hidden={label ? undefined : 'true'}>
            {PATHS[drawn]}
        </svg>
    );
}

// The shapes as a row of choices (radio buttons): the goal's sheet and its settings
export function ShapePicker({ value, onChange, color }) {
    const { t } = useTranslation();
    return (
        <fieldset className={styles.picker}>
            <legend className={styles.legend}>{t('goalShape')}</legend>
            <div className={styles.choices} data-task-color={color || undefined}>
                {GOAL_SHAPES.map(shape => (
                    <label key={shape} className={styles.choice} title={t(`goalShape_${shape}`)}>
                        <input type="radio" name="goal-shape" value={shape} checked={value === shape}
                            onChange={() => onChange(shape)} aria-label={t(`goalShape_${shape}`)} />
                        <GoalShape shape={shape} size={20} />
                    </label>
                ))}
            </div>
        </fieldset>
    );
}
