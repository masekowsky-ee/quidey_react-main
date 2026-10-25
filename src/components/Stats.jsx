import styles from './stats/Stats.module.css';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from '../i18n/useTranslation';
import { apiFetch, fill, mondayIndex } from '../features/helperFunction';
import { fetchOwnProfile, profileColorAttr } from '../features/profile/profileOptions';
import { RANGES, hoursText, periodOf, periodQuery, sumByBucket } from '../features/stats/period';
import { TASK_COLORS, groupColorAttr } from '../features/tasks/taskColors';
import ProfileStats from './profile/ProfileStats.jsx';
import CompletedTasks from './CompletedTasks.jsx';
import SessionList from './stats/SessionList.jsx';
import TimeChart from './stats/TimeChart.jsx';
import Icon from './calendar/icons.jsx';
import { Bone, Skeleton } from './skeleton/Skeleton.jsx';

const TABS = ['overview', 'sessions', 'done'];

// The period from the address: ?range=week|month|year|all&offset=-1
function readPeriodParams(params) {
    const range = RANGES.includes(params.get('range')) ? params.get('range') : 'week';
    const offset = range === 'all' ? 0 : Math.min(0, Math.trunc(Number(params.get('offset')) || 0));
    return { range, offset };
}

// "This week", "Last week", "13–19 Oct 2026"; "October 2026"; "2025"; "Everything"
function periodTitle(t, locale, period) {
    const { range, offset } = period;
    if (range === 'all') return t('periodAll');
    if (offset === 0) return t(`periodThis_${range}`);
    if (offset === -1) return t(`periodLast_${range}`);
    return periodDates(locale, period);
}

