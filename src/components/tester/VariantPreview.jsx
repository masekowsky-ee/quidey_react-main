import styles from './Tester.module.css';
import { UI_VARIANTS } from '../../features/tester/variants';

// A small drawing of a variant: its ground, a panel, the ink and its one colour, with the
// navigation where that variant puts it (sidebar, rail, tabs on top, command bar)
export default function VariantPreview({ variant }) {
    const { nav, swatches: [ground, panel, ink, mark] } = UI_VARIANTS[variant];
    return (
        <span className={styles.preview} data-nav={nav} aria-hidden="true"
            style={{ '--p-ground': ground, '--p-panel': panel, '--p-ink': ink, '--p-mark': mark }}>
            <span className={styles.previewNav} />
            <span className={styles.previewBody}>
                <span className={styles.previewTitle} />
                <span className={styles.previewRow} data-mark="true" />
                <span className={styles.previewRow} />
                <span className={styles.previewRow} />
            </span>
        </span>
    );
}
