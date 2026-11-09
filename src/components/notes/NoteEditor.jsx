import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { fetchNote, updateNote, checklistCount, isWebUrl, shrinkImage, NOTE_IMAGES_MAX, NOTE_ATTACHMENTS_MAX, NOTE_BODY_MAX } from '../../features/focus/notebook';
import { cleanTag, wordCount, readingMinutes, downloadNote, TAGS_MAX } from '../../features/notes/notes';
import { parseQuickEntry } from '../../features/tasks/quickParse';
import { addTask } from '../../features/tasks/taskAction';
import { showToast } from '../../features/toast/toast';
import { fill, dueText } from '../../features/helperFunction';
import { useTranslation } from '../../i18n/useTranslation';
import ConfirmDeleteButton from '../ConfirmDeleteButton.jsx';
import TaskColorPicker from '../task/TaskColorPicker.jsx';
import CollectionPicker from '../collections/CollectionPicker.jsx';
import PinToBoards from '../board/PinToBoards.jsx';
import Icon from '../icons.jsx';
import { Bone } from '../skeleton/Skeleton.jsx';
import NoteText from './NoteText.jsx';
import styles from '../focus/Notebook.module.css';
import own from './Notes.module.css';

const SAVE_AFTER_MS = 700;

// Tags as chips; a new one is typed and taken with Enter, a comma or a space
function TagField({ tags, onChange }) {
    const { t } = useTranslation();
    const [value, setValue] = useState('');
    const take = (raw = value) => {
        const tag = cleanTag(raw);
        setValue('');
        if (!tag || tags.some(other => other.toLowerCase() === tag.toLowerCase()) || tags.length >= TAGS_MAX) return;
        onChange([...tags, tag]);
    };
    return (
        <div className={own.tagField}>
            <Icon name="tag" size={14} />
            {tags.map(tag =>
                <span key={tag} className={own.tag}>
                    #{tag}
                    <button type="button" aria-label={fill(t('noteTagRemove'), { tag })} onClick={() => onChange(tags.filter(other => other !== tag))}>
                        <Icon name="close" size={10} />
                    </button>
                </span>)}
            {tags.length < TAGS_MAX &&
                <input value={value} maxLength={31} placeholder={tags.length ? '' : t('noteTagsPlaceholder')} aria-label={t('noteTags')}
                    onChange={e => (/[\s,]$/.test(e.target.value) ? take(e.target.value) : setValue(e.target.value))}
                    onBlur={() => take()}
                    onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); take(); }
                        if (e.key === 'Backspace' && !value && tags.length) onChange(tags.slice(0, -1));
                    }} />}
        </div>
    );
}

