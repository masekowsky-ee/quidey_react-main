import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    useCollections, selectCollectionsLoaded, collectionContents, createCollection, updateCollection, deleteCollection,
    addToCollection, removeFromCollection, hasItem, COLLECTION_EMOJIS, COLLECTION_NAME_MAX, COLLECTION_DESCRIPTION_MAX,
} from '../../features/collections/collections';
import { fetchNotes, createNote } from '../../features/focus/notebook';
import { firstLine, matchesQuery } from '../../features/notes/notes';
import { addTask, updateTaskProps } from '../../features/tasks/taskAction';
import { groupColorAttr, taskColorAttr } from '../../features/tasks/taskColors';
import { showToast } from '../../features/toast/toast';
import { fill, dueText, parseDate } from '../../features/helperFunction';
import { useTranslation } from '../../i18n/useTranslation';
import TaskEditDialog from '../task/TaskEditDialog.jsx';
import TaskColorPicker from '../task/TaskColorPicker.jsx';
import ConfirmDeleteButton from '../ConfirmDeleteButton.jsx';
import Icon from '../icons.jsx';
import { Bone } from '../skeleton/Skeleton.jsx';
import styles from './Collections.module.css';

// my notes, loaded once per page (they are not in the store)
function useNotes() {
    const [notes, setNotes] = useState(null);
    useEffect(() => { fetchNotes().then(setNotes).catch(() => setNotes([])); }, []);
    return [notes, setNotes];
}

const dayFormat = (language) => new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

// "2 Events · 5 Aufgaben (3 offen) · 1 Notiz"
function countsLine(t, { events, tasks, notes }) {
    const open = tasks.filter(task => !task.done).length;
    return [
        events.length ? fill(t(events.length === 1 ? 'collectionEventsOne' : 'collectionEvents'), { n: events.length }) : '',
        tasks.length ? fill(t(tasks.length === 1 ? 'collectionTasksOne' : 'collectionTasks'), { n: tasks.length }) + (open && open < tasks.length ? ` (${fill(t('collectionOpen'), { n: open })})` : '') : '',
        notes.length ? fill(t(notes.length === 1 ? 'collectionNotesOne' : 'collectionNotes'), { n: notes.length }) : '',
    ].filter(Boolean).join(' · ') || t('collectionEmptyShort');
}

const upcoming = (events) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return events.find(event => !event.done && parseDate(event.due) >= today) ?? null;
};

