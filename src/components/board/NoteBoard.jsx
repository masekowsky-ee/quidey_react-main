import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { useBoard, fetchBoardNote, pinToBoard, unpinFromBoard, boardErrorText, BOARD_NOTES_MAX } from '../../features/board/board';
import { fetchNotes } from '../../features/focus/notebook';
import { firstLine, matchesQuery, sortNotes } from '../../features/notes/notes';
import { useIsTester } from '../../features/auth/tester';
import { useSheet, useFocusOnArrival } from '../../features/layout/dragDismiss';
import { useNow } from '../../features/together/work';
import { showToast } from '../../features/toast/toast';
import { displayName, fill, formatRelative } from '../../features/helperFunction';
import { useTranslation } from '../../i18n/useTranslation';
import { NoteView } from '../notes/NoteEditor.jsx';
import NotePreview from '../notes/NotePreview.jsx';
import Avatar from '../together/Avatar';
import SheetGrabber from '../SheetGrabber.jsx';
import Icon from '../icons.jsx';
import { Bone } from '../skeleton/Skeleton.jsx';
import styles from './NoteBoard.module.css';

// A sheet of this board (the open note, the picker): a cross, Escape or a click beside it closes it
function BoardSheet({ title, onClose, children, wide = false }) {
    const { t } = useTranslation();
    const titleId = useId();
    const sheet = useSheet(onClose);
    const { dismiss } = sheet;
    // away the way it came, then closed, then `then` (dismiss(then) alone would skip onClose)
    const close = (then) => dismiss(() => { onClose(); then?.(); });
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); dismiss(); } };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [dismiss]);
    return createPortal(
        <div className={styles.backdrop} {...sheet.backdrop} onPointerDown={(e) => { if (e.target === e.currentTarget) dismiss(); }}>
            <div className={styles.dialog} data-wide={wide || undefined} role="dialog" aria-modal="true" aria-labelledby={titleId} {...sheet.panel}>
                <SheetGrabber />
                <div className={styles.head} data-sheet-drag>
                    <h2 id={titleId} className={styles.title}>{title}</h2>
                    <button type="button" className={styles.close} onClick={() => dismiss()} aria-label={t('close')}>
                        <Icon name="close" size={18} />
                    </button>
                </div>
                {children(close)}
            </div>
        </div>,
        document.body
    );
}

// One pinned note, read in full (with its pictures); mine: a way to my notes, canRemove: off the board
function PinnedNote({ kind, boardId, pin, onClose, onRemove }) {
    const { t, language } = useTranslation();
    const isTester = useIsTester();
    const now = useNow(true, 60 * 1000);
    const locale = language === 'de' ? 'de-DE' : 'en-GB';
    const [full, setFull] = useState(null);
    const [bigImage, setBigImage] = useState(null);
    useEffect(() => {
        fetchBoardNote(kind, boardId, pin.id).then(setFull).catch(() => setFull(pin));
    }, [kind, boardId, pin]);
    const note = full ?? pin;
    const links = note.attachments.filter(item => item.kind === 'link');
    const images = note.attachments.filter(item => item.kind === 'image');

    return (
        <BoardSheet title={note.title || firstLine(note.body) || t('noteUntitled')} onClose={onClose} wide>
            {(dismiss) => <>
                <p className={styles.byline}>
                    <Avatar user={note.owner} small />
                    <span>{fill(t('noteBoardBy'), { name: displayName(note.owner) })} · {fill(t('noteBoardChanged'), { when: formatRelative(note.updatedAt, now, locale) })}</span>
                </p>
                <div className={styles.readBody} data-task-color={note.color ?? undefined}>
                    {note.body.trim()
                        ? <NoteView body={note.body} rich />
                        : <p className={styles.muted}>{t('notePreviewEmpty')}</p>}
                </div>
                {links.length > 0 &&
                    <ul className={styles.links} aria-label={t('noteAttachments')}>
                        {links.map((item, i) =>
                            <li key={i}>
                                <Icon name="link" size={14} />
                                <a href={item.url} target="_blank" rel="noopener noreferrer" title={item.url}>{item.title || item.url.replace(/^https?:\/\/(www\.)?/, '')}</a>
                            </li>)}
                    </ul>}
                {images.length > 0 &&
                    <ul className={styles.images} aria-label={t('noteAttachments')}>
                        {images.map((item, i) =>
                            <li key={i}>
                                {item.data
                                    ? <button type="button" className={styles.thumb} onClick={() => setBigImage(item)} aria-label={item.name || t('noteImage')}>
                                        <img src={item.data} alt={item.name || t('noteImage')} />
                                    </button>
                                    : <Bone w="5rem" h="5rem" />}
                            </li>)}
                    </ul>}
                <div className={styles.actions}>
                    {pin.mine &&
                        <Link className={styles.quiet} to={isTester ? `/notes?note=${pin.noteId}` : '/focus'}>
                            <Icon name="edit" size={15} /> {t(isTester ? 'noteBoardEditInNotes' : 'noteBoardEditInFocus')}
                        </Link>}
                    {pin.canRemove &&
                        <button type="button" className={styles.quiet} onClick={() => dismiss(() => onRemove(pin))}>
                            <Icon name="pin" size={15} /> {t('noteBoardUnpin')}
                        </button>}
                </div>
                {/* on the body: the sheet moves (a transform), which would hold a fixed layer inside it */}
                {bigImage && createPortal(
                    <div className={styles.lightbox} role="dialog" aria-label={bigImage.name || t('noteImage')} onClick={() => setBigImage(null)}>
                        <img src={bigImage.data} alt={bigImage.name || t('noteImage')} />
                    </div>,
                    document.body
                )}
            </>}
        </BoardSheet>
    );
}

