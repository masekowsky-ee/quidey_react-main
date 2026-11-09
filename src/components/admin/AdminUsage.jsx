import styles from './AdminUsage.module.css';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { fill } from '../../features/helperFunction';
import { showToast } from '../../features/toast/toast';
import { adminErrorText, fetchAdminUsage, fetchAdminUsageRaw, usageQuery } from '../../features/admin/adminAction';
import { downloadCsv, downloadXlsx } from '../../features/admin/exportTable';
import { HEAT_METRICS, SHEET_IDS, SPLIT_KEYS, fileSlug, heatGrid, metricLabel, sortedFeatures, usageSheets } from '../../features/admin/usageSheets';
import { Bone, Skeleton, SkeletonRows } from '../skeleton/Skeleton.jsx';
import Icon from '../icons.jsx';

// Admin → Nutzung: anonymous usage totals of the people who agreed (spec § 5). Sums of daily people
// are person-days, of hourly people person-hours; a split by platform / language / plan puts each
// person under the dimensions of their first event that day, so only the totals are exact.

const FIRST_DAY = '2026-11-01'; // counting started here: "Alles"
const RANGES = ['7', '30', '90', 'year', 'all', 'custom'];
const FILTERS = {
    platform: ['web', 'pwa', 'android'],
    language: ['de', 'en'],
    plan: ['free', 'tester', 'pro'],
};

const pad = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (iso, n) => { const d = parseDay(iso); d.setDate(d.getDate() + n); return isoDay(d); };

function presetRange(preset, today) {
    if (preset === 'all') return { from: FIRST_DAY < today ? FIRST_DAY : today, to: today };
    const days = preset === 'year' ? 365 : Number(preset);
    return { from: addDays(today, -(days - 1)), to: today };
}

// A y scale with at most four steps above zero
const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000];
function scaleFor(max) {
    const step = STEPS.find(s => Math.ceil(max / s) <= 4) ?? Math.ceil(max / 4);
    const count = Math.max(1, Math.ceil(max / step));
    return { top: count * step, ticks: Array.from({ length: count + 1 }, (_, i) => i * step) };
}

// a filter value as people read it ("android" → "Android", "de" → "Deutsch"); an unknown one stays raw
function optionLabel(t, key, value) {
    if (key === 'platform') return { web: 'Web', pwa: 'PWA', android: 'Android' }[value] ?? value;
    const textKey = key === 'language' ? `adminUsageLang_${value}` : `adminUsagePlan_${value}`;
    return t(textKey) === textKey ? value : t(textKey);
}

