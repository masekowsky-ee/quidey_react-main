import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchNotes, createNote, updateNote, removeNote, checklistCount } from '../../features/focus/notebook';
import {
    fetchFolders, createFolder, updateFolder, removeFolder, fetchTrash, emptyTrash,
    parseView, notesInView, sortNotes, tagCounts, firstLine, templateNote, duplicateOf, daysLeftInTrash,
    SORTS, NOTE_TEMPLATES, FOLDER_EMOJIS, FOLDER_NAME_MAX, TRASH_DAYS,
} from '../../features/notes/notes';
import { useCollections } from '../../features/collections/collections';
import { showToast } from '../../features/toast/toast';
import { fill } from '../../features/helperFunction';
import { useTranslation } from '../../i18n/useTranslation';
import NoteEditor from './NoteEditor.jsx';
import ScanSheet from '../scan/ScanSheet.jsx';
import { useAiQuota } from '../../features/ai/ai';
import NotePreview from './NotePreview.jsx';
import ConfirmDeleteButton from '../ConfirmDeleteButton.jsx';
import Icon from '../icons.jsx';
import { Bone } from '../skeleton/Skeleton.jsx';
import styles from './Notes.module.css';

const LAYOUT_KEY = 'notesLayout';
const SORT_KEY = 'notesSort';
const stored = (key, allowed, fallback) => {
    try { const value = localStorage.getItem(key); return allowed.includes(value) ? value : fallback; } catch { return fallback; }
};
const store = (key, value) => { try { localStorage.setItem(key, value); } catch { /* private mode */ } };

// One entry of the views beside the list
function ViewButton({ current, icon, emoji, label, count, onClick }) {
    return (
        <button type="button" className={styles.viewBtn} aria-current={current ? 'true' : undefined} onClick={onClick}>
            {emoji ? <span aria-hidden="true">{emoji}</span> : <Icon name={icon} size={16} />}
            <span>{label}</span>
            {count > 0 && <span className={styles.viewCount}>{count}</span>}
        </button>
    );
}

