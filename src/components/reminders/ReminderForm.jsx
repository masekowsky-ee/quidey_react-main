import styles from '../Form.module.css';
import own from './Reminders.module.css';
import ui from '../ui.module.css';
import { useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { useFocusOnArrival } from '../../features/layout/dragDismiss';
import { saveReminder, nextOccurrence, REMINDER_TEXT_MAX, weekdaysText } from '../../features/reminders/reminders';
import { parseQuickEntry, stripFound } from '../../features/tasks/quickParse';
import { dateKey } from '../../features/calendar/calendar';
import { dueText, fill } from '../../features/helperFunction';
import { showToast } from '../../features/toast/toast';
import { KindSwitch } from '../task/KindFields.jsx';
import SheetGrabber from '../SheetGrabber.jsx';
import { useWhenText } from './whenText';

const DAYS = [1, 2, 3, 4, 5, 6, 7];

// the next full hour (a new reminder's time until one is picked)
function nextHour(now = new Date()) {
    const at = new Date(now);
    at.setHours(at.getHours() + 1, 0, 0, 0);
    return at;
}
const hhmm = (date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

function initialFields(reminder, text) {
    if (reminder?.days) return { text: reminder.text, mode: 'weekly', date: dateKey(new Date()), time: reminder.atTime, days: reminder.days };
    if (reminder?.at) {
        const at = new Date(reminder.snoozedUntil ?? reminder.at);
        return { text: reminder.text, mode: 'once', date: dateKey(at), time: hhmm(at), days: [] };
    }
    return { text, mode: 'once', date: '', time: '', days: [] };
}

// A new reminder (in QuickAdd's sheet) or one to change (reminder). A day or time written into the
// text ("Mama anrufen morgen 18 Uhr") fills the empty fields, as in the new-task form.
// onKind(kind, text): back to the task form (QuickAdd); onDone(): saved or closed.
export default function ReminderForm({ reminder = null, initialText = '', sheet, onKind, onDone }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const when = useWhenText();
    const textRef = useRef(null);
    useFocusOnArrival(textRef);
    const [fields, setFields] = useState(() => initialFields(reminder, initialText));
    const set = (changes) => setFields(prev => ({ ...prev, ...changes }));
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    const parsed = useMemo(() => parseQuickEntry(fields.text), [fields.text]);
    const quick = {
        ...(fields.mode === 'once' && !fields.date && parsed.due && { due: parsed.due }),
        ...(!fields.time && parsed.time && { time: parsed.time }),
    };
    const quickKinds = Object.keys(quick);
    const text = (quickKinds.length > 0 ? stripFound(fields.text, parsed.found, quickKinds) : fields.text).trim();
    const time = quick.time ?? fields.time;
    const date = quick.due ?? fields.date;

    const toggleDay = (day) => set({ days: fields.days.includes(day) ? fields.days.filter(d => d !== day) : [...fields.days, day].sort() });

    const submit = async (e) => {
        e.preventDefault();
        if (!text) { setError(t('reminderErrorText')); return; }
        let draft;
        if (fields.mode === 'weekly') {
            if (fields.days.length === 0) { setError(t('reminderErrorDays')); return; }
            draft = { id: reminder?.id, text, days: fields.days, atTime: time || hhmm(nextHour()) };
        } else {
            // a time without a day is today; nothing at all is the next full hour
            const at = date || time
                ? new Date(`${date || dateKey(new Date())}T${time || '09:00'}`)
                : nextHour();
            if (at.getTime() < Date.now() - 30 * 1000) { setError(t('reminderErrorPast')); return; }
            draft = { id: reminder?.id, text, at };
        }
        setBusy(true);
        setError(null);
        try {
            const saved = await dispatch(saveReminder(draft));
            const next = nextOccurrence(saved);
            dispatch(showToast(fill(t('reminderSaved'), { when: next ? when(next) : weekdaysText(saved, t) }), 'success'));
            onDone?.();
        } catch (err) {
            setError(err.field === 'at' ? t('reminderErrorPast') : err.message || t('friendError_generic'));
            setBusy(false);
        }
    };

    const titleId = reminder ? 'editReminderTitle' : 'createReminderTitle';
    return (
        <div className={styles.div} role="dialog" aria-modal="true" aria-labelledby={titleId} {...sheet?.panel}>
            {sheet && <SheetGrabber />}
            <button type="button" className={styles.closeBtn} onClick={() => onDone?.()} aria-label={t('close')}>
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>
            </button>
            <h2 id={titleId} data-sheet-drag>{t(reminder ? 'reminderEditTitle' : 'reminderNew')}</h2>
            <form className={styles.form} onSubmit={submit} noValidate>
                {onKind && <KindSwitch value="reminder" kinds={['task', 'event', 'reminder', 'note']}
                    onChange={(kind) => { if (kind !== 'reminder') onKind(kind, fields.text); }} />}
                <input ref={textRef} className={styles.input} type="text" value={fields.text} maxLength={REMINDER_TEXT_MAX}
                    placeholder={t('reminderTextPlaceholder')} aria-label={t('reminderText')}
                    aria-describedby={quickKinds.length > 0 ? 'reminder-quick-hint' : undefined}
                    onChange={(e) => { set({ text: e.target.value }); setError(null); }} />
                {quickKinds.length > 0 &&
                    <p id="reminder-quick-hint" className={styles.quickHint} aria-live="polite">
                        {[quick.due && dueText(quick.due, t), quick.time && fill(t('quickAddAt'), { time: quick.time })].filter(Boolean).join(' · ')}
                    </p>}

                <div className={ui.segmented} role="radiogroup" aria-label={t('reminderTime')}>
                    {['once', 'weekly'].map(mode => (
                        <button key={mode} type="button" role="radio" aria-checked={fields.mode === mode}
                            className={fields.mode === mode ? ui.segmentActive : undefined}
                            onClick={() => { set({ mode }); setError(null); }}>
                            {t(mode === 'once' ? 'reminderOnce' : 'reminderWeekly')}
                        </button>
                    ))}
                </div>

                {fields.mode === 'weekly' &&
                    <div className={own.days} role="group" aria-label={t('reminderDays')}>
                        {DAYS.map(day =>
                            <button key={day} type="button" aria-pressed={fields.days.includes(day)} onClick={() => { toggleDay(day); setError(null); }}>
                                {t('weekDays', day - 1)}
                            </button>)}
                    </div>}

                <div className={styles.rowDiv}>
                    {fields.mode === 'once' &&
                        <input className={`${styles.input} ${styles.grow}`} type="date" aria-label={t('reminderDate')} title={t('reminderDate')}
                            value={date} min={dateKey(new Date())} onChange={(e) => { set({ date: e.target.value }); setError(null); }} />}
                    <input className={`${styles.input} ${fields.mode === 'weekly' ? styles.grow : ''}`} type="time" aria-label={t('reminderTime')} title={t('reminderTime')}
                        value={time} onChange={(e) => { set({ time: e.target.value }); setError(null); }} />
                </div>

                {error && <p className={own.error} role="alert">{error}</p>}
                <button type="submit" className={styles.createBtn} disabled={busy}>{t('reminderSave')}</button>
            </form>
        </div>
    );
}
