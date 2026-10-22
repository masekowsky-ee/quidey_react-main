import styles from './Stats.module.css';
import { useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { hoursText } from '../../features/stats/period';

const HOUR = 3600000;
// tick steps in hours; the smallest that needs at most four lines above zero
const STEPS = [0.25, 0.5, 1, 2, 3, 4, 5, 10, 20, 25, 50, 100, 200, 500, 1000];

function ticksFor(maxMs) {
    const maxHours = maxMs / HOUR;
    const step = STEPS.find(s => Math.ceil(maxHours / s) <= 4) ?? STEPS.at(-1);
    const count = Math.max(1, Math.ceil(maxHours / step));
    return Array.from({ length: count + 1 }, (_, i) => i * step);
}

const tickText = (hours) => (hours < 1 && hours > 0 ? `${Math.round(hours * 60)} min` : `${hours} h`);

// Focus and event time per bucket of the period as stacked columns on one axis (both are
// hours): focus at the bottom, events on top, a gap between them. Hovering or focusing a
// column shows its numbers; the same numbers are in a table below.
// buckets: [{ key, label, longLabel, focus, events }] (ms)
export default function TimeChart({ buckets, labelEvery = 1 }) {
    const { t } = useTranslation();
    const [active, setActive] = useState(null);
    const max = Math.max(0, ...buckets.map(b => b.focus + b.events));
    const ticks = ticksFor(max || HOUR);
    const top = ticks.at(-1) * HOUR;
    const shown = active === null ? null : buckets[active];

    return (
        <div className={styles.chart}>
            <ul className={styles.legend} aria-label={t('statsLegend')}>
                <li><span className={styles.key} data-series="focus" aria-hidden="true" />{t('focusTime')}</li>
                <li><span className={styles.key} data-series="events" aria-hidden="true" />{t('eventTime')}</li>
            </ul>
            <div className={styles.plot} onMouseLeave={() => setActive(null)}>
                <div className={styles.grid} aria-hidden="true">
                    {[...ticks].reverse().map(tick => (
                        <span key={tick} className={styles.gridLine}><span className={styles.tick}>{tickText(tick)}</span></span>
                    ))}
                </div>
                <ol className={styles.columns}>
                    {buckets.map((bucket, i) => {
                        const label = `${bucket.longLabel}: ${t('focusTime')} ${hoursText(bucket.focus)}, ${t('eventTime')} ${hoursText(bucket.events)}`;
                        return (
                            <li key={bucket.key} className={styles.slot} tabIndex={0} aria-label={label}
                                data-active={active === i ? '' : undefined}
                                onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}>
                                <span className={styles.stack}>
                                    {bucket.events > 0 &&
                                        <span className={styles.segment} data-series="events" style={{ height: `${(bucket.events / top) * 100}%` }} />}
                                    {bucket.focus > 0 &&
                                        <span className={styles.segment} data-series="focus" style={{ height: `${(bucket.focus / top) * 100}%` }} />}
                                </span>
                                <span className={styles.xLabel} aria-hidden="true">{i % labelEvery === 0 ? bucket.label : ''}</span>
                            </li>
                        );
                    })}
                </ol>
                {shown &&
                    <div className={styles.tooltip} aria-hidden="true"
                        style={{ '--at': `${((active + 0.5) / buckets.length) * 100}%` }}
                        data-side={active / buckets.length > 0.6 ? 'left' : 'right'}>
                        <strong>{shown.longLabel}</strong>
                        <span><span className={styles.key} data-series="focus" />{t('focusTime')} <b>{hoursText(shown.focus)}</b></span>
                        <span><span className={styles.key} data-series="events" />{t('eventTime')} <b>{hoursText(shown.events)}</b></span>
                    </div>}
            </div>
            <details className={styles.tableToggle}>
                <summary>{t('statsAsTable')}</summary>
                <table className={styles.table}>
                    <thead>
                        <tr><th scope="col">{t('statsPeriodCol')}</th><th scope="col">{t('focusTime')}</th><th scope="col">{t('eventTime')}</th></tr>
                    </thead>
                    <tbody>
                        {buckets.filter(b => b.focus > 0 || b.events > 0).map(bucket => (
                            <tr key={bucket.key}>
                                <th scope="row">{bucket.longLabel}</th>
                                <td>{hoursText(bucket.focus)}</td>
                                <td>{hoursText(bucket.events)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </details>
        </div>
    );
}
