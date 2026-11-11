import styles from './QuickAdd.module.css';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { showForms } from '../features/settings/settingsAction';
import { useSheet } from '../features/layout/dragDismiss';
import TaskForm from './TaskForm.jsx';
import ReminderForm from './reminders/ReminderForm.jsx';
import ScanSheet from './scan/ScanSheet.jsx';
import NoteQuickForm from './notes/NoteQuickForm.jsx';

// The new-task form over whatever page is open: the header's "New" and Home's "Create task"
// both open it (settings.showForms). Testers can switch it to a reminder ("Erinnerung" in the
// kind switch; showForms('reminder') opens it so, e.g. the command bar's "Neue Erinnerung").
export default function QuickAdd() {
    const dispatch = useDispatch();
    const open = useSelector(state => state.settings.showForms);
    if (!open) return null;
    // "Material scannen" in the form: the scan sheet in its place
    if (open === 'scan') return <ScanSheet onClose={() => dispatch(showForms(false))} />;
    return (
        <FormSheet onClose={() => dispatch(showForms(false))}>
            {(sheet, close) => <QuickAddForm sheet={sheet} close={close} reminder={open === 'reminder'} />}
        </FormSheet>
    );
}

function QuickAddForm({ sheet, close, reminder }) {
    const dispatch = useDispatch();
    // what was typed goes along when switching between the two forms
    const [form, setForm] = useState(() => ({ kind: reminder ? 'reminder' : 'task', text: '' }));
    // the sheet is already up when the kind is switched: the new form takes its place without
    // sliding in from the bottom edge again (data-swapped, index.css)
    const swap = (kind, text) => setForm({ kind, text, swapped: true });
    const here = form.swapped ? { ...sheet, panel: { ...sheet.panel, 'data-swapped': '' } } : sheet;
    if (form.kind === 'note') {
        return <NoteQuickForm sheet={here} initialTitle={form.text} onDone={close} onKind={swap} />;
    }
    if (form.kind === 'reminder') {
        return <ReminderForm sheet={here} initialText={form.text} onDone={close} onKind={swap} />;
    }
    return <TaskForm key={form.kind} sheet={here} initialKind={form.kind} initialName={form.text}
        onReminder={(text) => swap('reminder', text)}
        onNote={(text) => swap('note', text)}
        onScan={() => dispatch(showForms('scan'))}
        setCreateTask={(value) => { if (!value) close(); }} />;
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
