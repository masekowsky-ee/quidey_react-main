import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { fetchNotes, createNote, updateNote, removeNote } from '../focus/notebook';
import { fetchFolders } from './notes';
import { showToast } from '../toast/toast';
import { useTranslation } from '../../i18n/useTranslation';
import { localeOf } from '../../i18n/locale';

// Makes a note; a failure is toasted (limit, full storage, else "could not save") and gives null.
export function useCreateNote() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    return useCallback(async (data) => {
        try {
            return await createNote(data);
        } catch (err) {
            const text = err.code === 'NOTEBOOK_LIMIT' ? t('noteLimit')
                : err.code === 'NOTEBOOK_STORAGE_FULL' ? t('noteStorageFull') : t('noteSaveFailed');
            dispatch(showToast(text, 'error'));
            return null;
        }
    }, [dispatch, t]);
}

// My notes (null while loading; a failed load is an empty list) and what is done to the list.
// enabled=false waits with the first load.
export function useNotes({ enabled = true } = {}) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [notes, setNotes] = useState(null);
    const createOrToast = useCreateNote();

    useEffect(() => {
        if (enabled && notes === null) fetchNotes().then(setNotes).catch(() => setNotes([]));
    }, [enabled, notes]);

    // a failed reload keeps the list as it is
    const refetch = useCallback(() => { fetchNotes().then(setNotes).catch(() => {}); }, []);
    // the scan sheet made notes: they are not in the list yet
    const onScanDone = useCallback((made) => { if (made.notes) refetch(); }, [refetch]);

    const merge = useCallback((saved) => {
        setNotes(prev => prev?.map(note => note.id === saved.id ? saved : note) ?? prev);
    }, []);

    const create = useCallback(async (data) => {
        const note = await createOrToast(data);
        if (note) setNotes(prev => [note, ...(prev ?? [])]);
        return note;
    }, [createOrToast]);

    const failed = useCallback(() => dispatch(showToast(t('noteSaveFailed'), 'error')), [dispatch, t]);

    // into the trash: the saved note, or null (toasted)
    const trash = useCallback(async (id) => {
        try {
            const saved = await updateNote(id, { trashed: true });
            setNotes(prev => prev?.filter(note => note.id !== id) ?? prev);
            return saved;
        } catch { failed(); return null; }
    }, [failed]);

    // back out of the trash: the saved note, or null (toasted)
    const restore = useCallback(async (id) => {
        try {
            const saved = await updateNote(id, { trashed: false });
            setNotes(prev => [saved, ...(prev ?? []).filter(note => note.id !== id)]);
            return saved;
        } catch { failed(); return null; }
    }, [failed]);

    // for good: true once gone; a failure keeps the note and is toasted
    const remove = useCallback(async (id) => {
        try { await removeNote(id); } catch { failed(); return false; }
        setNotes(prev => prev?.filter(note => note.id !== id) ?? prev);
        return true;
    }, [failed]);

    return { notes, setNotes, merge, create, trash, restore, remove, refetch, onScanDone };
}

// The note folders (a failed load is no folders).
export function useNoteFolders() {
    const [folders, setFolders] = useState([]);
    useEffect(() => { fetchFolders().then(setFolders).catch(() => {}); }, []);
    return [folders, setFolders];
}

// "3. Mär" (the day a note was changed)
export function useShortDate() {
    const { language } = useTranslation();
    return useMemo(() => new Intl.DateTimeFormat(localeOf(language), { day: 'numeric', month: 'short' }), [language]);
}
