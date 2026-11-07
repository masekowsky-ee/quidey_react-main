// The admin usage report (GET /api/admin/usage) and its raw rows (GET /api/admin/usage/raw) as the
// six sheets of the export (sheet model of exportTable.js). Sums of daily people are person-days,
// sums of hourly people person-hours; nothing here says "different people".

export const HEAT_METRICS = ['active', 'task_done', 'focus_start'];
export const SPLIT_KEYS = ['platform', 'language', 'plan'];
export const SHEET_IDS = ['summary', 'times', 'daily', 'features', 'splits', 'raw'];

// weekday 1 = Monday … 7 = Sunday, hour 0–23. The server lists only cells with data.
export function heatGrid(cells = []) {
    const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ people: 0, events: 0 })));
    for (const cell of cells) {
        const row = grid[cell.weekday - 1];
        if (row && cell.hour >= 0 && cell.hour < 24) row[cell.hour] = { people: cell.people ?? 0, events: cell.events ?? 0 };
    }
    return grid;
}

// Features by person-days, then events, then name (the server sorts the same way)
export const sortedFeatures = (features = []) =>
    [...features].sort((a, b) => b.personDays - a.personDays || b.events - a.events || a.metric.localeCompare(b.metric));

const col = (key, label, type, width) => ({ key, label, type, ...(width && { width }) });

function summarySheet(report, t) {
    const { summary, range, filters = {} } = report;
    const all = t('adminUsageAllValues');
    const rows = [
        { item: t('adminUsageFrom'), date: range.from },
        { item: t('adminUsageTo'), date: range.to },
        { item: t('adminUsagePlatform'), text: filters.platform || all },
        { item: t('adminUsageLanguage'), text: filters.language || all },
        { item: t('adminUsagePlan'), text: filters.plan || all },
        { item: t('adminUsageActiveToday'), value: summary.activeToday },
        { item: t('adminUsageActiveWeek'), value: summary.activeThisWeek },
        { item: t('adminUsageAvgPerDay'), value: summary.avgActivePerDay },
        { item: t('adminUsageBusiestDay'), value: summary.busiestDay?.people ?? null, date: summary.busiestDay?.date ?? null },
        { item: t('adminUsageFocusHours'), value: summary.focusHours },
        { item: t('adminUsageConsentGranted'), value: summary.consent?.granted },
        { item: t('adminUsageConsentDenied'), value: summary.consent?.denied },
        { item: t('adminUsageConsentNotAsked'), value: summary.consent?.notAsked },
        ...(report.weekly ?? []).map(week => ({ item: t('adminUsageWeekActive'), value: week.active, date: week.weekStart })),
    ];
    return {
        name: t('adminUsageSheet_summary'),
        columns: [
            col('item', t('adminUsageItem'), 'string', 28), col('value', t('adminUsageNumber'), 'number', 12),
            col('date', t('adminUsageDateCol'), 'date', 12), col('text', t('adminUsageDetail'), 'string', 14),
        ],
        rows,
    };
}

function timesSheet(report, t) {
    const rows = [];
    for (const metric of HEAT_METRICS) {
        heatGrid(report.heatmap?.[metric]).forEach((hours, d) => hours.forEach((cell, hour) => {
            rows.push({ metric, weekday: d + 1, day: t('weekDays', d), hour, people: cell.people, events: cell.events });
        }));
    }
    return {
        name: t('adminUsageSheet_times'),
        columns: [
            col('metric', t('adminUsageMetric'), 'string', 14), col('weekday', t('adminUsageWeekdayNo'), 'number', 18),
            col('day', t('adminUsageWeekday'), 'string', 10), col('hour', t('adminUsageHour'), 'number', 8),
            col('people', t('adminUsagePersonHours'), 'number', 16), col('events', t('adminUsageEvents'), 'number', 12),
        ],
        rows,
    };
}

function dailySheet(report, t) {
    return {
        name: t('adminUsageSheet_daily'),
        columns: [
            col('date', t('adminUsageDay'), 'date', 12), col('active', t('adminUsageActivePeople'), 'number', 16),
            col('tasksCreated', t('adminUsageTasksCreated'), 'number', 16), col('tasksDone', t('adminUsageTasksDone'), 'number', 16),
            col('focusMinutes', t('adminUsageFocusMinutes'), 'number', 14), col('activeMinutesPerPerson', t('adminUsageActiveMinutes'), 'number', 24),
        ],
        rows: (report.daily ?? []).map(day => ({ ...day })),
    };
}

function featuresSheet(report, t) {
    return {
        name: t('adminUsageSheet_features'),
        columns: [
            col('metric', t('adminUsageFeature'), 'string', 24), col('personDays', t('adminUsagePersonDays'), 'number', 14),
            col('events', t('adminUsageEvents'), 'number', 12), col('perPersonDay', t('adminUsagePerPersonDay'), 'number', 16),
        ],
        rows: sortedFeatures(report.features).map(({ metric, personDays, events, perPersonDay }) => ({ metric, personDays, events, perPersonDay })),
    };
}

function splitsSheet(report, t) {
    const label = { platform: t('adminUsagePlatform'), language: t('adminUsageLanguage'), plan: t('adminUsagePlan') };
    return {
        name: t('adminUsageSheet_splits'),
        columns: [
            col('dimension', t('adminUsageBy'), 'string', 12), col('key', t('adminUsageValue'), 'string', 12),
            col('personDays', t('adminUsagePersonDays'), 'number', 14), col('events', t('adminUsageEvents'), 'number', 12),
        ],
        rows: SPLIT_KEYS.flatMap(dim => (report.splits?.[dim] ?? []).map(row => ({ dimension: label[dim], key: row.key, personDays: row.personDays, events: row.events }))),
    };
}

function rawSheet(raw, t) {
    return {
        name: t('adminUsageSheet_raw'),
        columns: [
            col('hour', t('adminUsageHourStart'), 'datetime', 18), col('localHour', t('adminUsageLocalHour'), 'number', 10),
            col('weekday', t('adminUsageWeekdayNo'), 'number', 18), col('metric', t('adminUsageMetric'), 'string', 22),
            col('platform', t('adminUsagePlatform'), 'string', 10), col('language', t('adminUsageLanguage'), 'string', 10),
            col('plan', t('adminUsagePlan'), 'string', 10), col('events', t('adminUsageEvents'), 'number', 12),
            col('people', t('adminUsagePeople'), 'number', 10), col('valueSum', t('adminUsageValueSum'), 'number', 12),
        ],
        rows: (raw?.rows ?? []).map(row => ({ ...row })),
    };
}

// report: the usage response (+ optional `filters` { platform, language, plan } for the summary);
// raw: the raw response or null (the raw sheet is then empty); t(key, index?) translates.
export function usageSheets(report, raw, t) {
    return [summarySheet(report, t), timesSheet(report, t), dailySheet(report, t), featuresSheet(report, t), splitsSheet(report, t), rawSheet(raw, t)];
}

// A sheet's name as a file name part: "Täglich" → "taeglich", "Times of day" → "times-of-day"
export function fileSlug(name) {
    return name.toLowerCase()
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
