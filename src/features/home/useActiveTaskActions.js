import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { createNote, refreshTaskNotes, updateTaskProps } from '../tasks/taskAction';
import { setSharedTaskDone, togetherErrorText } from '../together/togetherAction';
import { showToast } from '../toast/toast';
import { burstFrom, useMotionLevel } from '../settings/motion';
import { playSound } from '../settings/sound';

// What the task in focus can do, for both layouts of it (Home's FocusSheet and the focus column,
// WorkingContainer): tick it off, save its description, add a note (the input opens for one task
// only and takes the focus), and the notes written in the notebook since the list was loaded.
// echo: on "extreme" a second, smaller burst follows 180 ms after the first (the focus column's).
export function useActiveTaskActions(activeTask, setActiveTask, { echo = false } = {}) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const motionLevel = useMotionLevel();

    useEffect(() => { dispatch(refreshTaskNotes()).catch(() => {}); }, [dispatch]);

    const [addingFor, setAddingFor] = useState(null);
    const addingNote = addingFor !== null && addingFor === activeTask?.id;
    const setAddingNote = (value) => setAddingFor(value ? activeTask.id : null);
    const noteInputRef = useRef(null);
    useEffect(() => { if (addingNote) noteInputRef.current?.focus(); }, [addingNote]);

    // finishing the task in focus is worth a burst on "normal", a big one on "extreme"
    const markDone = (e) => {
        playSound('done');
        const target = e?.currentTarget;
        if (motionLevel !== 'minimal' && target) {
            burstFrom(target, motionLevel === 'extreme' ? 60 : 30);
            if (echo && motionLevel === 'extreme') setTimeout(() => burstFrom(target, 40), 180);
        }
        if (activeTask.shared) {
            dispatch(setSharedTaskDone(activeTask.shared.sessionId, activeTask.shared.taskId, true))
                .catch(err => dispatch(showToast(togetherErrorText(t, err), 'error')));
        } else {
            dispatch(updateTaskProps({ done: true }, activeTask));
        }
        setActiveTask(null);
    };

    // Saves on blur only, and only when the text really changed, so clicking in and out never
    // sends a request or overwrites the description
    const saveDescription = (e) => {
        const description = e.target.value.trim();
        if (description === (activeTask.description ?? '')) return;
        setActiveTask(prev => ({ ...prev, description }));
        dispatch(updateTaskProps({ description }, activeTask));
    };

    const addNote = (e) => {
        const text = e.target.value.trim();
        setAddingNote(false);
        if (text) dispatch(createNote(activeTask.id, text));
    };

    return { markDone, saveDescription, addNote, addingNote, setAddingNote, noteInputRef };
}
