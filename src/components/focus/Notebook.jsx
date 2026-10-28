import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { fetchNotes, fetchNote, createNote, updateNote, removeNote, noteLines, toggleCheck, checklistCount, linkParts, isWebUrl, shrinkImage, NOTE_IMAGES_MAX, NOTE_ATTACHMENTS_MAX } from '../../features/focus/notebook';
import { parseQuickEntry } from '../../features/tasks/quickParse';
import { addTask } from '../../features/tasks/taskAction';
import { showToast } from '../../features/toast/toast';
import { fill, dueText } from '../../features/helperFunction';
import { useTranslation } from '../../i18n/useTranslation';
import ConfirmDeleteButton from '../ConfirmDeleteButton.jsx';
import Icon from '../icons.jsx';
import { Bone } from '../skeleton/Skeleton.jsx';
import styles from './Notebook.module.css';

const SAVE_AFTER_MS = 700;

// A note's text as it reads: checklist lines can be ticked right here, "# " lines are headings,
// links can be opened. Plain text only, never HTML.
function NoteView({ body, onToggle }) {
    const lines = noteLines(body);
    return (
        <div className={styles.view}>
            {lines.map(line => {
                const text = linkParts(line.text).map((part, i) => part.link
                    ? <a key={i} href={part.text} target="_blank" rel="noopener noreferrer">{part.text}</a>
                    : <span key={i}>{part.text}</span>);
                if (line.kind === 'check') return (
                    <label key={line.index} className={styles.checkLine} data-done={line.done || undefined}>
                        <input type="checkbox" checked={line.done} onChange={() => onToggle(line.index)} />
                        <span>{text}</span>
                    </label>);
                if (line.kind === 'heading') return <h4 key={line.index} className={styles.heading}>{text}</h4>;
                return <p key={line.index} className={styles.textLine}>{line.text ? text : ' '}</p>;
            })}
        </div>
    );
}

