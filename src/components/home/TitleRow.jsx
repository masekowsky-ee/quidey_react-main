import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import styles from '../Home.module.css';
import { dateKey, hhmm } from '../../features/calendar/calendar.js';
import { selectTasksLoaded } from '../../features/tasks/taskAction.js';
import { fill, isOverdue, sameDay, parseDate } from '../../features/helperFunction.js';
import { isEvent } from '../../features/tasks/kinds.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import { localeOf } from '../../i18n/locale';
import { Bone } from '../skeleton/Skeleton.jsx';
import SoloTogetherStrip from '../together/SoloTogetherStrip.jsx';

function useTodayTitle() {
    const { language } = useTranslation();
    return new Intl.DateTimeFormat(localeOf(language),
        { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
}

function greetingKey(hour) {
    if (hour >= 5 && hour < 11) return 'greetMorning';
    if (hour >= 11 && hour < 17) return 'greetDay';
    return 'greetEvening';
}

// The app's own look says the day in sentences under the greeting: the date, what is due today
// (unless the grey line already says it), the next event today with its time, and the overdue
// ones as a link to the agenda.
function DaySentence({ date, dueToday, overdue, nextEvent, leadSaysDue, today }) {
    const { t } = useTranslation();
    const due = dueToday === 0 ? t('homeSumNone')
        : fill(t(dueToday === 1 ? 'homeSumDueOne' : 'homeSumDue'), { count: dueToday });
    return (
        <p className={styles.sentence}>
            {date}.{' '}
            {!leadSaysDue && <>{due}{' '}</>}
            {nextEvent && <>{fill(t('homeSumEvent'), { time: nextEvent.due_time.slice(0, 5), name: nextEvent.name })}{' '}</>}
            {overdue > 0 && <>
                <Link to={`/calendar?view=agenda&date=${dateKey(today)}`} className={styles.overdue}>
                    {fill(t(overdue === 1 ? 'homeSumOverdueOne' : 'homeSumOverdue'), { count: overdue })}
                </Link>.
            </>}
        </p>
    );
}

// Home's title: a greeting with the first name, and under it in grey what today is about (the
// task in focus, else how many are due). Then the day's numbers as one line: the date, open, due
// today, overdue (a link to the agenda) and today's events (the tasks the list shows, so both say
// the same number); the Solo | Team switch on the right. Until my tasks are there the numbers are
// grey, not "all done". sentence: the app's own look, the numbers said as sentences.
export default function TitleRow({ tasks, focusTask = null, sentence = false }) {
    const { t } = useTranslation();
    const today = new Date();
    const date = useTodayTitle();
    const loaded = useSelector(selectTasksLoaded);
    const user = useSelector(state => state.auth.user);
    const firstName = (user?.display_name || user?.username || '').trim().split(/\s+/)[0];
    const hello = t(greetingKey(today.getHours()));
    const isToday = (task) => { const due = parseDate(task.due); return due && sameDay(due, today); };
    // events aren't to-dos: they only count as today's events still to come
    const open = tasks.filter(task => !task.done && !isEvent(task));
    const dueToday = open.filter(isToday).length;
    const overdue = open.filter(task => isOverdue(task, today)).length;
    const eventsToday = tasks.filter(task => isEvent(task) && !task.done && isToday(task)).length;
    const nowText = hhmm(today);
    const nextEvent = tasks
        .filter(task => isEvent(task) && !task.done && isToday(task) && task.due_time && task.due_time.slice(0, 5) >= nowText)
        .sort((a, b) => a.due_time.localeCompare(b.due_time))[0];
    const lead = !loaded ? null
        : focusTask ? fill(t('homeLeadFocus'), { name: focusTask.name })
        : dueToday > 0 ? fill(t(dueToday === 1 ? 'homeLeadDueOne' : 'homeLeadDue'), { count: dueToday })
        : t('homeLeadFree');
    return (
        <header className={styles.titleRow} data-part="home-title">
            <div className={styles.titleText}>
            <h1 className={`${styles.title} ${styles.greeting}`}>
                <span>{firstName ? `${hello}, ${firstName}.` : `${hello}.`}</span>
                {lead && <span className={styles.lead}>{lead}</span>}
            </h1>
            {sentence
                ? (loaded
                    ? <DaySentence date={date} dueToday={dueToday} overdue={overdue} nextEvent={nextEvent} today={today} leadSaysDue={!focusTask} />
                    : <p className={styles.sentence}>{date}. <Bone w="14rem" h="1.0625rem" style={{ display: 'inline-block', verticalAlign: 'middle' }} /></p>)
                : <p className={styles.summary}>
                <span>{date}</span>
                {!loaded ? <Bone w="11rem" h="0.9375rem" style={{ margin: '0.25rem 0' }} />
                    : open.length === 0
                    ? <span>{t('allDoneToday')}</span>
                    : <>
                        <span>{fill(t('openTasksCount'), { count: open.length })}</span>
                        {dueToday > 0 && <span>{fill(t('dueTodayCount'), { count: dueToday })}</span>}
                        {overdue > 0 &&
                            <Link to={`/calendar?view=agenda&date=${dateKey(today)}`} className={styles.overdue}>
                                {fill(t('overdueCount'), { count: overdue })}
                            </Link>}
                    </>}
                {eventsToday > 0 && <span>{fill(t(eventsToday === 1 ? 'eventsTodayOne' : 'eventsTodayCount'), { count: eventsToday })}</span>}
            </p>}
            </div>
            <SoloTogetherStrip />
        </header>
    );
}
