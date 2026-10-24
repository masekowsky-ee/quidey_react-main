import styles from './DurationWheel.module.css';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { durationText } from '../../features/calendar/calendar';

import Icon from '../icons';
// height of one number in a wheel (the same as --wheel-item in the css)
const ITEM_PX = 36;
// how long the wheel has to be still before the number under the band counts
const SETTLE_MS = 120;
const QUICK = [15, 30, 60, 120, 240, 480];

// One column of the wheel: the numbers min..max scroll past a band in the middle and snap to
// it; the one in the band is the value. Also a spin button for the keyboard (arrows, Page
// Up/Down, Home/End) and a click on a number picks it.
function Wheel({ value, max, onChange, label, unit, pad = false }) {
    const ref = useRef(null);
    const settle = useRef(null);
    // the number the wheel was last turned to, so a value it set itself doesn't scroll it again
    const shown = useRef(value);
    const items = Array.from({ length: max + 1 }, (_, i) => i);
    const text = (n) => (pad ? String(n).padStart(2, '0') : String(n));

    const scrollTo = (n, smooth) => {
        const el = ref.current;
        if (!el) return;
        shown.current = n;
        if (el.scrollTo) el.scrollTo({ top: n * ITEM_PX, behavior: smooth ? 'smooth' : 'auto' });
        else el.scrollTop = n * ITEM_PX;
    };

    // the value changed from outside (a quick pick, opening): turn the wheel to it
    useEffect(() => {
        if (shown.current !== value || ref.current?.scrollTop === 0) scrollTo(value, shown.current !== value);
        // only when the value changes
    }, [value]);

    useEffect(() => () => clearTimeout(settle.current), []);

    const onScroll = () => {
        clearTimeout(settle.current);
        settle.current = setTimeout(() => {
            const el = ref.current;
            if (!el) return;
            const n = Math.min(max, Math.max(0, Math.round(el.scrollTop / ITEM_PX)));
            shown.current = n;
            if (n !== value) onChange(n);
        }, SETTLE_MS);
    };

    const step = (n) => {
        const next = Math.min(max, Math.max(0, n));
        if (next === value) return;
        scrollTo(next, true);
        onChange(next);
    };

    const onKeyDown = (e) => {
        const moves = { ArrowUp: -1, ArrowDown: 1, PageUp: -5, PageDown: 5 };
        if (e.key in moves) step(value + moves[e.key]);
        else if (e.key === 'Home') step(0);
        else if (e.key === 'End') step(max);
        else return;
        e.preventDefault();
    };

    return (
        <div className={styles.column}>
            <div ref={ref} className={styles.wheel} onScroll={onScroll} onKeyDown={onKeyDown} tabIndex={0}
                role="spinbutton" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}
                aria-valuetext={`${value} ${unit}`}>
                <ul className={styles.items} aria-hidden="true">
                    {items.map(n => (
                        <li key={n} className={n === value ? styles.itemOn : styles.item} onClick={() => step(n)}>{text(n)}</li>
                    ))}
                </ul>
            </div>
            <span className={styles.unit} aria-hidden="true">{unit}</span>
        </div>
    );
}

// A length of time on two wheels, hours and minutes, every minute possible, with quick picks
// below. value: minutes or null (none); onChange(minutes | null): 0 h 0 min is none.
// maxHours: how far the hours go (an event can last up to a week).
export function DurationWheel({ value, onChange, maxHours = 99, label }) {
    const { t } = useTranslation();
    const total = Number(value) || 0;
    const hours = Math.min(maxHours, Math.floor(total / 60));
    const minutes = total % 60;
    const set = (h, m) => {
        const next = h * 60 + m;
        onChange(next > 0 ? next : null);
    };

    return (
        <div className={styles.picker}>
            <div className={styles.wheels} role="group" aria-label={label}>
                <Wheel value={hours} max={maxHours} onChange={(h) => set(h, minutes)} label={`${label}: ${t('hours')}`} unit="h" />
                <Wheel value={minutes} max={59} onChange={(m) => set(hours, m)} label={`${label}: ${t('minutes')}`} unit="min" pad />
            </div>
            <div className={styles.quick}>
                {QUICK.filter(m => m <= maxHours * 60 + 59).map(m => (
                    <button key={m} type="button" className={total === m ? styles.quickOn : styles.quickBtn}
                        aria-pressed={total === m} onClick={() => onChange(m)}>
                        {durationText(m)}
                    </button>
                ))}
            </div>
        </div>
    );
}

// A labelled field for a length of time: shows the value ("1 h 30 min", or "–") and opens the
// wheels below it on a click. hint: a line under the value (e.g. "until 17:30").
export default function DurationField({ label, value, onChange, maxHours, hint, noneText }) {
    const { t } = useTranslation();
    const id = useId();
    const [open, setOpen] = useState(false);
    const has = Number(value) > 0;

    return (
        <div className={styles.field}>
            <span className={styles.label} id={`${id}-label`}>{label}</span>
            <div className={styles.row}>
                <button type="button" className={styles.value} aria-expanded={open} aria-controls={`${id}-wheel`}
                    aria-describedby={`${id}-label`} onClick={() => setOpen(!open)}>
                    <span className={has ? undefined : styles.none}>{has ? durationText(value) : (noneText ?? t('durationNone'))}</span>
                    <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} aria-hidden="true"><Icon name="chevronDown" size={16} /></span>
                </button>
                {has &&
                    <button type="button" className={styles.clear} onClick={() => onChange(null)}
                        aria-label={`${label}: ${t('durationClear')}`} title={t('durationClear')}>×</button>}
            </div>
            {hint && <small className={styles.hint}>{hint}</small>}
            {open &&
                <div id={`${id}-wheel`} className={styles.popout}>
                    <DurationWheel value={value} onChange={onChange} maxHours={maxHours} label={label} />
                </div>}
        </div>
    );
}
