import { useEffect, useRef, useState } from 'react';
import styles from './ConfirmDeleteButton.module.css';
import Icon from './icons';
import { useTranslation } from '../i18n/useTranslation';

// how long the "Really delete?" question stays before the button calms down again
const ARMED_MS = 4000;

// A delete that asks once, in place: the first click turns the bin into "Really delete?",
// a second click deletes. Waiting, leaving the button or Escape takes the question back.
// It is the same button the whole time, so the keyboard focus stays on it.
// label: what it deletes, for screen readers ("Delete: Shopping"); confirmText: the question.
// ask: false deletes on the first click, for when onConfirm asks by itself (e.g. what of a repeating task goes).
export default function ConfirmDeleteButton({ onConfirm, label, confirmText, className = '', title, ask = true }) {
    const { t } = useTranslation();
    const [armed, setArmed] = useState(false);
    const timer = useRef(null);

    useEffect(() => () => clearTimeout(timer.current), []);

    const disarm = () => {
        clearTimeout(timer.current);
        setArmed(false);
    };

    const onClick = (e) => {
        e.stopPropagation();
        if (!ask) {
            onConfirm();
            return;
        }
        if (!armed) {
            setArmed(true);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setArmed(false), ARMED_MS);
            return;
        }
        disarm();
        onConfirm();
    };

    const question = confirmText ?? t('confirmDelete');
    return (
        <button type="button" className={`${styles.btn} ${armed ? styles.armed : ''} ${className}`}
            onClick={onClick} onBlur={disarm}
            onKeyDown={(e) => { if (e.key === 'Escape' && armed) { e.preventDefault(); disarm(); } }}
            aria-label={armed ? `${question} ${label}` : label} title={armed ? undefined : (title ?? label)}>
            {armed
                ? <span className={styles.question} aria-hidden="true">{question}</span>
                : <Icon name="trash" className={styles.icon} />}
        </button>
    );
}
