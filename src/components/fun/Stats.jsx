import styles from './Fun.module.css';

// Row of small numbers above a game: [{ label, value }]
export default function Stats({ items }) {
    return (
        <dl className={styles.stats}>
            {items.map(({ label, value }) => (
                <div key={label} className={styles.stat}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                </div>
            ))}
        </dl>
    );
}