// A new folder: emoji + name, Enter makes it
function NewFolder({ onCreate, onCancel }) {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [emoji, setEmoji] = useState(FOLDER_EMOJIS[0]);
    return (
        <form className={styles.newFolder} onSubmit={e => { e.preventDefault(); if (name.trim()) onCreate({ name: name.trim(), emoji }); }}
            onKeyDown={e => e.key === 'Escape' && onCancel()}>
            <select value={emoji} onChange={e => setEmoji(e.target.value)} aria-label={t('noteFolderEmoji')}>
                {FOLDER_EMOJIS.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
            <input autoFocus value={name} maxLength={FOLDER_NAME_MAX} onChange={e => setName(e.target.value)} placeholder={t('noteFolderName')} aria-label={t('noteFolderName')} />
            <button type="submit" className={styles.textBtn} disabled={!name.trim()}>{t('noteFolderCreate')}</button>
        </form>
    );
}

// The notes area (/notes, testers): every note of mine, in views beside the list (all, pinned,
// folders, tags, archive, trash), searchable (words, "#tag"), sorted, as a list or as tiles, and
// the open note beside it (on narrow screens instead of the list). New notes start empty or from
// a template, inside the folder / tag being looked at. ?view=… and ?note=<id> are in the address.
export default function NotesPage() {
    const { t, language } = useTranslation();
    const dispatch = useDispatch();
    const [params, setParams] = useSearchParams();
    const viewKey = params.get('view') ?? 'all';
    const view = parseView(viewKey);
    const openId = Number(params.get('note')) || null;

    const [notes, setNotes] = useState(null);
    const aiQuota = useAiQuota();
    const [scanning, setScanning] = useState(false);
    const [trash, setTrash] = useState(null);
    const [folders, setFolders] = useState([]);
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState(() => stored(SORT_KEY, SORTS, 'updated'));
    const [layout, setLayout] = useState(() => stored(LAYOUT_KEY, ['list', 'grid'], 'list'));
    const [addingFolder, setAddingFolder] = useState(false);
    const [renaming, setRenaming] = useState(null);
    useCollections();

    const failed = useCallback(() => dispatch(showToast(t('noteSaveFailed'), 'error')), [dispatch, t]);

    useEffect(() => {
        fetchNotes().then(setNotes).catch(() => setNotes([]));
        fetchTrash().then(setTrash).catch(() => setTrash([]));
        fetchFolders().then(setFolders).catch(() => {});
    }, []);

    const go = (changes, replace = false) => {
        const next = new URLSearchParams(params);
        for (const [key, value] of Object.entries(changes)) {
            if (value === null || value === undefined || (key === 'view' && value === 'all')) next.delete(key); else next.set(key, String(value));
        }
        setParams(next, { replace });
    };
    const openNote = (id) => go({ note: id });
    const closeNote = () => go({ note: null });
    const pickView = (key) => { setQuery(''); go({ view: key, note: null }); };

    const onChange = useCallback((saved) => {
        setNotes(prev => prev?.map(note => note.id === saved.id ? saved : note) ?? prev);
    }, []);

    // counts of folders follow the list (the server's are only the first ones)
    const folderCount = (id) => (notes ?? []).filter(note => note.folderId === id && !note.archived).length;

    const newNote = async (template = null, copy = null) => {
        const base = copy ?? (template ? templateNote(template, language) : {
            title: fill(t('noteNewTitle'), { date: new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'short' }).format(new Date()) }),
            body: '',
        });
        try {
            const note = await createNote({
                ...base,
                // made where I am looking: in this folder, with this tag
                ...(view.kind === 'folder' && !copy ? { folderId: view.folderId } : {}),
                ...(view.kind === 'tag' && !copy ? { tags: [view.tag] } : {}),
                ...(view.kind === 'pinned' && !copy ? { pinned: true } : {}),
            });
            setNotes(prev => [note, ...(prev ?? [])]);
            go({ note: note.id, ...(['archive', 'trash'].includes(view.kind) ? { view: 'all' } : {}) });
        } catch (err) {
            dispatch(showToast(err.code === 'NOTEBOOK_LIMIT' ? t('noteLimit') : err.code === 'NOTEBOOK_STORAGE_FULL' ? t('noteStorageFull') : t('noteSaveFailed'), 'error'));
        }
    };

    const trashNote = async (note) => {
        try {
            const saved = await updateNote(note.id, { trashed: true });
            setNotes(prev => prev.filter(item => item.id !== note.id));
            setTrash(prev => [saved, ...(prev ?? [])]);
            closeNote();
            dispatch(showToast(t('noteTrashed'), 'info', {
                action: { label: t('toastUndo'), run: () => restoreNote(saved) },
            }));
        } catch { failed(); }
    };

    const restoreNote = async (note) => {
        try {
            const saved = await updateNote(note.id, { trashed: false });
            setTrash(prev => (prev ?? []).filter(item => item.id !== note.id));
            setNotes(prev => [saved, ...(prev ?? []).filter(item => item.id !== note.id)]);
        } catch { failed(); }
    };

    const deleteForGood = async (note) => {
        await removeNote(note.id).catch(() => {});
        setTrash(prev => prev.filter(item => item.id !== note.id));
    };

    const clearTrash = async () => {
        try {
            await emptyTrash();
            setTrash([]);
            dispatch(showToast(t('noteTrashEmptied'), 'info'));
        } catch { failed(); }
    };

    const addFolder = async (folder) => {
        try {
            const made = await createFolder(folder);
            setFolders(prev => [...prev, made].sort((a, b) => a.name.localeCompare(b.name)));
            setAddingFolder(false);
            pickView(`folder:${made.id}`);
        } catch (err) {
            dispatch(showToast(err.code === 'FOLDER_EXISTS' ? t('noteFolderExists') : err.code === 'FOLDER_LIMIT' ? t('noteFolderLimit') : t('noteSaveFailed'), 'error'));
        }
    };

    const renameFolder = async (folder, change) => {
        try {
            const saved = await updateFolder(folder.id, change);
            setFolders(prev => prev.map(item => item.id === saved.id ? { ...item, ...saved } : item));
            setRenaming(null);
        } catch (err) {
            dispatch(showToast(err.code === 'FOLDER_EXISTS' ? t('noteFolderExists') : t('noteSaveFailed'), 'error'));
        }
    };

    const deleteFolder = async (folder) => {
        try {
            await removeFolder(folder.id);
            setFolders(prev => prev.filter(item => item.id !== folder.id));
            setNotes(prev => prev.map(note => note.folderId === folder.id ? { ...note, folderId: null } : note));
            pickView('all');
        } catch { failed(); }
    };

    const tags = useMemo(() => tagCounts(notes ?? []), [notes]);
    const shown = useMemo(() => {
        const current = parseView(viewKey);
        if (current.kind === 'trash') return notesInView(trash ?? [], current, query);
        return sortNotes(notesInView(notes ?? [], current, query), sort);
    }, [notes, trash, viewKey, query, sort]);

    const folder = view.kind === 'folder' ? folders.find(item => item.id === view.folderId) : null;
    const open = openId ? notes?.find(note => note.id === openId) : null;
    const folderName = (id) => folders.find(item => item.id === id);
    const dateFmt = new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'short' });
    const activeCount = (notes ?? []).filter(note => !note.archived).length;

    const viewTitle = {
        all: t('notesAll'), pinned: t('notesPinned'), archive: t('notesArchive'), trash: t('notesTrash'),
        folder: folder ? `${folder.emoji ? `${folder.emoji} ` : ''}${folder.name}` : t('noteFolder'),
        tag: `#${view.tag}`,
    }[view.kind];
    const emptyText = query.trim() ? t('noteNoMatch') : {
        all: t('notesEmptyAll'), pinned: t('notesEmptyPinned'), archive: t('notesEmptyArchive'), trash: t('notesEmptyTrash'),
        folder: t('notesEmptyFolder'), tag: t('noteNoMatch'),
    }[view.kind];

    return (
        <div className={styles.page} data-part="notes">
            {scanning && <ScanSheet onClose={() => setScanning(false)}
                onDone={(made) => { if (made.notes) fetchNotes().then(setNotes).catch(() => {}); }} />}
            <header className={styles.head}>
                <div>
                    <h1 className={styles.title}>{t('notesTitle')}</h1>
                    <p className={styles.subtitle}>{t('notesSubtitle')}</p>
                </div>
                <div className={styles.headActions}>
                    <Link to="/collections" className={styles.ghostLink}><Icon name="collection" size={16} /> {t('collections')}</Link>
                    {/* study material read by the AI into notes, entries and a study plan */}
                    {aiQuota?.available &&
                        <button type="button" className={styles.ghostLink} onClick={() => setScanning(true)}>
                            <Icon name="brain" size={16} /> {t('scanTitle')}
                        </button>}
                    <select className={styles.templateSelect} value="" onChange={e => e.target.value && newNote(e.target.value)} aria-label={t('noteFromTemplate')}>
                        <option value="">{t('noteFromTemplate')}</option>
                        {NOTE_TEMPLATES.map(key => <option key={key} value={key}>{t(`noteTpl_${key}_name`)}</option>)}
                    </select>
                    {/* always here, also on phones, where the side's heading (and its plus) is hidden */}
                    <button type="button" className={styles.folderBtn} onClick={() => setAddingFolder(true)} aria-expanded={addingFolder} data-tip="notes-folder"
                        aria-label={t('noteFolderNew')} title={t('noteFolderNew')}>
                        <Icon name="folder" size={18} />
                    </button>
                    <button type="button" className={styles.primary} onClick={() => newNote()} data-tip="notes-new">
                        <Icon name="plus" size={16} /> {t('noteNewLong')}
                    </button>
                </div>
            </header>

            <div className={styles.layout} data-open={open ? '' : undefined}>
                <nav className={styles.side} aria-label={t('notesViews')}>
                    <div className={styles.sideGroup}>
                        <ViewButton current={view.kind === 'all'} icon="note" label={t('notesAll')} count={activeCount} onClick={() => pickView('all')} />
                        <ViewButton current={view.kind === 'pinned'} icon="pin" label={t('notesPinned')}
                            count={(notes ?? []).filter(note => note.pinned && !note.archived).length} onClick={() => pickView('pinned')} />
                    </div>
                    <div className={styles.sideGroup}>
                        <p className={styles.sideHeading}>
                            {t('noteFolders')}
                            <button type="button" className={styles.iconBtn} onClick={() => setAddingFolder(v => !v)} aria-expanded={addingFolder}
                                aria-label={t('noteFolderNew')} title={t('noteFolderNew')}>
                                <Icon name="plus" size={14} />
                            </button>
                        </p>
                        {folders.map(item =>
                            <ViewButton key={item.id} current={view.kind === 'folder' && view.folderId === item.id} emoji={item.emoji} icon="folder"
                                label={item.name} count={notes ? folderCount(item.id) : item.notes} onClick={() => pickView(`folder:${item.id}`)} />)}
                        {addingFolder
                            ? <NewFolder onCreate={addFolder} onCancel={() => setAddingFolder(false)} />
                            : folders.length === 0 &&
                            <button type="button" className={styles.viewBtn} onClick={() => setAddingFolder(true)}>
                                <Icon name="plus" size={16} /><span>{t('noteFolderNew')}</span>
                            </button>}
                    </div>
                    {tags.length > 0 &&
                        <div className={styles.sideGroup}>
                            <p className={styles.sideHeading}>{t('noteTags')}</p>
                            {tags.slice(0, 15).map(({ tag, count }) =>
                                <ViewButton key={tag} current={view.kind === 'tag' && view.tag.toLowerCase() === tag.toLowerCase()} icon="tag"
                                    label={tag} count={count} onClick={() => pickView(`tag:${tag}`)} />)}
                        </div>}
                    <div className={styles.sideGroup}>
                        <ViewButton current={view.kind === 'archive'} icon="archive" label={t('notesArchive')}
                            count={(notes ?? []).filter(note => note.archived).length} onClick={() => pickView('archive')} />
                        <ViewButton current={view.kind === 'trash'} icon="trash" label={t('notesTrash')} count={trash?.length ?? 0} onClick={() => pickView('trash')} />
                    </div>
                </nav>

                <section className={styles.listCol} aria-labelledby="notes-list-title">
                    <div className={styles.listHead}>
                        <h2 id="notes-list-title" className={styles.listTitle}>
                            {renaming && folder
                                ? <form className={styles.newFolder} onSubmit={e => { e.preventDefault(); if (renaming.trim()) renameFolder(folder, { name: renaming.trim() }); }}
                                    onKeyDown={e => e.key === 'Escape' && setRenaming(null)}>
                                    <select value={folder.emoji ?? ''} onChange={e => renameFolder(folder, { emoji: e.target.value || null })} aria-label={t('noteFolderEmoji')}>
                                        <option value="">–</option>
                                        {FOLDER_EMOJIS.map(item => <option key={item} value={item}>{item}</option>)}
                                    </select>
                                    <input autoFocus value={renaming} maxLength={FOLDER_NAME_MAX} onChange={e => setRenaming(e.target.value)} aria-label={t('noteFolderName')} />
                                    <button type="submit" className={styles.textBtn}>{t('save')}</button>
                                </form>
                                : <span>{viewTitle}</span>}
                            {!renaming && <span className={styles.listCount}>{notes === null ? '' : shown.length}</span>}
                            {folder && !renaming &&
                                <span className={styles.titleActions}>
                                    <button type="button" className={styles.iconBtn} onClick={() => setRenaming(folder.name)} aria-label={t('noteFolderRename')} title={t('noteFolderRename')}>
                                        <Icon name="edit" size={15} />
                                    </button>
                                    <ConfirmDeleteButton onConfirm={() => deleteFolder(folder)} label={`${t('noteFolderDelete')}: ${folder.name}`}
                                        title={t('noteFolderDeleteHint')} confirmText={t('noteFolderDeleteConfirm')} />
                                </span>}
                        </h2>
                        <label className={styles.search} data-tip="notes-search">
                            <Icon name="search" size={16} />
                            <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('notesSearch')} aria-label={t('notesSearch')} />
                        </label>
                        {view.kind !== 'trash' && <>
                            <select className={styles.sortSelect} value={sort} onChange={e => { setSort(e.target.value); store(SORT_KEY, e.target.value); }} aria-label={t('notesSort')}>
                                {SORTS.map(key => <option key={key} value={key}>{t(`notesSort_${key}`)}</option>)}
                            </select>
                            <div className={styles.layoutSwitch} role="group" aria-label={t('notesLayout')}>
                                {[['list', 'list', 'notesLayoutList'], ['grid', 'grid', 'notesLayoutGrid']].map(([key, icon, label]) =>
                                    <button key={key} type="button" aria-pressed={layout === key} aria-label={t(label)} title={t(label)}
                                        onClick={() => { setLayout(key); store(LAYOUT_KEY, key); }}>
                                        <Icon name={icon} size={15} />
                                    </button>)}
                            </div>
                        </>}
                    </div>

                    {view.kind === 'trash' && (trash?.length ?? 0) > 0 &&
                        <div className={styles.trashBar}>
                            <p>{fill(t('noteTrashHint'), { days: TRASH_DAYS })}</p>
                            <ConfirmDeleteButton onConfirm={clearTrash} label={t('noteTrashEmpty')} title={t('noteTrashEmpty')} confirmText={t('noteTrashEmptyConfirm')} />
                        </div>}

                    {(view.kind === 'trash' ? trash === null : notes === null)
                        ? <div className={styles.rows}>{[0, 1, 2, 3].map(i => <Bone key={i} h="3.6rem" />)}</div>
                        : shown.length === 0
                            ? <div className={styles.empty}>
                                <Icon name={view.kind === 'trash' ? 'trash' : view.kind === 'archive' ? 'archive' : 'note'} size={28} />
                                <p>{emptyText}</p>
                            </div>
                            : view.kind === 'trash'
                                ? <ul className={styles.rows}>
                                    {shown.map(note =>
                                        <li key={note.id} className={styles.trashRow}>
                                            <span className={styles.trashText}>
                                                <span className={styles.rowTitle}>{note.title || firstLine(note.body) || t('noteUntitled')}</span>
                                                <span className={styles.rowMeta}>{fill(t('noteTrashDaysLeft'), { days: daysLeftInTrash(note) })}</span>
                                            </span>
                                            <button type="button" className={styles.textBtn} onClick={() => restoreNote(note)}>{t('noteRestore')}</button>
                                            <ConfirmDeleteButton onConfirm={() => deleteForGood(note)} label={`${t('noteDeleteForGood')}: ${note.title || t('noteUntitled')}`} title={t('noteDeleteForGood')} />
                                        </li>)}
                                </ul>
                                : <ul className={styles.rows} data-layout={layout}>
                                    {shown.map(note => {
                                        const checks = checklistCount(note.body);
                                        const line = firstLine(note.body);
                                        const inFolder = view.kind !== 'folder' && note.folderId ? folderName(note.folderId) : null;
                                        return (
                                            <li key={note.id}>
                                                <button type="button" className={styles.row} onClick={() => openNote(note.id)}
                                                    aria-current={note.id === openId ? 'true' : undefined} data-task-color={note.color ?? undefined}>
                                                    <span className={styles.rowTitle}>
                                                        {note.pinned && <Icon name="pin" size={13} />}
                                                        {note.title || line || t('noteUntitled')}
                                                    </span>
                                                    <NotePreview note={note} className={styles.rowPreview} max={layout === 'grid' ? 320 : 160} />
                                                    <span className={styles.rowMeta}>
                                                        {inFolder && <span><Icon name="folder" size={12} /> {inFolder.name}</span>}
                                                        {(note.tags ?? []).slice(0, 3).map(tag => <span key={tag} className={styles.rowTag}>#{tag}</span>)}
                                                        {checks.total > 0 && <span>{fill(t('noteChecks'), checks)}</span>}
                                                        {note.attachments.length > 0 && <span><Icon name={note.attachments.some(a => a.kind === 'image') ? 'image' : 'link'} size={12} /> {note.attachments.length}</span>}
                                                        <span>{dateFmt.format(new Date(sort === 'created' ? note.createdAt : note.updatedAt))}</span>
                                                    </span>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>}
                </section>

                <section className={styles.editorCol} aria-label={t('noteOpen')}>
                    {open
                        ? <div className={styles.editorPanel}>
                            <NoteEditor key={open.id} note={open} full folders={folders} onChange={onChange}
                                onClose={closeNote} onTrash={() => trashNote(open)}
                                onDuplicate={(note) => newNote(null, duplicateOf(note, t('noteCopyWord')))} />
                        </div>
                        : <div className={styles.editorEmpty}>
                            <Icon name="note" size={28} />
                            <p>{notes && openId ? t('noteGone') : t('notesPick')}</p>
                        </div>}
                </section>
            </div>
        </div>
    );
}