// Picking one of my notes to pin here (the ones already here are marked)
function PinPicker({ pinnedIds, onPick, onClose }) {
    const { t } = useTranslation();
    const [notes, setNotes] = useState(null);
    const [query, setQuery] = useState('');
    const field = useRef(null);
    useFocusOnArrival(field);
    useEffect(() => { fetchNotes().then(setNotes).catch(() => setNotes([])); }, []);
    const shown = useMemo(() => sortNotes((notes ?? []).filter(note => !note.archived && matchesQuery(note, query)), 'updated'), [notes, query]);

    return (
        <BoardSheet title={t('noteBoardPickTitle')} onClose={onClose}>
            {(dismiss) => <>
                <p className={styles.muted}>{t('noteBoardPickHint')}</p>
                <label className={styles.search}>
                    <Icon name="search" size={16} />
                    <input ref={field} type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('noteSearch')} aria-label={t('noteSearch')} />
                </label>
                {notes === null
                    ? <div className={styles.pickList}>{[0, 1, 2].map(i => <Bone key={i} h="3.2rem" />)}</div>
                    : shown.length === 0
                        ? <p className={styles.muted}>{notes.length === 0 ? t('noteBoardPickNone') : t('noteNoMatch')}</p>
                        : <ul className={styles.pickList}>
                            {shown.map(note => {
                                const here = pinnedIds.has(note.id);
                                return (
                                    <li key={note.id}>
                                        <button type="button" className={styles.pickRow} disabled={here} data-task-color={note.color ?? undefined}
                                            onClick={() => dismiss(() => onPick(note))}>
                                            <span className={styles.pickTitle}>{note.title || firstLine(note.body) || t('noteUntitled')}</span>
                                            <NotePreview note={note} className={styles.preview} />
                                            {here && <span className={styles.pickHere}><Icon name="pin" size={12} /> {t('noteBoardAlreadyPinned')}</span>}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>}
            </>}
        </BoardSheet>
    );
}

// The notes pinned to a family's or a session's board, as cards; any member pins one of their own
// (canPin: not on an ended session). kind: 'family' | 'session'.
export default function NoteBoard({ kind, id, canPin = true }) {
    const { t, language } = useTranslation();
    const dispatch = useDispatch();
    const now = useNow(true, 60 * 1000);
    const locale = language === 'de' ? 'de-DE' : 'en-GB';
    const { pins, setPins, reload } = useBoard(kind, id);
    const [open, setOpen] = useState(null);
    const [picking, setPicking] = useState(false);

    const failed = (err) => dispatch(showToast(boardErrorText(t, err), 'error'));
    const pin = async (note) => {
        try {
            const pinned = await pinToBoard(kind, id, note.id);
            setPins(prev => [pinned, ...(prev ?? []).filter(item => item.id !== pinned.id)]);
            dispatch(showToast(t('noteBoardPinned'), 'success'));
        } catch (err) { failed(err); }
    };
    const remove = async (item) => {
        try {
            await unpinFromBoard(kind, id, item.id);
            setPins(prev => (prev ?? []).filter(other => other.id !== item.id));
            dispatch(showToast(t('noteBoardUnpinned'), 'info'));
        } catch (err) { failed(err); reload(); }
    };

    const mineHere = new Set((pins ?? []).filter(item => item.mine).map(item => item.noteId));
    const full = (pins?.length ?? 0) >= BOARD_NOTES_MAX;

    return (
        <div className={styles.board} data-part="note-board">
            <div className={styles.boardHead}>
                <h3 className={styles.boardTitle}><Icon name="pin" size={15} /> {t('noteBoardNotes')}</h3>
                {canPin && !full &&
                    <button type="button" className={styles.pinBtn} onClick={() => setPicking(true)}>
                        <Icon name="plus" size={15} /> {t('noteBoardPinNote')}
                    </button>}
            </div>
            {pins === null
                ? <div className={styles.grid}>{[0, 1].map(i => <Bone key={i} h="6.5rem" />)}</div>
                : pins.length === 0
                    ? <p className={styles.muted}>{t(canPin ? 'noteBoardEmpty' : 'noteBoardEmptyEnded')}</p>
                    : <ul className={styles.grid}>
                        {pins.map(item =>
                            <li key={item.id}>
                                <button type="button" className={styles.card} data-task-color={item.color ?? undefined} onClick={() => setOpen(item)}>
                                    <span className={styles.cardTitle}>{item.title || firstLine(item.body) || t('noteUntitled')}</span>
                                    <NotePreview note={item} className={styles.preview} max={220} />
                                    <span className={styles.cardMeta}>
                                        <Avatar user={item.owner} small />
                                        <span>{displayName(item.owner)}</span>
                                        <span aria-hidden="true">·</span>
                                        <time dateTime={item.updatedAt}>{formatRelative(item.updatedAt, now, locale)}</time>
                                        {item.attachments.length > 0 &&
                                            <span className={styles.attach}><Icon name={item.attachments.some(a => a.kind === 'image') ? 'image' : 'link'} size={12} /> {item.attachments.length}</span>}
                                    </span>
                                </button>
                            </li>)}
                    </ul>}
            {open && <PinnedNote kind={kind} boardId={id} pin={open} onClose={() => setOpen(null)} onRemove={remove} />}
            {picking && <PinPicker pinnedIds={mineHere} onPick={pin} onClose={() => setPicking(false)} />}
        </div>
    );
}
