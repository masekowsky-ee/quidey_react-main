import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './Header.module.css';
import { useTranslation } from '../i18n/useTranslation';
import { lineOfDay } from '../features/fun/dailyLines';

// Secret marker: the fun page only opens when reached through this link
const FUN_PAGE_STATE = { fromTicker: true };

// Today's fact, quote or slogan, tucked away behind a small bulb in the header: a tap shows it,
// and the line itself leads to the hidden fun page.
export default function DailyTicker() {
    const { t, language } = useTranslation();
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);
    const line = lineOfDay();
    const text = line[language] ?? line.en;
    const label = t(`lineOf_${line.type}`);

    // closes on a click elsewhere and on Escape
    useEffect(() => {
        if (!open) return;
        const onDown = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('pointerdown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return (
        <div className={styles.lineWrap} ref={wrapRef}>
            <button
                type="button"
                className={`${styles.lineBtn} ${open ? styles.lineBtnOpen : ''}`}
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-label={label}
                title={label}
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-80q-33 0-56.5-23.5T400-160h160q0 33-23.5 56.5T480-80ZM360-200q-17 0-28.5-11.5T320-240q0-17 11.5-28.5T360-280h240q17 0 28.5 11.5T640-240q0 17-11.5 28.5T600-200H360Zm-30-120q-69-41-109.5-110T180-580q0-125 87.5-212.5T480-880q125 0 212.5 87.5T780-580q0 81-40.5 150T630-320H330Zm24-80h252q45-32 69.5-79T720-580q0-100-70-170t-170-70q-100 0-170 70t-70 170q0 54 24.5 101t69.5 79Zm126 0Z"/></svg>
            </button>
            {open && (
                <Link
                    to="/fun"
                    state={FUN_PAGE_STATE}
                    className={styles.linePopover}
                    title={t('tickerHint')}
                    aria-label={`${label}: ${text}`}
                    onClick={() => setOpen(false)}
                >
                    <span className={styles.lineLabel}>{label}</span>
                    <span className={styles.lineText}>{text}</span>
                </Link>
            )}
        </div>
    );
}
