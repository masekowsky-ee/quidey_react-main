import styles from './Settings.module.css';
import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../i18n/useTranslation';
import { fill } from '../features/helperFunction';
import { addEventType, deleteEventType, updateEventType } from '../features/tasks/taskAction';
import { EVENT_TYPE_SUGGESTIONS, eventTypeErrorText } from '../features/tasks/kinds';
import { TASK_COLORS } from '../features/tasks/taskColors';
import { showToast } from '../features/toast/toast';
import TaskColorButton from './task/TaskColorButton.jsx';
import ConfirmDeleteButton from './ConfirmDeleteButton.jsx';

// My event types, as a list to keep: rename (Enter or leaving the field), colour, order (up /
// down) and delete (its events stay, without a type); add new ones, or take suggestions.
// The statistics add up past events per type. Reached from the editor as /settings#event-types.
export default function EventTypeSettings() {
    const { t, language } = useTranslation();
    const dispatch = useDispatch();
    const types = useSelector(state => state.task.eventTypes) ?? [];
    const tasks = useSelector(state => state.task.tasks);
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const ref = useRef(null);

    // opened from a link to this card (/settings#event-types): it comes into view
    useEffect(() => {
        if (window.location.hash === '#event-types') ref.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    }, []);

    const fail = (err) => dispatch(showToast(eventTypeErrorText(t, err), 'error'));
    const eventsOf = (type) => tasks.filter(task => task.kind === 'event' && task.event_type_id === type.id).length;

    const add = async (name, color) => {
        const clean = name.trim();
        if (!clean || busy) return;
        setBusy(true);
        try {
            // a colour no type has yet, while there is one
            const used = new Set(types.map(type => type.color));
            await dispatch(addEventType(clean, color ?? TASK_COLORS.find(c => !used.has(c)) ?? null));
            setDraft('');
        } catch (err) {
            fail(err);
        } finally {
            setBusy(false);
        }
    };

    const rename = (type, value) => {
        const name = value.trim();
        if (!name || name === type.name) return;
        dispatch(updateEventType(type.id, { name })).catch(fail);
    };

    // swap with the neighbour: both get their place in the list as position
    const move = async (index, by) => {
        const other = index + by;
        if (other < 0 || other >= types.length) return;
        const order = [...types];
        [order[index], order[other]] = [order[other], order[index]];
        try {
            await Promise.all(order.map((type, position) => type.position === position ? null : dispatch(updateEventType(type.id, { position }))));
        } catch (err) {
            fail(err);
        }
    };

    const known = new Set(types.map(type => type.name.toLowerCase()));
    const suggestions = (EVENT_TYPE_SUGGESTIONS[language] ?? EVENT_TYPE_SUGGESTIONS.de).filter(s => !known.has(s.name.toLowerCase()));
    // the list in its order (a move updates positions one by one)
    const ordered = [...types].sort((a, b) => a.position - b.position || a.id - b.id);

    return (
        <section className={styles.card} id="event-types" ref={ref} aria-labelledby="event-types-title">
            <h2 id="event-types-title" className={styles.cardTitle}>{t('eventTypes')}</h2>
            <p className={styles.rowHint}>{t('eventTypesHint')}</p>

            {ordered.length > 0 &&
                <ul className={styles.typeList}>
                    {ordered.map((type, index) => (
                        <li key={type.id} className={styles.typeRow}>
                            <TaskColorButton task={type} label={fill(t('eventTypeColorOf'), { name: type.name })}
                                onChange={(color) => dispatch(updateEventType(type.id, { color })).catch(fail)} />
                            <input key={type.name} className={styles.typeName} defaultValue={type.name} maxLength={40}
                                aria-label={fill(t('eventTypeNameOf'), { name: type.name })}
                                onBlur={(e) => rename(type, e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') e.currentTarget.blur();
                                    if (e.key === 'Escape') { e.currentTarget.value = type.name; e.currentTarget.blur(); }
                                }} />
                            <span className={styles.typeCount}>{fill(t(eventsOf(type) === 1 ? 'eventCountOne' : 'eventCount'), { n: eventsOf(type) })}</span>
                            <span className={styles.typeMoves}>
                                <button type="button" className={styles.typeMove} disabled={index === 0} onClick={() => move(index, -1)}
                                    aria-label={fill(t('moveUp'), { name: type.name })} title={t('moveUpShort')}>↑</button>
                                <button type="button" className={styles.typeMove} disabled={index === ordered.length - 1} onClick={() => move(index, 1)}
                                    aria-label={fill(t('moveDown'), { name: type.name })} title={t('moveDownShort')}>↓</button>
                            </span>
                            <ConfirmDeleteButton label={`${t('eventTypeDelete')}: ${type.name}`} title={t('eventTypeDelete')}
                                onConfirm={() => dispatch(deleteEventType(type.id)).catch(fail)} />
                        </li>
                    ))}
                </ul>}

            <form className={styles.typeAdd} onSubmit={(e) => { e.preventDefault(); add(draft); }}>
                <input value={draft} maxLength={40} placeholder={t('eventTypeNewPlaceholder')} aria-label={t('eventTypeNew')}
                    onChange={(e) => setDraft(e.target.value)} />
                <button type="submit" disabled={!draft.trim() || busy}>{t('add')}</button>
            </form>

            {suggestions.length > 0 &&
                <div className={styles.typeSuggestions}>
                    <span className={styles.rowHint}>{t('eventTypeSuggestions')}</span>
                    {suggestions.map(s => (
                        <button key={s.name} type="button" className={styles.typeSuggestion} data-task-color={s.color}
                            disabled={busy} onClick={() => add(s.name, s.color)}>+ {s.name}</button>
                    ))}
                    {suggestions.length > 1 &&
                        <button type="button" className={styles.typeSuggestion} disabled={busy}
                            onClick={async () => { for (const s of suggestions) await add(s.name, s.color); }}>
                            {t('eventTypeTakeAll')}
                        </button>}
                </div>}
        </section>
    );
}