function periodDates(locale, period) {
    const { range, from, to } = period;
    if (!from) return '';
    if (range === 'week') {
        const sameMonth = from.getMonth() === to.getMonth();
        const start = from.toLocaleDateString(locale, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' });
        return `${start}–${to.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    if (range === 'month') return from.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    return String(from.getFullYear());
}

// The chart's columns for the period, with short and long labels, and how often a label fits
function chartBuckets(t, locale, period, stats) {
    const focus = sumByBucket(period.unit, stats?.focus.days);
    const events = sumByBucket(period.unit, stats?.events.days);
    const buckets = period.buckets.map(({ key, date }) => {
        let label;
        let longLabel;
        if (period.unit === 'day') {
            label = period.range === 'week' ? t('weekDays', mondayIndex(date)).slice(0, 2) : String(date.getDate());
            longLabel = date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
        } else if (period.unit === 'month') {
            const month = date.toLocaleDateString(locale, { month: 'short' });
            label = period.range === 'all' && (date.getMonth() === 0 || key === period.buckets[0].key) ? `${month} ${String(date.getFullYear()).slice(2)}` : month;
            longLabel = date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
        } else {
            label = key;
            longLabel = key;
        }
        return { key, label, longLabel, focus: focus[key] ?? 0, events: events[key] ?? 0 };
    });
    // a label on every column while they fit; otherwise every few (31 days: 1, 6, 11, ...)
    const labelEvery = buckets.length > 16 ? 5 : buckets.length > 12 ? 2 : 1;
    return { buckets, labelEvery };
}

// Horizontal bars, longest = full width: label (with a dot in its colour), bar, value
function Bars({ rows, empty }) {
    const max = Math.max(0, ...rows.map(r => r.ms));
    if (rows.length === 0) return <p className={styles.empty}>{empty}</p>;
    return (
        <ul className={styles.bars}>
            {rows.map(row => (
                <li key={row.key} className={styles.bar} data-task-color={row.color}>
                    <span className={styles.barLabel}>
                        <span className={styles.barDot} aria-hidden="true" data-none={row.color ? undefined : ''} />
                        <span className={styles.barName}>{row.label}</span>
                    </span>
                    <span className={styles.barTrack} aria-hidden="true">
                        <span className={styles.barFill} data-none={row.color ? undefined : ''} style={{ width: `${max > 0 ? (row.ms / max) * 100 : 0}%` }} />
                    </span>
                    <span className={styles.barValue}>
                        {hoursText(row.ms)}
                        {row.note && <small>{row.note}</small>}
                    </span>
                </li>
            ))}
        </ul>
    );
}

// Overview of a period: numbers, time per day/month, time per event type, focus per group
function Overview({ period, stats, error, t, locale }) {
    if (error) return <p className={`${styles.card} ${styles.empty}`} role="alert">{t('statsLoadError')}</p>;
    if (!stats) {
        return (
            <Skeleton style={{ display: 'contents' }}>
                <div className={styles.tiles}>
                    {[0, 1, 2, 3].map(i => (
                        <div key={i} className={styles.tile}><Bone w="60%" h="0.8125rem" /><Bone w="3.5rem" h="1.375rem" style={{ marginTop: '0.3rem' }} /></div>
                    ))}
                </div>
                <section className={styles.card}>
                    <Bone w="9rem" h="1.1rem" />
                    <Bone w="100%" h="12rem" style={{ marginTop: '1rem' }} />
                </section>
                <div className={styles.twoCols}>
                    {[0, 1].map(i => (
                        <section key={i} className={styles.card}>
                            <Bone w="7rem" h="1.1rem" />
                            {['80%', '55%', '35%'].map(w => <Bone key={w} w={w} h="0.75rem" style={{ marginTop: '0.9rem' }} />)}
                        </section>
                    ))}
                </div>
            </Skeleton>
        );
    }
    const { buckets, labelEvery } = chartBuckets(t, locale, period, stats);
    const typeRows = stats.events.types.map(type => ({
        key: type.id ?? 'none',
        label: type.name ?? t('eventTypeNone'),
        color: TASK_COLORS.includes(type.color) ? type.color : undefined,
        ms: type.ms,
        note: fill(t(type.count === 1 ? 'eventCountOne' : 'eventCount'), { n: type.count }),
    }));
    const groupRows = stats.groups.map(group => ({ key: group.name, label: group.name, color: groupColorAttr(group), ms: group.ms }));

    return (
        <>
            <dl className={styles.tiles}>
                <div className={styles.tile}><dt>{t('focusTime')}</dt><dd>{hoursText(stats.focus.ms)}</dd></div>
                <div className={styles.tile}><dt>{t('eventTime')}</dt><dd>{hoursText(stats.events.ms)}</dd></div>
                <div className={styles.tile}><dt>{t('sessions')}</dt><dd>{stats.focus.sessions}</dd></div>
                <div className={styles.tile}><dt>{t('statTasksDone')}</dt><dd>{stats.tasksDone}</dd></div>
            </dl>

            <section className={styles.card} aria-labelledby="stats-time">
                <h2 id="stats-time" className={styles.cardTitle}>{t('statsTimeTitle')}</h2>
                {stats.focus.ms + stats.events.ms > 0
                    ? <TimeChart buckets={buckets} labelEvery={labelEvery} />
                    : <p className={styles.empty}>{t('statsNothingInPeriod')}</p>}
            </section>

            <div className={styles.twoCols}>
                <section className={styles.card} aria-labelledby="stats-types">
                    <h2 id="stats-types" className={styles.cardTitle}>{t('statsByType')}</h2>
                    <Bars rows={typeRows} empty={t('statsNoEvents')} />
                    <Link to="/settings#event-types" className={styles.cardLink}>{t('eventTypesManage')}</Link>
                </section>
                <section className={styles.card} aria-labelledby="stats-groups">
                    <h2 id="stats-groups" className={styles.cardTitle}>{t('statsByGroup')}</h2>
                    <Bars rows={groupRows} empty={t('statsNoGroups')} />
                </section>
            </div>
        </>
    );
}

// Statistics (formerly the history): what I did in a week, month, year or ever, stepped back
// with the arrows: focus and event time (per day, per event type, per group), my sessions and
// completed tasks; below the overview my activity of all time (heat map, streaks, badges).
// The period and tab are in the address, so a view can be bookmarked.
export default function Stats() {
    const { t, language } = useTranslation();
    const locale = language === 'de' ? 'de-DE' : 'en-GB';
    const [params, setParams] = useSearchParams();
    const tab = TABS.includes(params.get('tab')) ? params.get('tab') : 'overview';
    const { range, offset } = readPeriodParams(params);
    const sessionCount = useSelector(state => state.session.workedSessionData.length);

    const [stats, setStats] = useState({ query: null, data: null, error: false });
    const basePeriod = periodOf(range, offset);
    const query = periodQuery(basePeriod);
    const period = range === 'all' && stats.query === query ? periodOf('all', 0, new Date(), stats.data?.firstDay) : basePeriod;

    // the period's numbers, again when a session was saved or the period changes
    useEffect(() => {
        let current = true;
        apiFetch(`/api/stats${query}`)
            .then(data => { if (current) setStats({ query, data, error: false }); })
            .catch(() => { if (current) setStats({ query, data: null, error: true }); });
        return () => { current = false; };
    }, [query, sessionCount]);
    const shownStats = stats.query === query ? stats : { data: null, error: false };

    // my activity of all time (the same numbers friends may see on my profile)
    const [profile, setProfile] = useState(null);
    useEffect(() => {
        let current = true;
        fetchOwnProfile().then(data => { if (current) setProfile(data); }).catch(() => {});
        return () => { current = false; };
    }, [sessionCount]);

    const update = (changes) => {
        const next = new URLSearchParams(params);
        for (const [key, value] of Object.entries(changes)) {
            if (value === null || value === undefined || value === '' || (key === 'offset' && value === 0) || (key === 'tab' && value === 'overview') || (key === 'range' && value === 'week')) next.delete(key);
            else next.set(key, String(value));
        }
        setParams(next, { replace: true });
    };

    const title = periodTitle(t, locale, period);
    const dates = period.from && offset > -2 ? periodDates(locale, period) : '';

    return (
        <div className={styles.page}>
            <h1 className={styles.title}>{t('history')}</h1>

            <div className={styles.tabs} role="tablist" aria-label={t('history')}>
                {TABS.map(name => (
                    <button key={name} role="tab" aria-selected={tab === name} className={tab === name ? styles.tabActive : undefined}
                        onClick={() => update({ tab: name })}>
                        {t(`statsTab_${name}`)}
                    </button>
                ))}
            </div>

            {tab !== 'done' &&
                <div className={styles.periodBar}>
                    <div className={styles.ranges} role="radiogroup" aria-label={t('statsPeriod')}>
                        {RANGES.map(name => (
                            <button key={name} type="button" role="radio" aria-checked={range === name}
                                className={range === name ? styles.rangeActive : undefined}
                                onClick={() => update({ range: name, offset: 0 })}>
                                {t(`range_${name}`)}
                            </button>
                        ))}
                    </div>
                    <div className={styles.stepper}>
                        <button type="button" className={styles.stepBtn} disabled={range === 'all'}
                            onClick={() => update({ offset: offset - 1 })} aria-label={t('periodPrevious')} title={t('periodPrevious')}>
                            <Icon name="prev" size={20} />
                        </button>
                        <p className={styles.periodName} aria-live="polite">
                            <strong>{title}</strong>
                            {dates && <span>{dates}</span>}
                        </p>
                        <button type="button" className={styles.stepBtn} disabled={range === 'all' || offset >= 0}
                            onClick={() => update({ offset: offset + 1 })} aria-label={t('periodNext')} title={t('periodNext')}>
                            <Icon name="next" size={20} />
                        </button>
                    </div>
                </div>}

            {tab === 'overview' &&
                <>
                    <Overview period={period} stats={shownStats.data} error={shownStats.error} t={t} locale={locale} />
                    {profile?.stats &&
                        <ProfileStats stats={profile.stats} title={t('statsActivity')} colorAttr={profileColorAttr(profile)} />}
                </>}
            {tab === 'sessions' && <SessionList period={period} />}
            {tab === 'done' && <CompletedTasks />}
        </div>
    );
}
