import styles from './TodayEvents.module.css';
import { useTranslation } from '../../i18n/useTranslation';
import { taskTimeText } from '../../features/calendar/calendar';
import { isEventNow } from '../../features/tasks/kinds';
import { taskColorAttr } from '../../features/tasks/taskColors';

// Today's events above the task list on Home: time, name and type, one small card each.
// Over ones are greyed out, the one going on now is marked. A click opens the editor.
export default function TodayEvents({ events, onOpen }) {
    const { t } = useTranslation();
    const now = new Date();
    return (
        <section className={styles.strip} aria-label={t('todayEvents')}>
            <h3 className={styles.title}>{t('todayEvents')}</h3>
            <ul className={styles.list}>
                {events.map(event => {
                    const live = isEventNow(event, now);
                    return (
                        <li key={event.id}>
                            <button type="button" className={[styles.event, event.done && styles.over, live && styles.live].filter(Boolean).join(' ')}
                                data-task-color={taskColorAttr(event)} onClick={() => onOpen(event)}
                                aria-label={`${t('editEvent')}: ${event.name}`}>
                                <span className={styles.time}>{taskTimeText(event) || t('allDay')}</span>
                                <span className={styles.name}>{event.name}</span>
                                {event.event_type && <span className={styles.type}>{event.event_type.name}</span>}
                                {live && <span className={styles.liveTag}>{t('eventNow')}</span>}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
