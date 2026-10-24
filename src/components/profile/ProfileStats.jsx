import styles from './ProfileParts.module.css';
import { useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { fill, formatDate, formatDuration, mondayIndex, parseDate } from '../../features/helperFunction';
import { badgesFor } from '../../features/profile/badges';
import { groupColorAttr } from '../../features/tasks/taskColors';
import Icon from '../icons';

// The day `daysAgo` days before `today` (a local Date)
const dayBefore = (today, daysAgo) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo);

// 0 = nothing, 1-4 = a quarter of the busiest day each
const levelOf = (ms, max) => (ms > 0 && max > 0 ? Math.min(4, Math.max(1, Math.ceil((ms / max) * 4))) : 0);

// Every focus day of the last 26 weeks: one column per week, Monday on top, today last
function Heatmap({ daily, today, t }) {
    const [hovered, setHovered] = useState(null);
    const max = Math.max(...daily);
    const todayRow = mondayIndex(today);
    // fill up the first week before the oldest day and the rest of this week after today
    const lead = (todayRow + 1) % 7;
    const cells = [
        ...Array.from({ length: lead }, (_, i) => ({ key: `lead${i}`, blank: true })),
        ...daily.map((ms, i) => ({ key: i, ms, date: dayBefore(today, daily.length - 1 - i) })),
        ...Array.from({ length: 6 - todayRow }, (_, i) => ({ key: `rest${i}`, blank: true })),
    ];
    const activeDays = daily.filter(ms => ms > 0).length;
    const label = (cell) => `${t('weekDays', mondayIndex(cell.date))}, ${formatDate(cell.date)}: ${cell.ms > 0 ? formatDuration(cell.ms) : t('statNoFocus')}`;

    return (
        <div className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('statHeatmap')}</h3>
            <div className={styles.heatWrap}>
                <div className={styles.heatDays} aria-hidden="true">
                    {[0, 1, 2, 3, 4, 5, 6].map(i => <span key={i}>{i % 2 === 0 ? t('weekDays', i) : ''}</span>)}
                </div>
                <div className={styles.heat} role="img" aria-label={fill(t('statHeatmapLabel'), { n: activeDays })}
                    onMouseLeave={() => setHovered(null)}>
                    {cells.map(cell => cell.blank
                        ? <span key={cell.key} className={styles.cell} data-future="" />
                        : <span key={cell.key} className={styles.cell} data-level={levelOf(cell.ms, max)}
                            title={label(cell)} onMouseEnter={() => setHovered(cell)} />)}
                </div>
            </div>
            <div className={styles.statsHead}>
                <p className={styles.readout} aria-hidden="true">{hovered ? label(hovered) : ''}</p>
                <span className={styles.legend} aria-hidden="true">
                    <span>{t('statLess')}</span>
                    {[0, 1, 2, 3, 4].map(level => <span key={level} className={styles.cell} data-level={level} />)}
                    <span>{t('statMore')}</span>
                </span>
            </div>
        </div>
    );
}

// Focus per day for the last two weeks
function LastDays({ daily, today, t }) {
    const [hovered, setHovered] = useState(null);
    const days = daily.slice(-14).map((ms, i) => ({ ms, date: dayBefore(today, 13 - i) }));
    const max = Math.max(...days.map(d => d.ms));
    const label = (day) => `${t('weekDays', mondayIndex(day.date))}, ${formatDate(day.date)}: ${day.ms > 0 ? formatDuration(day.ms) : t('statNoFocus')}`;

    return (
        <div className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('statLastDays')}</h3>
            <ol className={styles.bars} onMouseLeave={() => setHovered(null)}>
                {days.map((day, i) => (
                    <li key={i} className={styles.bar} data-empty={day.ms > 0 ? undefined : ''} tabIndex={0}
                        aria-label={label(day)} title={label(day)}
                        onMouseEnter={() => setHovered(day)} onFocus={() => setHovered(day)} onBlur={() => setHovered(null)}>
                        <span className={styles.barFill} style={{ height: `${max > 0 ? (day.ms / max) * 100 : 0}%` }} />
                    </li>
                ))}
            </ol>
            <div className={styles.barLabels} aria-hidden="true">
                {days.map((day, i) => <span key={i}>{t('weekDays', mondayIndex(day.date)).slice(0, 2)}</span>)}
            </div>
            <p className={styles.readout} aria-hidden="true">{hovered ? label(hovered) : ''}</p>
        </div>
    );
}