function Heatmap({ cells, metric, t }) {
    const grid = heatGrid(cells);
    const max = Math.max(0, ...grid.flat().map(c => c.people));
    const share = (people) => (people > 0 && max > 0 ? `${Math.max(8, Math.round((people / max) * 100))}%` : '0%');
    const day = (d) => t('weekDays', d);
    const metricName = t(`adminUsageMetric_${metric}`);
    return (
        <>
            {/* focusable so a keyboard can scroll it sideways on a phone; the numbers are in the table below */}
            <div className={styles.heatScroll} tabIndex={0} role="region" aria-label={fill(t('adminUsageHeatGrid'), { metric: metricName })}>
                <div className={styles.heat} aria-hidden="true">
                    <span />
                    {Array.from({ length: 24 }, (_, h) => <span key={h} className={styles.heatHour}>{h % 3 === 0 ? h : ''}</span>)}
                    {grid.map((hours, d) => [
                        <span key={`d${d}`} className={styles.heatDay}>{day(d)}</span>,
                        ...hours.map((cell, h) => (
                            <span key={`${d}-${h}`} data-heat-cell="" className={styles.cell} style={{ '--share': share(cell.people) }}
                                title={fill(t('adminUsageCellTitle'), { day: day(d), hour: h, people: cell.people, events: cell.events })} />
                        )),
                    ])}
                </div>
            </div>
            <p className={styles.scale}>
                <span className={styles.scaleBar} aria-hidden="true" />
                {fill(t('adminUsageScaleMax'), { max })}
            </p>
            <details className={styles.tableToggle}>
                <summary>{t('statsAsTable')}</summary>
                <div className={styles.tableScroll}>
                    <table className={`${styles.table} ${styles.heatTable}`}>
                        <caption className={styles.srOnly}>{fill(t('adminUsageHeatCaption'), { metric: metricName })}</caption>
                        <thead>
                            <tr><th scope="col">{t('adminUsageWeekday')}</th>{Array.from({ length: 24 }, (_, h) => <th key={h} scope="col">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                            {grid.map((hours, d) => (
                                <tr key={d}><th scope="row">{day(d)}</th>{hours.map((cell, h) => <td key={h}>{cell.people}</td>)}</tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </details>
        </>
    );
}

function DailyChart({ daily, weekly, t, num, dayLabel }) {
    const n = daily.length;
    const { top, ticks } = scaleFor(Math.max(1, ...daily.map(d => Math.max(d.active, d.tasksDone))));
    const width = Math.max(1, n - 1);
    const x = (i) => (n === 1 ? width / 2 : i);
    const y = (v) => 100 - (v / top) * 100;
    const line = (key) => (n === 1
        ? `0,${y(daily[0][key])} ${width},${y(daily[0][key])}`
        : daily.map((d, i) => `${x(i)},${y(d[key])}`).join(' '));
    const middle = daily[Math.floor((n - 1) / 2)];
    return (
        <>
            <div className={styles.chart}>
                {ticks.map(tick => <span key={tick} className={styles.yTick} style={{ top: `${y(tick)}%` }} aria-hidden="true">{num(tick)}</span>)}
                <svg viewBox={`0 0 ${width} 100`} preserveAspectRatio="none" role="img"
                    aria-label={fill(t('adminUsageChartLabel'), { from: dayLabel(daily[0].date), to: dayLabel(daily[n - 1].date) })}>
                    {ticks.map(tick => <line key={tick} className={styles.gridLine} x1="0" x2={width} y1={y(tick)} y2={y(tick)} vectorEffect="non-scaling-stroke" />)}
                    <polyline className={styles.lineDone} points={line('tasksDone')} vectorEffect="non-scaling-stroke" />
                    <polyline className={styles.lineActive} points={line('active')} vectorEffect="non-scaling-stroke" />
                    {daily.map((d, i) => (
                        <rect key={d.date} className={styles.hit} x={n === 1 ? 0 : i - 0.5} width={n === 1 ? width : 1} y="0" height="100">
                            <title>{fill(t('adminUsageDayTitle'), { date: dayLabel(d.date), active: num(d.active), done: num(d.tasksDone) })}</title>
                        </rect>
                    ))}
                </svg>
            </div>
            <div className={styles.xAxis} aria-hidden="true">
                <span>{dayLabel(daily[0].date)}</span>
                {n > 2 && <span>{dayLabel(middle.date)}</span>}
                {n > 1 && <span>{dayLabel(daily[n - 1].date)}</span>}
            </div>
            <details className={styles.tableToggle}>
                <summary>{t('statsAsTable')}</summary>
                <div className={styles.tableScroll}>
                    <table className={styles.table}>
                        <caption className={styles.srOnly}>{t('adminUsageDaily')}</caption>
                        <thead>
                            <tr>
                                <th scope="col">{t('adminUsageDay')}</th><th scope="col">{t('adminUsageActivePeople')}</th>
                                <th scope="col">{t('adminUsageTasksCreated')}</th><th scope="col">{t('adminUsageTasksDone')}</th>
                                <th scope="col">{t('adminUsageFocusMinutes')}</th><th scope="col">{t('adminUsageActiveMinutes')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {daily.map(d => (
                                <tr key={d.date}>
                                    <th scope="row">{dayLabel(d.date)}</th><td>{num(d.active)}</td><td>{num(d.tasksCreated)}</td>
                                    <td>{num(d.tasksDone)}</td><td>{num(d.focusMinutes)}</td><td>{num(d.activeMinutesPerPerson)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {weekly.length > 0 && (
                    <table className={`${styles.table} ${styles.weekly}`}>
                        <caption>{t('adminUsageWeekly')}</caption>
                        <thead><tr><th scope="col">{t('adminUsageWeekOf')}</th><th scope="col">{t('adminUsageActivePeople')}</th></tr></thead>
                        <tbody>
                            {weekly.map(w => <tr key={w.weekStart}><th scope="row">{dayLabel(w.weekStart)}</th><td>{num(w.active)}</td></tr>)}
                        </tbody>
                    </table>
                )}
            </details>
        </>
    );
}

function Spark({ values }) {
    const max = Math.max(1, ...values);
    const points = values.map((v, i) => `${i},${10 - (v / max) * 10}`).join(' ');
    return (
        <svg className={styles.spark} viewBox={`0 0 ${Math.max(1, values.length - 1)} 10`} preserveAspectRatio="none" aria-hidden="true">
            <title>{values.join(', ')}</title>
            <polyline className={styles.lineActive} points={points} vectorEffect="non-scaling-stroke" />
        </svg>
    );
}

function UsageSkeleton() {
    return (
        <Skeleton className={styles.results}>
            <div className={styles.stats}>
                {[0, 1, 2, 3, 4, 5].map(i => (
                    <div key={i} className={styles.stat}><Bone w="2.5rem" h="1.6rem" /><Bone w="60%" h="0.8rem" style={{ marginTop: '0.35rem' }} /></div>
                ))}
            </div>
            <section className={styles.card}><Bone w="8rem" h="1.1rem" /><Bone w="100%" h="11rem" style={{ marginTop: '1rem' }} /></section>
            <section className={styles.card}><Bone w="6rem" h="1.1rem" /><SkeletonRows count={4} avatar={false} /></section>
        </Skeleton>
    );
}

export default function AdminUsage() {
    const { t, language } = useTranslation();
    const dispatch = useDispatch();
    const locale = language === 'de' ? 'de-DE' : 'en-GB';
    const numberFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    const num = (value) => numberFormat.format(value ?? 0);
    const dayLabel = (iso) => parseDay(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

    const today = isoDay(new Date());
    const [preset, setPreset] = useState('30');
    const [custom, setCustom] = useState(null);
    const [filters, setFilters] = useState({ platform: '', language: '', plan: '' });
    const [heatMetric, setHeatMetric] = useState('active');
    const [csvOpen, setCsvOpen] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [retry, setRetry] = useState(0);
    // the last answer: { query, params, data } (data stays while another range loads), error on failure
    const [loaded, setLoaded] = useState({ query: null, params: null, data: null, error: null });

    const range = preset === 'custom' ? custom : presetRange(preset, today);
    const valid = Boolean(range.from && range.to && range.from <= range.to);
    const params = { from: range.from, to: range.to, ...filters };
    const query = usageQuery(params);
    const loading = valid && loaded.query !== query;
    // the answer for this very query failed: the numbers shown (if any) are older, a retry asks again
    const failed = valid && loaded.query === query && Boolean(loaded.error);
    // what is shown isn't for the current controls: loading, failed, or the range is invalid
    const stale = Boolean(loaded.data) && !(valid && loaded.query === query && !loaded.error);
    const tryAgain = () => { setLoaded(prev => ({ ...prev, query: null, error: null })); setRetry(n => n + 1); };

    useEffect(() => {
        if (!valid) return undefined;
        let cancelled = false;
        dispatch(fetchAdminUsage(params))
            .then(data => { if (!cancelled) setLoaded({ query, params, data, error: null }); })
            .catch(error => {
                if (cancelled) return;
                setLoaded(prev => ({ ...prev, query, error }));
                dispatch(showToast(adminErrorText(t, error), 'error'));
            });
        return () => { cancelled = true; };
    // params is rebuilt every render, query says the same; t only changes with the language
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, query, valid, retry]);

    const pickRange = (key) => {
        if (key === 'custom' && preset !== 'custom') setCustom(range);
        setPreset(key);
    };

    const data = loaded.data;
    const report = data && { ...data, filters: loaded.params };
    const fileRange = data ? `${data.range.from}_${data.range.to}` : '';

    // the raw rows are only fetched for an export that needs them
    const download = async (id) => {
        setCsvOpen(false);
        setExporting(true);
        try {
            const raw = id === 'xlsx' || id === 'raw' ? await dispatch(fetchAdminUsageRaw(loaded.params)) : null;
            const sheets = usageSheets(report, raw, t);
            if (id === 'xlsx') {
                await downloadXlsx(sheets, `quidey-nutzung_${fileRange}.xlsx`);
            } else {
                const sheet = sheets[SHEET_IDS.indexOf(id)];
                downloadCsv(sheet, language, `quidey-nutzung-${fileSlug(sheet.name)}_${fileRange}.csv`);
            }
        } catch (err) {
            dispatch(showToast(adminErrorText(t, err), 'error'));
        } finally {
            setExporting(false);
        }
    };

    const features = data ? sortedFeatures(data.features) : [];
    const hasSplits = data && SPLIT_KEYS.some(key => data.splits?.[key]?.length > 0);
    const summary = data?.summary;

    return (
        <div className={styles.panel} role="tabpanel" aria-label={t('adminUsage')}>
            <section className={styles.card}>
                <div className={styles.cardHead}>
                    <h2 className={styles.cardTitle}>{t('adminUsage')}</h2>
                    <div className={styles.exports} role="group" aria-label={t('adminUsageExport')}>
                        <button type="button" className={styles.exportBtn} disabled={!data || exporting} onClick={() => download('xlsx')}>
                            <Icon name="download" size={16} />{t('adminUsageExcel')}
                        </button>
                        <button type="button" className={styles.exportBtn} disabled={!data || exporting} aria-expanded={csvOpen}
                            aria-controls="usage-csv-menu" onClick={() => setCsvOpen(open => !open)}>
                            {t('adminUsageCsv')}<Icon name="chevronDown" size={16} />
                        </button>
                    </div>
                </div>
                {csvOpen && (
                    <div id="usage-csv-menu" className={styles.csvMenu} role="group" aria-labelledby="usage-csv-pick">
                        <span id="usage-csv-pick">{t('adminUsageCsvPick')}</span>
                        {SHEET_IDS.map(id => (
                            <button key={id} type="button" disabled={exporting} onClick={() => download(id)}>{t(`adminUsageSheet_${id}`)}</button>
                        ))}
                    </div>
                )}
                <div className={styles.controls}>
                    <div className={styles.range} role="group" aria-label={t('adminUsageRange')}>
                        {RANGES.map(key => (
                            <button key={key} type="button" className={preset === key ? styles.segmentActive : undefined} aria-pressed={preset === key}
                                onClick={() => pickRange(key)}>
                                {key === 'year' ? t('adminUsageYear') : key === 'all' ? t('adminUsageAll') : key === 'custom' ? t('adminUsageCustom')
                                    : fill(t('adminUsageDays'), { count: key })}
                            </button>
                        ))}
                    </div>
                    {preset === 'custom' && (
                        <div className={styles.fields}>
                            <label className={styles.field}>
                                <span>{t('adminUsageFrom')}</span>
                                <input type="date" value={custom.from} max={custom.to || today} required
                                    onChange={(e) => setCustom(c => ({ ...c, from: e.target.value }))} />
                            </label>
                            <label className={styles.field}>
                                <span>{t('adminUsageTo')}</span>
                                <input type="date" value={custom.to} min={custom.from || undefined} max={today} required
                                    onChange={(e) => setCustom(c => ({ ...c, to: e.target.value }))} />
                            </label>
                        </div>
                    )}
                    <div className={styles.fields} role="group" aria-label={t('adminUsageFilters')}>
                        {Object.entries(FILTERS).map(([key, values]) => (
                            <label key={key} className={styles.field}>
                                <span>{t({ platform: 'adminUsagePlatform', language: 'adminUsageLanguage', plan: 'adminUsagePlan' }[key])}</span>
                                <select value={filters[key]} onChange={(e) => setFilters(f => ({ ...f, [key]: e.target.value }))}>
                                    <option value="">{t('adminUsageAllValues')}</option>
                                    {values.map(value => <option key={value} value={value}>{optionLabel(t, key, value)}</option>)}
                                </select>
                            </label>
                        ))}
                    </div>
                </div>
                <p className={styles.note}>{t('adminUsageNote')}</p>
            </section>

            {(!valid || failed) && (
                <div className={styles.notice} role="status">
                    <p>
                        {t(valid ? 'adminUsageLoadFailed' : 'adminUsageRangeInvalid')}
                        {data && ` ${t('adminUsageStaleNote')}`}
                    </p>
                    {failed && <button type="button" className={styles.exportBtn} onClick={tryAgain}>{t('adminUsageRetry')}</button>}
                </div>
            )}

            {!data ? (
                valid && !failed && <UsageSkeleton />
            ) : (
                // data-stale dims numbers that aren't for the current controls (see the notice above, or
                // still loading); aria-busy only while a request is out
                <div className={styles.results} aria-busy={loading || undefined} data-stale={stale || undefined}>
                    <div className={styles.stats}>
                        <div className={styles.stat}>
                            <span className={styles.statValue}>{num(summary.activeToday)}</span>
                            <span className={styles.statLabel}>{t('adminUsageActiveToday')}</span>
                        </div>
                        <div className={styles.stat}>
                            <span className={styles.statValue}>{num(summary.activeThisWeek)}</span>
                            <span className={styles.statLabel}>{t('adminUsageActiveWeek')}</span>
                        </div>
                        <div className={styles.stat}>
                            <span className={styles.statValue}>{num(summary.avgActivePerDay)}</span>
                            <span className={styles.statLabel}>{t('adminUsageAvgPerDay')}</span>
                        </div>
                        <div className={styles.stat}>
                            <span className={styles.statValue}>{summary.busiestDay ? num(summary.busiestDay.people) : '–'}</span>
                            <span className={styles.statLabel}>
                                {summary.busiestDay ? fill(t('adminUsageBusiestDayOn'), { date: dayLabel(summary.busiestDay.date) }) : t('adminUsageBusiestDay')}
                            </span>
                        </div>
                        <div className={styles.stat}>
                            <span className={styles.statValue}>{num(summary.focusHours)}</span>
                            <span className={styles.statLabel}>{t('adminUsageFocusHours')}</span>
                        </div>
                        <div className={styles.stat}>
                            <span className={styles.statValue}>{num(summary.consent?.granted)}</span>
                            <span className={styles.statLabel}>{t('adminUsageConsentGranted')}</span>
                            <span className={styles.statMeta}>
                                {fill(t('adminUsageConsentRest'), { denied: num(summary.consent?.denied), notAsked: num(summary.consent?.notAsked) })}
                            </span>
                        </div>
                    </div>

                    <section className={styles.card}>
                        <div className={styles.cardHead}>
                            <h2 className={styles.cardTitle}>{t('adminUsageTimes')}</h2>
                            <div className={styles.metricSwitch} role="group" aria-label={t('adminUsageMetric')}>
                                {HEAT_METRICS.map(metric => (
                                    <button key={metric} type="button" className={heatMetric === metric ? styles.segmentActive : undefined}
                                        aria-pressed={heatMetric === metric} onClick={() => setHeatMetric(metric)}>
                                        {t(`adminUsageMetric_${metric}`)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <p className={styles.hint}>{t('adminUsageTimesHint')}</p>
                        <Heatmap cells={data.heatmap?.[heatMetric]} metric={heatMetric} t={t} />
                    </section>

                    {data.daily?.length > 0 && (
                        <section className={styles.card}>
                            <div className={styles.cardHead}>
                                <h2 className={styles.cardTitle}>{t('adminUsageDaily')}</h2>
                                <ul className={styles.legend}>
                                    <li><span className={styles.swatch} data-series="active" aria-hidden="true" />{t('adminUsageActivePeople')}</li>
                                    <li><span className={styles.swatch} data-series="done" aria-hidden="true" />{t('adminUsageTasksDone')}</li>
                                </ul>
                            </div>
                            <DailyChart daily={data.daily} weekly={data.weekly ?? []} t={t} num={num} dayLabel={dayLabel} />
                        </section>
                    )}

                    <section className={styles.card}>
                        <h2 className={styles.cardTitle}>{t('adminUsageFeatures')}</h2>
                        {features.length === 0 ? <p className={styles.empty}>{t('adminUsageNoData')}</p> : (
                            <div className={styles.tableScroll}>
                                <table className={styles.table}>
                                    <caption className={styles.srOnly}>{t('adminUsageFeatures')}</caption>
                                    <thead>
                                        <tr>
                                            <th scope="col">{t('adminUsageFeature')}</th><th scope="col">{t('adminUsagePersonDays')}</th>
                                            <th scope="col">{t('adminUsageEvents')}</th><th scope="col">{t('adminUsagePerPersonDay')}</th>
                                            <th scope="col">{t('adminUsageSpark')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {features.map(f => (
                                            <tr key={f.metric}>
                                                <th scope="row" title={f.metric}>{metricLabel(f.metric, t)}</th><td>{num(f.personDays)}</td><td>{num(f.events)}</td>
                                                <td>{num(f.perPersonDay)}</td><td><Spark values={f.spark ?? []} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>

                    <section className={styles.card}>
                        <h2 className={styles.cardTitle}>{t('adminUsageSplits')}</h2>
                        <p className={styles.hint}>{t('adminUsageSplitsHint')}</p>
                        {!hasSplits ? <p className={styles.empty}>{t('adminUsageNoData')}</p> : (
                            <div className={styles.splits}>
                                {SPLIT_KEYS.map(key => (
                                    <table key={key} className={styles.table}>
                                        <caption>{t({ platform: 'adminUsagePlatform', language: 'adminUsageLanguage', plan: 'adminUsagePlan' }[key])}</caption>
                                        <thead>
                                            <tr><th scope="col">{t('adminUsageValue')}</th><th scope="col">{t('adminUsagePersonDays')}</th><th scope="col">{t('adminUsageEvents')}</th></tr>
                                        </thead>
                                        <tbody>
                                            {(data.splits?.[key] ?? []).map(row => (
                                                <tr key={row.key}><th scope="row">{optionLabel(t, key, row.key)}</th><td>{num(row.personDays)}</td><td>{num(row.events)}</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            )}
        </div>
    );
}
