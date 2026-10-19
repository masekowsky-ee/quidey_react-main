import styles from '../Together.module.css';
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { displayName, formatDuration, toCsv, downloadFile } from '../../features/helperFunction';
import { summaryRows } from '../../features/together/format';
import { timeOf } from '../../features/together/togetherAction';
import { selectWork, localMs, useNow } from '../../features/together/work';
import Avatar from './Avatar';

// Who worked on what and for how long, by person or by task, with a CSV download
export default function WorkSummary({ session }) {
    const { t } = useTranslation();
    const work = useSelector(selectWork);
    const now = useNow(Boolean(work.taskId));
    const [view, setView] = useState('people');

    const me = session.me;
    // my numbers include what the stopwatch hasn't delivered yet
    const timeFor = (task, userId) => timeOf(task, userId) + (userId === me ? localMs(work, task.id, now) : 0);

    const people = session.people
        .map(person => ({ ...person, total: session.tasks.reduce((sum, task) => sum + timeFor(task, person.user.id), 0) }))
        .filter(person => person.total > 0)
        .sort((a, b) => b.total - a.total);
    const totalMs = people.reduce((sum, p) => sum + p.total, 0);
    const userById = new Map(session.people.map(p => [p.user.id, p.user]));

    const tasks = session.tasks
        .map(task => {
            const byPerson = session.people
                .map(p => ({ user: p.user, ms: timeFor(task, p.user.id) }))
                .filter(entry => entry.ms > 0)
                .sort((a, b) => b.ms - a.ms);
            return { task, byPerson, total: byPerson.reduce((sum, e) => sum + e.ms, 0) };
        })
        .filter(entry => entry.total > 0)
        .sort((a, b) => b.total - a.total);

    const handleExport = () => {
        const safeName = session.name.replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'session';
        downloadFile(`${safeName}.csv`, toCsv(summaryRows(t, session)));
    };

    return (
        <section className={styles.card}>
            <div className={styles.cardHead}>
                <h2 className={styles.cardTitle}>{t('whoWorkedOnWhat')}</h2>
                {people.length > 0 && (
                    <div className={styles.cardHeadActions}>
                        <div className={styles.filters} role="group" aria-label={t('whoWorkedOnWhat')}>
                            {['people', 'tasks'].map(key => (
                                <button key={key} className={view === key ? styles.filterOn : styles.filter} aria-pressed={view === key} onClick={() => setView(key)}>
                                    {t(key === 'people' ? 'byPerson' : 'byTask')}
                                </button>
                            ))}
                        </div>
                        <button className={styles.quietBtn} onClick={handleExport} title={t('exportCsv')}>⇩ CSV</button>
                    </div>
                )}
            </div>
            {people.length === 0 ? <p className={styles.emptyLine}>{t('noTimeYet')}</p> : view === 'people' ? (
                <ul className={styles.summary}>
                    {people.map(person => {
                        const perTask = session.tasks
                            .map(task => ({ task, ms: timeFor(task, person.user.id) }))
                            .filter(entry => entry.ms > 0)
                            .sort((a, b) => b.ms - a.ms);
                        return (
                            <li key={person.user.id} className={styles.summaryPerson}>
                                <div className={styles.summaryHead}>
                                    <Avatar user={person.user} />
                                    <span className={styles.name}>
                                        {displayName(person.user)}{person.user.id === me && ` (${t('you')})`}
                                        {person.status === 'left' && <span className={styles.meta}> · {t('leftSession')}</span>}
                                    </span>
                                    <span className={styles.timeMain}>{formatDuration(person.total)}</span>
                                    <span className={styles.share}>{Math.round(person.total / totalMs * 100)}%</span>
                                </div>
                                <div className={styles.shareBar} aria-hidden="true">
                                    <div style={{ width: `${person.total / totalMs * 100}%` }} />
                                </div>
                                <ul className={styles.breakdown}>
                                    {perTask.map(({ task, ms }) => (
                                        <li key={task.id}>
                                            <span className={styles.breakdownName}>{task.done && '✓ '}{task.name}</span>
                                            <span className={styles.breakdownTime}>{formatDuration(ms)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <ul className={styles.summary}>
                    {tasks.map(({ task, byPerson, total }) => (
                        <li key={task.id} className={styles.summaryPerson}>
                            <div className={styles.summaryHead}>
                                <span className={styles.name}>{task.done && '✓ '}{task.name}</span>
                                <span className={styles.timeMain}>{formatDuration(total)}</span>
                            </div>
                            {/* one colored part per person */}
                            <div className={styles.stackBar} aria-hidden="true">
                                {byPerson.map((entry, i) => (
                                    <div key={entry.user.id} data-slot={i % 4} style={{ width: `${entry.ms / total * 100}%` }} />
                                ))}
                            </div>
                            <ul className={styles.breakdown}>
                                {byPerson.map((entry, i) => (
                                    <li key={entry.user.id}>
                                        <span className={styles.breakdownName}>
                                            <span className={styles.legendDot} data-slot={i % 4} aria-hidden="true" />
                                            {displayName(userById.get(entry.user.id))}
                                        </span>
                                        <span className={styles.breakdownTime}>{formatDuration(entry.ms)}</span>
                                    </li>
                                ))}
                            </ul>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