// The open note: title, text (write / read), attachments, saved on its own while typing
function NoteEditor({ note, focusTask, onChange, onDelete, onClose }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [draft, setDraft] = useState(note);
    const [writing, setWriting] = useState(!note.body.trim());
    const [status, setStatus] = useState('saved');
    const [linkField, setLinkField] = useState(null);
    const [bigImage, setBigImage] = useState(null);
    const area = useRef(null);
    const fileInput = useRef(null);
    const pending = useRef(null);
    // the draft as it is now, for the saves that run later (timeouts, async picture work)
    const latest = useRef(draft);
    useEffect(() => { latest.current = draft; }, [draft]);

    // the pictures' data comes with the single note
    useEffect(() => {
        if (!note.attachments.some(item => item.kind === 'image' && !item.data)) return;
        fetchNote(note.id).then(full => setDraft(prev => ({ ...prev, attachments: full.attachments }))).catch(() => {});
    }, [note.id, note.attachments]);

    // what the server has, to go back to when it refuses attachments (no room for more pictures)
    const lastSaved = useRef(note);
    const save = useCallback(async (change) => {
        setStatus('saving');
        try {
            const saved = await updateNote(note.id, change);
            lastSaved.current = { ...lastSaved.current, ...saved, attachments: saved.attachments ?? lastSaved.current.attachments };
            setStatus('saved');
            onChange(saved);
        } catch (err) {
            if (err.code === 'NOTEBOOK_STORAGE_FULL') {
                setDraft(prev => ({ ...prev, attachments: lastSaved.current.attachments }));
                dispatch(showToast(t('noteStorageFull'), 'error'));
                setStatus('saved');
                return;
            }
            setStatus('error');
        }
    // t only changes with the language
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [note.id, onChange, dispatch]);

    // text and title: saved a moment after the last key; the rest at once
    const edit = (change, now = false) => {
        setDraft(prev => ({ ...prev, ...change }));
        clearTimeout(pending.current);
        if (now) { save(change); return; }
        setStatus('typing');
        pending.current = setTimeout(() => save({ title: latest.current.title, body: latest.current.body }), SAVE_AFTER_MS);
    };
    // what is still waiting is saved when the note is closed
    useEffect(() => () => {
        if (pending.current) {
            clearTimeout(pending.current);
            updateNote(note.id, { title: latest.current.title, body: latest.current.body }).then(onChange).catch(() => {});
        }
    }, [note.id, onChange]);

    // writes text at the start of the line the cursor is in
    const prefixLine = (prefix) => {
        const el = area.current;
        const body = draft.body;
        const at = el ? el.selectionStart : body.length;
        const start = body.lastIndexOf('\n', at - 1) + 1;
        edit({ body: body.slice(0, start) + prefix + body.slice(start) });
        requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + prefix.length, at + prefix.length); });
    };

    const currentLine = () => {
        const el = area.current;
        const body = draft.body;
        const at = el ? el.selectionStart : 0;
        const start = body.lastIndexOf('\n', at - 1) + 1;
        const end = body.indexOf('\n', at);
        return body.slice(start, end === -1 ? body.length : end).replace(/^\s*(- \[( |x|X)\] |# |- )/, '').trim();
    };

    // "Lernen für Klausur morgen 14 Uhr" → a task tomorrow at 14:00
    const planLine = async () => {
        const line = currentLine();
        if (!line) { dispatch(showToast(t('notePlanEmpty'))); return; }
        const parsed = parseQuickEntry(line);
        try {
            const task = await dispatch(addTask(parsed.name, parsed.due, '', parsed.prio, null, undefined, parsed.time ? { due_time: parsed.time } : {}));
            const when = task.due ? ` · ${dueText(task.due, t)}${parsed.time ? ` ${parsed.time}` : ''}` : '';
            dispatch(showToast(fill(t('notePlanned'), { name: task.name }) + when, 'success'));
        } catch {
            dispatch(showToast(t('notePlanFailed'), 'error'));
        }
    };

    const attachments = draft.attachments;
    const images = attachments.filter(item => item.kind === 'image').length;
    const setAttachments = (next) => edit({ attachments: next }, true);

    const addImages = async (files) => {
        for (const file of files) {
            if (images >= NOTE_IMAGES_MAX || latest.current.attachments.length >= NOTE_ATTACHMENTS_MAX) {
                dispatch(showToast(fill(t('noteImagesMax'), { n: NOTE_IMAGES_MAX }), 'error'));
                return;
            }
            const data = await shrinkImage(file).catch(() => null);
            if (!data) { dispatch(showToast(t('noteImageTooBig'), 'error')); continue; }
            setAttachments([...latest.current.attachments, { kind: 'image', data, name: file.name || null }]);
        }
    };

    const onPaste = (e) => {
        const files = [...(e.clipboardData?.files ?? [])].filter(file => file.type.startsWith('image/'));
        if (files.length) { e.preventDefault(); addImages(files); return; }
        // a link pasted on its own becomes an attachment too (and stays in the text)
        const text = e.clipboardData?.getData('text') ?? '';
        if (isWebUrl(text) && !attachments.some(item => item.url === text.trim()) && attachments.length < NOTE_ATTACHMENTS_MAX) {
            setTimeout(() => setAttachments([...latest.current.attachments, { kind: 'link', url: text.trim() }]), 0);
        }
    };

    const addLink = (e) => {
        e.preventDefault();
        const url = linkField.url.trim();
        if (!isWebUrl(url)) { dispatch(showToast(t('noteLinkInvalid'), 'error')); return; }
        setAttachments([...attachments, { kind: 'link', url, ...(linkField.title.trim() ? { title: linkField.title.trim() } : {}) }]);
        setLinkField(null);
    };

    const checks = checklistCount(draft.body);
    const statusText = { saved: t('noteSaved'), saving: t('noteSaving'), typing: '', error: t('noteSaveFailed') }[status];

    return (
        <article className={styles.editor} aria-label={draft.title || t('noteUntitled')}>
            <div className={styles.editorHead}>
                <button type="button" className={styles.iconBtn} onClick={onClose} aria-label={t('noteBack')} title={t('noteBack')}>
                    <Icon name="release" size={18} />
                </button>
                <input className={styles.titleInput} value={draft.title} maxLength={120} placeholder={t('noteTitlePlaceholder')}
                    aria-label={t('noteTitle')} onChange={e => edit({ title: e.target.value })} />
                <button type="button" className={styles.iconBtn} aria-pressed={draft.pinned} onClick={() => edit({ pinned: !draft.pinned }, true)}
                    aria-label={draft.pinned ? t('noteUnpin') : t('notePin')} title={draft.pinned ? t('noteUnpin') : t('notePin')} data-on={draft.pinned || undefined}>
                    <Icon name="pin" size={18} />
                </button>
                <ConfirmDeleteButton onConfirm={onDelete} label={`${t('noteDelete')}: ${draft.title || t('noteUntitled')}`} />
            </div>

            <div className={styles.metaRow}>
                <div className={styles.segmentedSmall} role="group" aria-label={t('noteMode')}>
                    <button type="button" aria-pressed={!writing} onClick={() => setWriting(false)}>{t('noteRead')}</button>
                    <button type="button" aria-pressed={writing} onClick={() => setWriting(true)}>{t('noteWrite')}</button>
                </div>
                {checks.total > 0 && <span className={styles.metaText}>{fill(t('noteChecks'), checks)}</span>}
                {focusTask && (draft.taskId === focusTask.id
                    ? <button type="button" className={styles.taskChip} onClick={() => edit({ taskId: null }, true)} title={t('noteUnlinkTask')}>
                        <Icon name="focus" size={14} /> {focusTask.name} <Icon name="close" size={12} />
                    </button>
                    : !draft.taskId && <button type="button" className={styles.linkBtn} onClick={() => edit({ taskId: focusTask.id }, true)}>
                        {fill(t('noteLinkTask'), { name: focusTask.name })}
                    </button>)}
                <span className={styles.status} role="status">{statusText}</span>
            </div>

            {writing
                ? <>
                    <div className={styles.toolbar} role="toolbar" aria-label={t('noteTools')}>
                        <button type="button" onClick={() => prefixLine('- [ ] ')} title={t('noteToolCheck')}><Icon name="checklist" size={16} /><span>{t('noteToolCheck')}</span></button>
                        <button type="button" onClick={() => prefixLine('# ')} title={t('noteToolHeading')}><span className={styles.hMark}>H</span><span>{t('noteToolHeading')}</span></button>
                        <button type="button" onClick={() => setLinkField({ url: '', title: '' })} title={t('noteToolLink')}><Icon name="link" size={16} /><span>{t('noteToolLink')}</span></button>
                        <button type="button" onClick={() => fileInput.current?.click()} title={t('noteToolImage')}><Icon name="image" size={16} /><span>{t('noteToolImage')}</span></button>
                        <button type="button" onClick={planLine} title={t('noteToolPlanHint')}><Icon name="calendar" size={16} /><span>{t('noteToolPlan')}</span></button>
                        <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={e => { addImages([...e.target.files]); e.target.value = ''; }} />
                    </div>
                    <textarea ref={area} className={styles.area} value={draft.body} maxLength={20000} onPaste={onPaste}
                        placeholder={t('notePlaceholder')} aria-label={t('noteText')} onChange={e => edit({ body: e.target.value })} />
                </>
                : <div className={styles.readArea} onDoubleClick={() => setWriting(true)}>
                    {draft.body.trim()
                        ? <NoteView body={draft.body} onToggle={(index) => edit({ body: toggleCheck(draft.body, index) }, true)} />
                        : <p className={styles.emptyText}>{t('noteEmptyRead')}</p>}
                </div>}

            {linkField &&
                <form className={styles.linkForm} onSubmit={addLink}>
                    <input autoFocus type="url" placeholder="https://…" value={linkField.url} aria-label={t('noteLinkUrl')}
                        onChange={e => setLinkField({ ...linkField, url: e.target.value })} />
                    <input placeholder={t('noteLinkTitle')} value={linkField.title} maxLength={120} aria-label={t('noteLinkTitle')}
                        onChange={e => setLinkField({ ...linkField, title: e.target.value })} />
                    <button type="submit" className={styles.smallPrimary}>{t('noteLinkAdd')}</button>
                    <button type="button" className={styles.linkBtn} onClick={() => setLinkField(null)}>{t('cancel')}</button>
                </form>}

            {attachments.length > 0 &&
                <ul className={styles.attachments} aria-label={t('noteAttachments')}>
                    {attachments.map((item, i) => item.kind === 'link'
                        ? <li key={i} className={styles.linkChip}>
                            <Icon name="link" size={14} />
                            <a href={item.url} target="_blank" rel="noopener noreferrer" title={item.url}>{item.title || item.url.replace(/^https?:\/\/(www\.)?/, '')}</a>
                            <button type="button" aria-label={t('noteRemoveAttachment')} onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}><Icon name="close" size={12} /></button>
                        </li>
                        : <li key={i} className={styles.imageChip}>
                            {item.data
                                ? <button type="button" className={styles.thumb} onClick={() => setBigImage(item)} aria-label={item.name || t('noteImage')}>
                                    <img src={item.data} alt={item.name || t('noteImage')} />
                                </button>
                                : <Bone w="4.5rem" h="4.5rem" />}
                            <button type="button" className={styles.removeImage} aria-label={t('noteRemoveAttachment')} onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}><Icon name="close" size={12} /></button>
                        </li>)}
                </ul>}

            {bigImage &&
                <div className={styles.lightbox} role="dialog" aria-label={bigImage.name || t('noteImage')} onClick={() => setBigImage(null)}
                    onKeyDown={e => e.key === 'Escape' && setBigImage(null)}>
                    <img src={bigImage.data} alt={bigImage.name || t('noteImage')} />
                    <button type="button" autoFocus className={styles.lightboxClose} aria-label={t('close')}><Icon name="close" size={20} /></button>
                </div>}
        </article>
    );
}

