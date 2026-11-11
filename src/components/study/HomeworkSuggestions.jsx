import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { dismissHomeworkSuggestion, fetchHomeworkSuggestions, takeHomeworkSuggestion } from '../../features/untis/untis';
import { refreshTasks } from '../../features/tasks/taskAction';
import { showToast } from '../../features/toast/toast';
import { useTranslation } from '../../i18n/useTranslation';
import { countdownText } from './studyUi';
import styles from './Study.module.css';

// Homework from Untis offered as tasks (backend untis.js: GET /api/untis/suggestions): each with its
// day, the text, a working time (the AI's estimate when the account has AI access, else empty) and
// "Als Aufgabe übernehmen" / "Verwerfen". `subjectId`: only that subject's. Renders nothing without any.
export default function HomeworkSuggestions({ subjectId = null }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [items, setItems] = useState([]);
    // typed minutes per suggestion (a string while typing); untouched ones use the estimate
    const [minutes, setMinutes] = useState({});
    const [busy, setBusy] = useState(null);

    useEffect(() => {
        let live = true;
        Promise.resolve().then(fetchHomeworkSuggestions).then((list) => { if (live) setItems(Array.isArray(list) ? list : []); }).catch(() => {});
        return () => { live = false; };
    }, []);

    const shown = subjectId == null ? items : items.filter(item => item.subjectId === subjectId);
    if (shown.length === 0) return null;

    const valueOf = (item) => (minutes[item.id] ?? (item.estimateMinutes == null ? '' : String(item.estimateMinutes)));
    const remove = (id) => setItems(list => list.filter(item => item.id !== id));

    const take = async (item) => {
        const typed = valueOf(item);
        setBusy(item.id);
        try {
            await takeHomeworkSuggestion(item.id, typed === '' ? null : Number(typed));
            remove(item.id);
            dispatch(refreshTasks()).catch(() => {});
        } catch {
            dispatch(showToast(t('studyError_default'), 'error'));
        } finally {
            setBusy(null);
        }
    };

    const dismiss = async (item) => {
        setBusy(item.id);
        try {
            await dismissHomeworkSuggestion(item.id);
            remove(item.id);
        } catch {
            dispatch(showToast(t('studyError_default'), 'error'));
        } finally {
            setBusy(null);
        }
    };

    return (
        <section className={styles.suggestions} aria-label={t('hwTitle')} data-tip="homework-suggestions">
            <h2 className={styles.sectionTitle}>{t('hwTitle')}</h2>
            <ul className={styles.list}>
                {shown.map(item => (
                    <li key={item.id} className={styles.suggestion}>
                        <div className={styles.suggestionText}>
                            <span className={styles.itemName}>{item.subjectName}</span>
                            <span>{item.text}</span>
                            {item.remark && <span className={styles.meta}>{item.remark}</span>}
                            <span className={styles.meta}>{countdownText(item.due, t)}</span>
                        </div>
                        <div className={styles.suggestionActions}>
                            <label className={styles.field}>
                                <input type="number" inputMode="numeric" className={styles.number} min="5" max="600" step="5"
                                    value={valueOf(item)} aria-label={t('hwMinutes')}
                                    onChange={(e) => setMinutes(prev => ({ ...prev, [item.id]: e.target.value }))} />
                                <span className={styles.unit}>{t('studyMinutes')}</span>
                            </label>
                            {item.estimateSource === 'ai' && minutes[item.id] === undefined && <span className={styles.badgeQuiet}>{t('hwAiEstimate')}</span>}
                            <button type="button" className={styles.btnPrimary} disabled={busy === item.id} onClick={() => take(item)}>{t('hwTake')}</button>
                            <button type="button" className={styles.btn} disabled={busy === item.id} onClick={() => dismiss(item)}>{t('hwDismiss')}</button>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}
