import styles from './QuickAdd.module.css';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { showForms } from '../features/settings/settingsAction';
import TaskForm from './TaskForm.jsx';

// The new-task form over whatever page is open: the header's "New" and Home's "Create task"
// both open it (settings.showForms). Escape or a click next to it closes it.
export default function QuickAdd() {
    const dispatch = useDispatch();
    const open = useSelector(state => state.settings.showForms);
    const close = (value) => { if (!value) dispatch(showForms(false)); };

    useEffect(() => {
        if (!open) return undefined;
        const previous = document.activeElement;
        const onKey = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) dispatch(showForms(false)); };
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            previous?.focus?.();
        };
    }, [open, dispatch]);

    if (!open) return null;
    return (
        <div className={styles.backdrop} onPointerDown={(e) => { if (e.target === e.currentTarget) close(false); }}>
            <TaskForm setCreateTask={close} />
        </div>
    );
}