// The Fokusraum's notebook: the list (pinned first, searchable, "about this task") and the open note
export default function Notebook({ focusTask }) {
    const { t, language } = useTranslation();
    const dispatch = useDispatch();
    const [notes, setNotes] = useState(null);
    const [openId, setOpenId] = useState(null);
    const [query, setQuery] = useState('');
    const [onlyTask, setOnlyTask] = useState(false);

    useEffect(() => {
        fetchNotes().then(setNotes).catch(() => setNotes([]));
    }, []);

    const onChange = useCallback((saved) => {
        setNotes(prev => prev?.map(note => note.id === saved.id ? saved : note) ?? prev);
    }, []);

    const newNote = async (extra = {}) => {
        try {
            const note = await createNote({ title: '', body: extra.body ?? '', taskId: extra.taskId ?? null, ...(extra.title ? { title: extra.title } : {}) });
            setNotes(prev => [note, ...(prev ?? [])]);
            setOpenId(note.id);
        } catch (err) {
            dispatch(showToast(err.code === 'NOTEBOOK_LIMIT' ? t('noteLimit') : err.code === 'NOTEBOOK_STORAGE_FULL' ? t('noteStorageFull') : t('noteSaveFailed'), 'error'));
        }
    };
    // an empty note isn't allowed by the server: a new one is called after its day, to write over
    const startNote = () => newNote({
        title: fill(t('noteNewTitle'), { date: new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'short' }).format(new Date()) }),
        taskId: onlyTask && focusTask ? focusTask.id : null,
    });

    const deleteNote = async (id) => {
        await removeNote(id).catch(() => {});
        setNotes(prev => prev.filter(note => note.id !== id));
        setOpenId(null);
    };

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return (notes ?? [])
            .filter(note => !onlyTask || (focusTask && note.taskId === focusTask.id))
            .filter(note => !q || note.title.toLowerCase().includes(q) || note.body.toLowerCase().includes(q))
            .sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.updatedAt) - new Date(a.updatedAt));
    }, [notes, query, onlyTask, focusTask]);

    const open = notes?.find(note => note.id === openId);
    if (open) return <NoteEditor key={open.id} note={open} focusTask={focusTask} onChange={onChange} onDelete={() => deleteNote(open.id)} onClose={() => setOpenId(null)} />;

    const dateFmt = new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'short' });
    return (
        <div className={styles.list}>
            <div className={styles.listHead}>
                <div className={styles.search}>
                    <Icon name="search" size={16} />
                    <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('noteSearch')} aria-label={t('noteSearch')} />
                </div>
                <button type="button" className={styles.smallPrimary} onClick={startNote}><Icon name="plus" size={16} /> {t('noteNew')}</button>
            </div>
            {focusTask &&
                <label className={styles.filter}>
                    <input type="checkbox" checked={onlyTask} onChange={e => setOnlyTask(e.target.checked)} />
                    {fill(t('noteOnlyTask'), { name: focusTask.name })}
                </label>}
            {notes === null
                ? <div className={styles.rows}>{[0, 1, 2].map(i => <Bone key={i} h="3.5rem" />)}</div>
                : shown.length === 0
                    ? <div className={styles.empty}>
                        <Icon name="note" size={28} />
                        <p>{notes.length === 0 ? t('noteEmptyList') : t('noteNoMatch')}</p>
                    </div>
                    : <ul className={styles.rows}>
                        {shown.map(note => {
                            const checks = checklistCount(note.body);
                            const firstLine = note.body.split('\n').map(line => line.replace(/^\s*(- \[( |x|X)\] |# )/, '').trim()).find(Boolean) ?? '';
                            return (
                                <li key={note.id}>
                                    <button type="button" className={styles.row} onClick={() => setOpenId(note.id)}>
                                        <span className={styles.rowTitle}>
                                            {note.pinned && <Icon name="pin" size={13} />}
                                            {note.title || firstLine || t('noteUntitled')}
                                        </span>
                                        <span className={styles.rowMeta}>
                                            {note.title && firstLine && <span className={styles.rowPreview}>{firstLine}</span>}
                                            {checks.total > 0 && <span>{fill(t('noteChecks'), checks)}</span>}
                                            {note.attachments.length > 0 && <span><Icon name={note.attachments.some(a => a.kind === 'image') ? 'image' : 'link'} size={12} /> {note.attachments.length}</span>}
                                            <span>{dateFmt.format(new Date(note.updatedAt))}</span>
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>}
        </div>
    );
}