// Horizontal bars with a label and a duration, longest = full width
function DurationRows({ title, rows }) {
    const max = Math.max(0, ...rows.map(r => r.ms));
    return (
        <div className={styles.section}>
            <h3 className={styles.sectionTitle}>{title}</h3>
            <ul className={styles.rows}>
                {rows.map(row => (
                    <li key={row.key} className={styles.row}>
                        <span className={styles.rowLabel}>{row.label}</span>
                        <span className={styles.rowTrack} aria-hidden="true">
                            <span className={styles.rowFill} style={{ width: `${max > 0 ? (row.ms / max) * 100 : 0}%` }} />
                        </span>
                        <span className={styles.rowValue}>{formatDuration(row.ms)}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

// Change against last week: "+25 %" / "−10 %"; null when there's nothing to compare with
function weekChange(stats) {
    if (!stats.lastWeekMs) return null;
    const percent = Math.round(((stats.weekMs - stats.lastWeekMs) / stats.lastWeekMs) * 100);
    return `${percent >= 0 ? '+' : '−'}${Math.abs(percent)} %`;
}

// Everything about somebody's focus time (from GET /api/profile(s)): numbers, heat map, the last
// two weeks, weekdays, top groups and badges. `title` heads the card.
export default function ProfileStats({ stats, title, colorAttr }) {
    const { t } = useTranslation();
    const today = parseDate(stats.today) ?? new Date();
    const days = (n) => fill(t(n === 1 ? 'statDay' : 'statDays'), { n });
    const change = weekChange(stats);

    const tiles = [
        { key: 'total', label: t('focusTime'), value: formatDuration(stats.totalMs) },
        { key: 'sessions', label: t('sessions'), value: stats.sessions },
        { key: 'streak', label: t('statStreak'), value: `${stats.currentStreak > 0 ? '🔥 ' : ''}${days(stats.currentStreak)}` },
        { key: 'longest', label: t('statLongestStreak'), value: days(stats.longestStreak) },
        { key: 'week', label: t('statThisWeek'), value: formatDuration(stats.weekMs), note: change && fill(t('statVsLastWeek'), { change }) },
        { key: 'avg', label: t('statAvgSession'), value: formatDuration(stats.avgSessionMs) },
        { key: 'tasks', label: t('statTasksDone'), value: stats.tasksDone, note: fill(t('statThisWeekCount'), { n: stats.tasksDoneWeek }) },
        { key: 'active', label: t('statActiveDays'), value: stats.activeDays },
    ];

    const badges = badgesFor(stats);
    const earned = badges.filter(b => b.earned).length;

    return (
        <section className={styles.statsCard} data-task-color={colorAttr}>
            <div className={styles.statsHead}>
                <h2>{title}</h2>
            </div>

            <dl className={styles.tiles}>
                {tiles.map(tile => (
                    <div key={tile.key} className={styles.tile}>
                        <dt>{tile.label}</dt>
                        <dd>
                            {tile.value}
                            {tile.note && <span className={styles.tileNote}>{tile.note}</span>}
                        </dd>
                    </div>
                ))}
            </dl>

            {stats.sessions === 0 ? (
                <p className={styles.emptyStats}>{t('statEmpty')}</p>
            ) : (
                <>
                    <ul className={styles.facts}>
                        <li>{t('statToday')}: <strong>{formatDuration(stats.todayMs)}</strong></li>
                        {stats.bestDay && <li>{t('statBestDay')}: <strong>{formatDate(stats.bestDay.day)} · {formatDuration(stats.bestDay.ms)}</strong></li>}
                        <li>{t('statLongestSession')}: <strong>{formatDuration(stats.longestSessionMs)}</strong></li>
                        {stats.favoriteTime && <li>{t('statFavoriteTime')}: <strong>{t(`statTime_${stats.favoriteTime}`)}</strong></li>}
                        <li>{t('statMonth')}: <strong>{formatDuration(stats.monthMs)}</strong></li>
                        {stats.sharedSessions > 0 && (
                            <li>{t('statTogether')}: <strong>{fill(t('statTogetherValue'), { n: stats.sharedSessions, time: formatDuration(stats.sharedMs) })}</strong></li>
                        )}
                    </ul>

                    <Heatmap daily={stats.daily} today={today} t={t} />
                    <LastDays daily={stats.daily} today={today} t={t} />

                    <div className={styles.twoCols}>
                        <DurationRows
                            title={t('statWeekdays')}
                            rows={stats.weekdays.map((ms, i) => ({ key: i, label: t('weekDays', i), ms }))}
                        />
                        {stats.topGroups.length > 0 && (
                            <DurationRows
                                title={t('statTopGroups')}
                                rows={stats.topGroups.map(group => ({
                                    key: group.name,
                                    label: <><span className={styles.dot} data-task-color={groupColorAttr(group)} />{group.name}</>,
                                    ms: group.ms,
                                }))}
                            />
                        )}
                    </div>
                </>
            )}

            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>{fill(t('statBadges'), { n: earned, total: badges.length })}</h3>
                <ul className={styles.badges}>
                    {badges.map(badge => (
                        <li key={badge.id} className={styles.badge} data-earned={badge.earned}>
                            <span className={styles.badgeIcon} aria-hidden="true"><Icon name={badge.icon} size={22} /></span>
                            <span className={styles.badgeText}>
                                {t(`badge_${badge.id}`)}
                                <small>{badge.earned ? t('badgeEarned') : t(`badge_${badge.id}_hint`)}</small>
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
