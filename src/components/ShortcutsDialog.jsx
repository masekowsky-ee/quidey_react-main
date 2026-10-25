import styles from './ShortcutsDialog.module.css';
import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../i18n/useTranslation';
import { OPEN_SHORTCUTS_EVENT, SHORTCUTS, useKeyboardShortcuts } from '../features/shortcuts/shortcuts';
import Icon from './icons';

// The keyboard shortcuts (features/shortcuts/shortcuts.js) and their overview: "?" or the
// command bar opens it, Escape, the cross or a click next to it closes it.
export default function ShortcutsDialog() {
    useKeyboardShortcuts();
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const show = () => setOpen(true);
        window.addEventListener(OPEN_SHORTCUTS_EVENT, show);
        return () => window.removeEventListener(OPEN_SHORTCUTS_EVENT, show);
    }, []);

    if (!open) return null;
    return <Overview onClose={() => setOpen(false)} />;
}

function Overview({ onClose }) {
    const { t } = useTranslation();
    const titleId = useId();
    const closeRef = useRef(null);

    useEffect(() => {
        const previous = document.activeElement;
        closeRef.current?.focus();
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            e.preventDefault();
            onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            previous?.focus?.();
        };
    }, [onClose]);

    return createPortal(
        <div className={styles.backdrop} onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId}>
                <div className={styles.head}>
                    <h2 id={titleId} className={styles.title}>{t('shortcutsTitle')}</h2>
                    <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label={t('close')}>
                        <Icon name="close" size={18} />
                    </button>
                </div>
                <p className={styles.intro}>{t('shortcutsIntro')}</p>
                <dl className={styles.list}>
                    {SHORTCUTS.map(({ keys, label }) => (
                        <div key={label} className={styles.row}>
                            <dt className={styles.keys}>
                                {keys.map((key, i) => (
                                    <Fragment key={key}>
                                        {i > 0 && <span className={styles.then}>{t('shortcutsThen')}</span>}
                                        <kbd className={styles.kbd}>{key}</kbd>
                                    </Fragment>
                                ))}
                            </dt>
                            <dd className={styles.label}>{t(label)}</dd>
                        </div>
                    ))}
                    <div className={styles.row}>
                        <dt className={styles.keys}><kbd className={styles.kbd}>{t('commandShortcut')}</kbd></dt>
                        <dd className={styles.label}>{t('commandOpen')}</dd>
                    </div>
                </dl>
                <p className={styles.tip}>{t('quickAddTip')}</p>
            </div>
        </div>,
        document.body
    );
}
