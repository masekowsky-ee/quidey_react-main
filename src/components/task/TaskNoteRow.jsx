import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import Icon from '../icons.jsx';
import { useTranslation } from '../../i18n/useTranslation';
import { deleteNote, editNote } from '../../features/tasks/taskAction';
import styles from './TaskNoteRow.module.css';

// One note on a task's card (Home's focus sheet, the focus column). Task notes are notebook notes
// about the task: a one-line note is edited right here; one with more lines (a title, a checklist,
// pictures) only shows its first line and opens in the notebook, since a one-line field would
// flatten it. Only a real change is saved; emptied, the note goes.
// className is the list item's: the page styles the input and the delete button from there.
export default function TaskNoteRow({ taskId, note, className }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const content = note.content ?? '';
    const firstLine = content.split('\n').find(line => line.trim()) ?? '';
    const inline = content.trim() !== '' && !content.includes('\n');

    const save = (e) => {
        const value = e.target.value.trim();
        if (value === content.trim()) return;
        dispatch(value ? editNote(taskId, note.id, value) : deleteNote(taskId, note.id));
    };

    return (
        <li className={`${styles.row} ${className ?? ''}`}>
            {inline
                ? <input type="text" defaultValue={content} aria-label={t('taskNotes')}
                    onBlur={save} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
                : <Link to="/focus" className={styles.open} title={t('notebook')}>
                    <span className={styles.text}>{firstLine || t('noteUntitled')}</span>
                    <Icon name="note" size={14} />
                </Link>}
            {/* a fuller note is deleted in the notebook (with its trash), not with one tap here */}
            {inline &&
                <button type="button" onClick={() => dispatch(deleteNote(taskId, note.id))}
                    title={t('deleteNote')} aria-label={`${t('deleteNote')}: ${firstLine}`}>
                    <Icon name="trash" size={16} />
                </button>}
        </li>
    );
}
