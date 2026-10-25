import styles from './PasswordInput.module.css';
import { useState } from 'react';
import { useTranslation } from '../i18n/useTranslation';
import Icon from './icons';

// A password field with an eye at its end that shows what was typed (and hides it again).
// Takes everything a plain <input> takes; the type is up to the eye.
export default function PasswordInput({ className = '', ...props }) {
    const { t } = useTranslation();
    const [visible, setVisible] = useState(false);
    const label = t(visible ? 'passwordHide' : 'passwordShow');
    return (
        <span className={`${styles.wrap} ${className}`}>
            <input {...props} type={visible ? 'text' : 'password'} className={styles.input}
                autoCapitalize="none" autoCorrect="off" spellCheck={false} />
            <button type="button" className={styles.eye} onClick={() => setVisible(show => !show)}
                aria-label={label} title={label} aria-pressed={visible} aria-controls={props.id}>
                <Icon name={visible ? 'eyeOff' : 'eye'} size={18} />
            </button>
        </span>
    );
}
