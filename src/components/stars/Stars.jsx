import { useState } from 'react';
import styles from './Stars.module.css';
import Icon from '../icons';

// A 1..max star rating as a radio group. The stars up to the hovered one (else up to the value)
// are lit. `tone` picks the lit colour ('accent' | 'fruit'), `size` the box ('md' | 'lg');
// `className` lays the row out where it stands.
export default function Stars({ value, max = 5, onChange, label, starLabel, tone = 'accent', size = 'md', className = '' }) {
    const [hovered, setHovered] = useState(0);
    const shown = hovered || value || 0;
    return (
        <div className={`${styles.stars} ${className}`} role="radiogroup" aria-label={label} onPointerLeave={() => setHovered(0)}>
            {Array.from({ length: max }, (_, i) => i + 1).map(n => (
                <button key={n} type="button" role="radio" aria-checked={value === n}
                    className={`${styles.star} ${styles[tone]} ${styles[size]} ${n <= shown ? styles.on : ''}`}
                    aria-label={starLabel(n)} title={size === 'md' ? starLabel(n) : undefined}
                    onPointerEnter={() => setHovered(n)} onClick={() => onChange(n)}>
                    <Icon name="star" size={size === 'md' ? 20 : 30} strokeWidth={size === 'md' ? 1.6 : undefined} />
                </button>
            ))}
        </div>
    );
}
