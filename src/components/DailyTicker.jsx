import { Link } from 'react-router-dom';
import styles from './Header.module.css';
import { useTranslation } from '../i18n/useTranslation';
import { lineOfDay } from '../features/fun/dailyLines';

// Secret marker: the fun page only opens when reached through this link
const FUN_PAGE_STATE = { fromTicker: true };

// The strip under the header: today's fact, quote or slogan scrolling by.
// Clicking it leads to the hidden fun page.
export default function DailyTicker() {
    const { t, language } = useTranslation();
    const line = lineOfDay();
    const text = line[language] ?? line.en;
    const label = t(`lineOf_${line.type}`);
    // about the same speed for short and long lines
    const duration = `${Math.max(16, Math.round(text.length * 0.22))}s`;

    return (
        <Link
            to="/fun"
            state={FUN_PAGE_STATE}
            className={styles.ticker}
            title={t('tickerHint')}
            aria-label={`${label}: ${text}`}
        >
            <span className={styles.tickerLabel}>{label}</span>
            <span className={styles.tickerWindow} aria-hidden="true">
                <span className={styles.tickerTrack} style={{ '--ticker-duration': duration }}>
                    {/* two copies, so the loop wraps around without a jump */}
                    <span className={styles.tickerItem}>{text}</span>
                    <span className={styles.tickerItem}>{text}</span>
                </span>
            </span>
        </Link>
    );
}