// ---------- all collections ----------
function CollectionList() {
    const { t, language } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const collections = useCollections();
    const loaded = useSelector(selectCollectionsLoaded);
    const tasks = useSelector(state => state.task.tasks);
    const [notes] = useNotes();
    const [name, setName] = useState('');
    const [emoji, setEmoji] = useState(COLLECTION_EMOJIS[0]);
    const days = dayFormat(language);

    const create = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        try {
            const made = await dispatch(createCollection({ name: name.trim(), emoji }));
            setName('');
            navigate(`/collections/${made.id}`);
        } catch (err) {
            dispatch(showToast(err.code === 'COLLECTION_LIMIT' ? t('collectionLimit') : t('collectionError'), 'error'));
        }
    };

    return (
        <div className={styles.page} data-part="collections">
            <header className={styles.head}>
                <div>
                    <h1 className={styles.title}>{t('collections')}</h1>
                    <p className={styles.subtitle}>{t('collectionsSubtitle')}</p>
                </div>
                <Link to="/notes" className={styles.ghostLink}><Icon name="note" size={16} /> {t('notesTitle')}</Link>
            </header>

            <form className={styles.newCollection} onSubmit={create}>
                <select value={emoji} onChange={e => setEmoji(e.target.value)} aria-label={t('collectionEmoji')}>
                    {COLLECTION_EMOJIS.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
                <input value={name} maxLength={COLLECTION_NAME_MAX} onChange={e => setName(e.target.value)}
                    placeholder={t('collectionNewPlaceholder')} aria-label={t('collectionName')} />
                <button type="submit" className={styles.primary} disabled={!name.trim()}><Icon name="plus" size={16} /> {t('collectionCreate')}</button>
            </form>

            {!loaded
                ? <div className={styles.cards}>{[0, 1, 2].map(i => <Bone key={i} h="9rem" />)}</div>
                : collections.length === 0
                    ? <div className={styles.empty}>
                        <Icon name="collection" size={32} />
                        <p className={styles.emptyLead}>{t('collectionsEmpty')}</p>
                        <p>{t('collectionsEmptyHint')}</p>
                    </div>
                    : <ul className={styles.cards}>
                        {collections.map(collection => {
                            const contents = collectionContents(collection, tasks, notes ?? []);
                            const next = upcoming(contents.events);
                            const done = contents.tasks.filter(task => task.done).length;
                            return (
                                <li key={collection.id}>
                                    <Link to={`/collections/${collection.id}`} className={styles.card} data-task-color={groupColorAttr(collection)}>
                                        <span className={styles.cardEmoji} aria-hidden="true">{collection.emoji || '🗂️'}</span>
                                        <span className={styles.cardName}>{collection.name}</span>
                                        {collection.description && <span className={styles.cardText}>{collection.description}</span>}
                                        <span className={styles.cardMeta}>{notes === null ? '' : countsLine(t, contents)}</span>
                                        {next && <span className={styles.cardNext}><Icon name="calendar" size={13} /> {next.name} · {days.format(parseDate(next.due))}</span>}
                                        {contents.tasks.length > 0 &&
                                            <span className={styles.progress} role="img" aria-label={fill(t('collectionProgress'), { done, total: contents.tasks.length })}>
                                                <span className={styles.progressBar} style={{ '--progress': `${(done / contents.tasks.length) * 100}%` }} />
                                            </span>}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>}
        </div>
    );
}

// ---------- putting something in ----------
const KINDS = [['task', 'collectionKindTask'], ['event', 'collectionKindEvent'], ['note', 'collectionKindNote']];

// Search what I have (tasks, events, notes not in it yet) or make something new right in it
function AddBar({ collection, tasks, notes, onNoteMade }) {
    const { t, language } = useTranslation();
    const dispatch = useDispatch();
    const [query, setQuery] = useState('');
    const [making, setMaking] = useState('task');
    const [name, setName] = useState('');
    const [day, setDay] = useState('');
    const [busy, setBusy] = useState(false);
    const days = dayFormat(language);
    const failed = () => dispatch(showToast(t('collectionError'), 'error'));

    const found = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        const taskHits = tasks.filter(task => !hasItem(collection, { kind: 'task', id: task.id }) && task.name.toLowerCase().includes(q))
            .sort((a, b) => Number(a.done) - Number(b.done))
            .map(task => ({ kind: 'task', id: task.id, label: task.name, icon: task.kind === 'event' ? 'calendar' : 'check', task }));
        const noteHits = (notes ?? []).filter(note => !hasItem(collection, { kind: 'note', id: note.id }) && matchesQuery(note, q))
            .map(note => ({ kind: 'note', id: note.id, label: note.title || firstLine(note.body) || t('noteUntitled'), icon: 'note' }));
        return [...taskHits, ...noteHits].slice(0, 8);
    }, [query, tasks, notes, collection, t]);

    const add = async (item) => {
        try {
            await dispatch(addToCollection(collection.id, item));
            setQuery('');
        } catch { failed(); }
    };

    const make = async (e) => {
        e.preventDefault();
        if (!name.trim() || busy) return;
        if (making === 'event' && !day) { dispatch(showToast(t('eventNeedsDay'), 'error')); return; }
        setBusy(true);
        try {
            if (making === 'note') {
                const note = await createNote({ title: name.trim(), body: '' });
                onNoteMade(note);
                await dispatch(addToCollection(collection.id, { kind: 'note', id: note.id }));
            } else {
                const task = await dispatch(addTask(name.trim(), day || null, '', null, null, undefined, making === 'event' ? { kind: 'event' } : {}));
                await dispatch(addToCollection(collection.id, { kind: 'task', id: task.id }));
            }
            setName('');
            setDay('');
        } catch { failed(); } finally { setBusy(false); }
    };

    return (
        <div className={styles.addBar}>
            <div className={styles.addSearch}>
                <label className={styles.search}>
                    <Icon name="search" size={16} />
                    <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('collectionSearchPlaceholder')} aria-label={t('collectionSearch')} />
                </label>
                {query.trim() &&
                    <ul className={styles.results} aria-label={t('collectionSearchResults')}>
                        {found.length === 0
                            ? <li className={styles.noResult}>{t('collectionNothingFound')}</li>
                            : found.map(item =>
                                <li key={`${item.kind}-${item.id}`}>
                                    <button type="button" className={styles.result} onClick={() => add(item)}>
                                        <Icon name={item.icon} size={15} />
                                        <span className={styles.resultName} data-done={item.task?.done || undefined}>{item.label}</span>
                                        {item.task?.due && <span className={styles.resultMeta}>{days.format(parseDate(item.task.due))}</span>}
                                        <Icon name="plus" size={15} />
                                    </button>
                                </li>)}
                    </ul>}
            </div>
            <form className={styles.makeRow} onSubmit={make}>
                <div className={styles.kindSwitch} role="group" aria-label={t('collectionMakeKind')}>
                    {KINDS.map(([kind, label]) =>
                        <button key={kind} type="button" aria-pressed={making === kind} onClick={() => setMaking(kind)}>{t(label)}</button>)}
                </div>
                <input value={name} onChange={e => setName(e.target.value)} maxLength={making === 'note' ? 120 : 200}
                    placeholder={t(`collectionMake_${making}`)} aria-label={t(`collectionMake_${making}`)} />
                {making !== 'note' &&
                    <input type="date" value={day} onChange={e => setDay(e.target.value)} required={making === 'event'}
                        aria-label={t(making === 'event' ? 'eventDay' : 'dueDate')} className={styles.dayInput} />}
                <button type="submit" className={styles.primary} disabled={!name.trim() || busy}>{t('collectionMakeAdd')}</button>
            </form>
        </div>
    );
}

// a line in a collection, with "take out" at its end
function Row({ children, onRemove, removeLabel, color }) {
    return (
        <li className={styles.row} data-task-color={color}>
            {children}
            <button type="button" className={styles.iconBtn} onClick={onRemove} aria-label={removeLabel} title={removeLabel}>
                <Icon name="close" size={14} />
            </button>
        </li>
    );
}

// ---------- one collection ----------
function CollectionDetail({ id }) {
    const { t, language } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const collections = useCollections();
    const loaded = useSelector(selectCollectionsLoaded);
    const tasks = useSelector(state => state.task.tasks);
    const [notes, setNotes] = useNotes();
    const [editing, setEditing] = useState(null);
    const collection = collections.find(item => item.id === id);
    const [name, setName] = useState(collection?.name ?? '');
    const [description, setDescription] = useState(collection?.description ?? '');
    const days = dayFormat(language);

    // the fields follow the collection once it has loaded (or another one is opened)
    const [shownId, setShownId] = useState(collection ? id : null);
    if (collection && shownId !== id) {
        setShownId(id);
        setName(collection.name);
        setDescription(collection.description);
    }

    if (!loaded) return <div className={styles.page}><Bone h="2rem" w="12rem" /><Bone h="6rem" /><Bone h="12rem" /></div>;
    if (!collection) {
        return (
            <div className={styles.page}>
                <Link to="/collections" className={styles.back}><Icon name="release" size={16} /> {t('collectionsBack')}</Link>
                <div className={styles.empty}><Icon name="collection" size={32} /><p>{t('collectionGone')}</p></div>
            </div>
        );
    }

    const failed = () => dispatch(showToast(t('collectionError'), 'error'));
    const save = (change) => dispatch(updateCollection(collection.id, change)).catch(failed);
    const takeOut = (item) => dispatch(removeFromCollection(collection.id, item)).catch(failed);
    const remove = async () => {
        try {
            await dispatch(deleteCollection(collection.id));
            navigate('/collections');
        } catch { failed(); }
    };

    const contents = collectionContents(collection, tasks, notes ?? []);
    const done = contents.tasks.filter(task => task.done).length;
    const nothing = !contents.events.length && !contents.tasks.length && !contents.notes.length;
    const editTask = editing ? tasks.find(task => task.id === editing) : null;

    return (
        <div className={styles.page} data-part="collection">
            <Link to="/collections" className={styles.back}><Icon name="release" size={16} /> {t('collectionsBack')}</Link>

            <header className={styles.detailHead} data-task-color={groupColorAttr(collection)}>
                <select className={styles.emojiSelect} value={collection.emoji ?? ''} onChange={e => save({ emoji: e.target.value || null })} aria-label={t('collectionEmoji')}>
                    {!collection.emoji && <option value="">🗂️</option>}
                    {COLLECTION_EMOJIS.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
                <div className={styles.detailTitles}>
                    <input className={styles.nameInput} value={name} maxLength={COLLECTION_NAME_MAX} aria-label={t('collectionName')}
                        onChange={e => setName(e.target.value)}
                        onBlur={() => { if (name.trim() && name.trim() !== collection.name) save({ name: name.trim() }); else setName(collection.name); }}
                        onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />
                    <textarea className={styles.descriptionInput} rows={2} value={description} maxLength={COLLECTION_DESCRIPTION_MAX}
                        placeholder={t('collectionDescriptionPlaceholder')} aria-label={t('collectionDescription')}
                        onChange={e => setDescription(e.target.value)}
                        onBlur={() => description.trim() !== collection.description && save({ description: description.trim() })} />
                </div>
                <ConfirmDeleteButton onConfirm={remove} label={`${t('collectionDelete')}: ${collection.name}`} title={t('collectionDeleteHint')} />
            </header>
            <div className={styles.detailBar}>
                <TaskColorPicker value={collection.color} onChange={color => save({ color })} hideLabel />
                {contents.tasks.length > 0 &&
                    <span className={styles.detailProgress}>
                        {fill(t('collectionProgress'), { done, total: contents.tasks.length })}
                        <span className={styles.progress} aria-hidden="true">
                            <span className={styles.progressBar} style={{ '--progress': `${(done / contents.tasks.length) * 100}%` }} />
                        </span>
                    </span>}
            </div>

            <AddBar collection={collection} tasks={tasks} notes={notes} onNoteMade={note => setNotes(prev => [note, ...(prev ?? [])])} />

            {nothing && notes !== null &&
                <div className={styles.empty}><Icon name="collection" size={28} /><p>{t('collectionEmptyHint')}</p></div>}

            <div className={styles.sections}>
                {contents.events.length > 0 &&
                    <section className={styles.section} aria-labelledby="collection-events">
                        <h2 id="collection-events" className={styles.sectionTitle}><Icon name="calendar" size={16} /> {t('collectionSectionEvents')}</h2>
                        <ul className={styles.rows}>
                            {contents.events.map(event =>
                                <Row key={event.id} color={taskColorAttr(event)} onRemove={() => takeOut({ kind: 'task', id: event.id })}
                                    removeLabel={fill(t('collectionTakeOutItem'), { name: event.name })}>
                                    <button type="button" className={styles.rowMain} onClick={() => setEditing(event.id)} data-done={event.done || undefined}>
                                        <span className={styles.rowDate}>{event.due ? days.format(parseDate(event.due)) : '–'}{event.due_time ? ` · ${event.due_time}` : ''}</span>
                                        <span className={styles.rowName}>{event.name}</span>
                                        {event.event_type && <span className={styles.rowMeta}>{event.event_type.name}</span>}
                                    </button>
                                </Row>)}
                        </ul>
                    </section>}

                {contents.tasks.length > 0 &&
                    <section className={styles.section} aria-labelledby="collection-tasks">
                        <h2 id="collection-tasks" className={styles.sectionTitle}><Icon name="check" size={16} /> {t('collectionSectionTasks')}</h2>
                        <ul className={styles.rows}>
                            {contents.tasks.map(task =>
                                <Row key={task.id} color={taskColorAttr(task)} onRemove={() => takeOut({ kind: 'task', id: task.id })}
                                    removeLabel={fill(t('collectionTakeOutItem'), { name: task.name })}>
                                    <input type="checkbox" className={styles.check} checked={Boolean(task.done)} aria-label={fill(t(task.done ? 'collectionUndone' : 'collectionDone'), { name: task.name })}
                                        onChange={() => dispatch(updateTaskProps({ done: !task.done }, task)).catch(failed)} />
                                    <button type="button" className={styles.rowMain} onClick={() => setEditing(task.id)} data-done={task.done || undefined}>
                                        <span className={styles.rowName}>{task.name}</span>
                                        {task.due && <span className={styles.rowMeta}>{dueText(task.due, t)}{task.due_time ? ` · ${task.due_time}` : ''}</span>}
                                    </button>
                                </Row>)}
                        </ul>
                    </section>}

                {contents.notes.length > 0 &&
                    <section className={styles.section} aria-labelledby="collection-notes">
                        <h2 id="collection-notes" className={styles.sectionTitle}><Icon name="note" size={16} /> {t('collectionSectionNotes')}</h2>
                        <ul className={styles.rows}>
                            {contents.notes.map(note =>
                                <Row key={note.id} color={note.color ?? undefined} onRemove={() => takeOut({ kind: 'note', id: note.id })}
                                    removeLabel={fill(t('collectionTakeOutItem'), { name: note.title || t('noteUntitled') })}>
                                    <Link to={`/notes?note=${note.id}`} className={styles.rowMain}>
                                        <span className={styles.rowName}>{note.title || firstLine(note.body) || t('noteUntitled')}</span>
                                        {note.title && firstLine(note.body) && <span className={styles.rowMeta}>{firstLine(note.body)}</span>}
                                    </Link>
                                </Row>)}
                        </ul>
                    </section>}
            </div>

            {editTask && <TaskEditDialog task={editTask} onClose={() => setEditing(null)} />}
        </div>
    );
}

// Collections (/collections, testers): all of them, or one (/collections/:id)
export default function Collections() {
    const { id } = useParams();
    return id ? <CollectionDetail id={Number(id)} /> : <CollectionList />;
}