// The open note: title, text, attachments, saved on its own while typing. The text is written
// like in any notes app, without visible marks (NoteText → RichNoteEditor), always editable.
// full (testers, the notes area): also folder, tags, colour, collections, archive, a copy, the
// note as a Markdown file, words and reading time; "delete" puts it into the trash then
// (onTrash). folders: [{ id, name, emoji }]. autoFocus: the cursor goes into the text.
export default function NoteEditor({ note, focusTask, onChange, onDelete, onClose, full = false, folders = [], onTrash, onDuplicate, autoFocus = false }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [draft, setDraft] = useState(note);
    const [status, setStatus] = useState('saved');
    const [linkField, setLinkField] = useState(null);
    const [bigImage, setBigImage] = useState(null);
    const fileInput = useRef(null);
    const pending = useRef(null);
    // the draft as it is now, for the saves that run later (timeouts, async picture work)
    const latest = useRef(draft);
    useEffect(() => { latest.current = draft; }, [draft]);
    // the editor's text since the last save, worked out only when it is saved
    const bodyFrom = useRef(null);
    const takeBody = (keep = true) => {
        if (!bodyFrom.current) return latest.current.body;
        const body = bodyFrom.current();
        bodyFrom.current = null;
        latest.current = { ...latest.current, body };
        if (keep) setDraft(prev => ({ ...prev, body }));
        return body;
    };

    // the pictures' data comes with the single note
    useEffect(() => {
        if (!note.attachments.some(item => item.kind === 'image' && !item.data)) return;
        fetchNote(note.id).then(loaded => setDraft(prev => ({ ...prev, attachments: loaded.attachments }))).catch(() => {});
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

    // title and text as they are now; a text over the limit isn't sent (the status says so)
    const textChange = () => {
        const body = takeBody();
        if (body.length > NOTE_BODY_MAX) { setStatus('tooLong'); return null; }
        return { title: latest.current.title, body };
    };
    // text and title: saved a moment after the last key; the rest at once (with any text still waiting)
    const edit = (change, now = false) => {
        setDraft(prev => ({ ...prev, ...change }));
        latest.current = { ...latest.current, ...change };
        const waiting = pending.current;
        clearTimeout(pending.current);
        pending.current = null;
        if (now) { save({ ...(waiting ? textChange() : null), ...change }); return; }
        setStatus('typing');
        pending.current = setTimeout(() => {
            pending.current = null;
            const text = textChange();
            if (text) save(text);
        }, SAVE_AFTER_MS);
    };
    const editBody = (getBody) => {
        bodyFrom.current = getBody;
        edit({});
    };
    // what is still waiting is saved when the note is closed
    useEffect(() => () => {
        if (pending.current) {
            clearTimeout(pending.current);
            const body = takeBody(false);
            if (body.length <= NOTE_BODY_MAX) updateNote(note.id, { title: latest.current.title, body }).then(onChange).catch(() => {});
        }
    }, [note.id, onChange]);

    // "Lernen für Klausur morgen 14 Uhr" → a task tomorrow at 14:00
    const planLine = async (line) => {
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

    // a link pasted on its own becomes an attachment too (and stays in the text)
    const onPasteLink = (url) => {
        const now = latest.current.attachments;
        if (now.some(item => item.url === url) || now.length >= NOTE_ATTACHMENTS_MAX) return;
        setTimeout(() => setAttachments([...latest.current.attachments, { kind: 'link', url }]), 0);
    };

    const addLink = (e) => {
        e.preventDefault();
        const url = linkField.url.trim();
        if (!isWebUrl(url)) { dispatch(showToast(t('noteLinkInvalid'), 'error')); return; }
        setAttachments([...attachments, { kind: 'link', url, ...(linkField.title.trim() ? { title: linkField.title.trim() } : {}) }]);
        setLinkField(null);
    };

    const checks = checklistCount(draft.body);
    const words = full ? wordCount(draft.body) : 0;
    const statusText = { saved: t('noteSaved'), saving: t('noteSaving'), typing: '', error: t('noteSaveFailed'), tooLong: t('noteTooLong') }[status];

    return (
        <article className={styles.editor} aria-label={draft.title || t('noteUntitled')} data-task-color={full && draft.color ? draft.color : undefined}>
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
                {full
                    ? <button type="button" className={styles.iconBtn} onClick={onTrash} aria-label={`${t('noteToTrash')}: ${draft.title || t('noteUntitled')}`} title={t('noteToTrash')}>
                        <Icon name="trash" size={18} />
                    </button>
                    : <ConfirmDeleteButton onConfirm={onDelete} label={`${t('noteDelete')}: ${draft.title || t('noteUntitled')}`} />}
            </div>

            <div className={styles.metaRow}>
                {checks.total > 0 && <span className={styles.metaText}>{fill(t('noteChecks'), checks)}</span>}
                {full && words > 0 && <span className={styles.metaText}>{fill(t(words === 1 ? 'noteWordsOne' : 'noteWords'), { n: words, min: readingMinutes(words) })}</span>}
                {draft.archived && <span className={own.badge}><Icon name="archive" size={12} /> {t('noteArchived')}</span>}
                {focusTask && (draft.taskId === focusTask.id
                    ? <button type="button" className={styles.taskChip} onClick={() => edit({ taskId: null }, true)} title={t('noteUnlinkTask')}>
                        <Icon name="focus" size={14} /> {focusTask.name} <Icon name="close" size={12} />
                    </button>
                    : !draft.taskId && <button type="button" className={styles.linkBtn} onClick={() => edit({ taskId: focusTask.id }, true)}>
                        {fill(t('noteLinkTask'), { name: focusTask.name })}
                    </button>)}
                <span className={styles.status} role="status">{statusText}</span>
            </div>

            {full &&
                <div className={own.details}>
                    <label className={own.folderField}>
                        <Icon name="folder" size={14} />
                        <span className={own.srOnly}>{t('noteFolder')}</span>
                        <select value={draft.folderId ?? ''} onChange={e => edit({ folderId: e.target.value ? Number(e.target.value) : null }, true)}>
                            <option value="">{t('noteNoFolder')}</option>
                            {folders.map(folder => <option key={folder.id} value={folder.id}>{folder.emoji ? `${folder.emoji} ` : ''}{folder.name}</option>)}
                        </select>
                    </label>
                    <TagField tags={draft.tags ?? []} onChange={tags => edit({ tags }, true)} />
                    <div className={own.colorRow}><TaskColorPicker value={draft.color ?? null} onChange={color => edit({ color }, true)} hideLabel /></div>
                </div>}

            <NoteText body={note.body} onChange={editBody} label={t('noteText')} placeholder={t('notePlaceholder')} autoFocus={autoFocus}
                onPasteFiles={addImages} onPasteLink={onPasteLink}
                tools={({ currentLine }) => <>
                    <button type="button" onClick={() => setLinkField({ url: '', title: '' })} title={t('noteToolLink')}><Icon name="link" size={16} /><span>{t('noteToolLink')}</span></button>
                    <button type="button" onClick={() => fileInput.current?.click()} title={t('noteToolImage')}><Icon name="image" size={16} /><span>{t('noteToolImage')}</span></button>
                    <button type="button" onClick={() => planLine(currentLine())} title={t('noteToolPlanHint')}><Icon name="calendar" size={16} /><span>{t('noteToolPlan')}</span></button>
                    <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={e => { addImages([...e.target.files]); e.target.value = ''; }} />
                </>} />

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

            <PinToBoards noteId={note.id} />

            {full &&
                <>
                    <CollectionPicker item={{ kind: 'note', id: note.id }} name={draft.title} />
                    <div className={own.actions}>
                        <button type="button" className={own.actionBtn} onClick={() => edit({ archived: !draft.archived }, true)}>
                            <Icon name="archive" size={15} /> {draft.archived ? t('noteUnarchive') : t('noteArchive')}
                        </button>
                        {onDuplicate &&
                            <button type="button" className={own.actionBtn} onClick={() => onDuplicate(latest.current)}>
                                <Icon name="copy" size={15} /> {t('noteDuplicate')}
                            </button>}
                        <button type="button" className={own.actionBtn} onClick={() => downloadNote(latest.current)}>
                            <Icon name="download" size={15} /> {t('noteExport')}
                        </button>
                    </div>
                </>}

            {bigImage &&
                <div className={styles.lightbox} role="dialog" aria-label={bigImage.name || t('noteImage')} onClick={() => setBigImage(null)}
                    onKeyDown={e => e.key === 'Escape' && setBigImage(null)}>
                    <img src={bigImage.data} alt={bigImage.name || t('noteImage')} />
                    <button type="button" autoFocus className={styles.lightboxClose} aria-label={t('close')}><Icon name="close" size={20} /></button>
                </div>}
        </article>
    );
}
