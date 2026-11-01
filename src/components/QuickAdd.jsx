import styles from './QuickAdd.module.css';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { showForms } from '../features/settings/settingsAction';
import { useSheet } from '../features/layout/dragDismiss';
import TaskForm from './TaskForm.jsx';

// The new-task form over whatever page is open: the header's "New" and Home's "Create task"
// both open it (settings.showForms).
export default function QuickAdd() {
    const dispatch = useDispatch();
    const open = useSelector(state => state.settings.showForms);
    if (!open) return null;
    return (
        <FormSheet onClose={() => dispatch(showForms(false))}>
            {(sheet, close) => <TaskForm sheet={sheet} setCreateTask={(value) => { if (!value) close(); }} />}
        </FormSheet>
    );
}

// A form card that slides in over the page (a sheet on phones, swiped down to put it away);
// Escape, its cross, saving or a click next to it take it back the way it came.
// children(sheet, close): the card spreads sheet.panel on itself (TaskForm, GroupForm).
export function FormSheet({ onClose, children }) {
    const sheet = useSheet(onClose);
    const { dismiss } = sheet;

    useEffect(() => {
        const previous = document.activeElement;
        const onKey = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) dismiss(); };
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            previous?.focus?.();
        };
    }, [dismiss]);

    return (
        <div className={styles.backdrop} {...sheet.backdrop} onPointerDown={(e) => { if (e.target === e.currentTarget) dismiss(); }}>
            {children(sheet, dismiss)}
        </div>
    );
}
