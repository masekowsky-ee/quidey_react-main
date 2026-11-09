import styles from './Reminders.module.css';
import ui from '../ui.module.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { useIsTester } from '../../features/auth/tester';
import { selectReminders, dueOccurrence, reminderDone, snoozeReminder } from '../../features/reminders/reminders';
import { ringsNatively } from '../../features/native/alarms';
import { playSound } from '../../features/settings/sound';
import Icon from '../icons';

const CHECK_MS = 15 * 1000;
const SEEN_KEY = 'reminderSeen';
const SEEN_MAX = 50;

// the times already shown here ("<id>@<ms>"), so a reload doesn't bring one back
function readSeen() {
    try {
        const list = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]');
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
}
function markSeen(key) {
    try {
        localStorage.setItem(SEEN_KEY, JSON.stringify([...readSeen().filter(k => k !== key), key].slice(-SEEN_MAX)));
    } catch { /* only for this visit */ }
}

const hhmm = (date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

// While the app is open and a reminder's time comes: it covers the whole page (testers). Not in
// the Android app when it rings them itself (the native alarm screen does that, also locked).
// "Erledigt" ends it, "10 Min. später" (or Escape) rings again then.
export default function ReminderAlert() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const isTester = useIsTester();
    const list = useSelector(selectReminders);
    const [ringing, setRinging] = useState(null); // { reminder, at, key }
    const [busy, setBusy] = useState(false);
    const doneRef = useRef(null);

    const check = useCallback(() => {
        if (!isTester || ringsNatively() || document.visibilityState === 'hidden') return;
        const now = new Date();
        const seen = readSeen();
        for (const reminder of list) {
            const at = dueOccurrence(reminder, now);
            if (!at) continue;
            const key = `${reminder.id}@${at.getTime()}`;
            if (seen.includes(key)) continue;
            setRinging(current => current?.key === key ? current : { reminder, at, key });
            return;
        }
    }, [isTester, list]);

    useEffect(() => {
        // the first look right after this render (the list may just have come)
        const first = setTimeout(check, 0);
        const id = setInterval(check, CHECK_MS);
        window.addEventListener('focus', check);
        document.addEventListener('visibilitychange', check);
        return () => {
            clearTimeout(first);
            clearInterval(id);
            window.removeEventListener('focus', check);
            document.removeEventListener('visibilitychange', check);
        };
    }, [check]);

    const key = ringing?.key;
    useEffect(() => {
        if (!key) return;
        playSound('reminder');
        doneRef.current?.focus();
    }, [key]);

    const answer = useCallback(async (action) => {
        if (!ringing) return;
        setBusy(true);
        markSeen(ringing.key);
        try {
            await dispatch(action === 'done' ? reminderDone(ringing.reminder.id) : snoozeReminder(ringing.reminder.id));
        } catch { /* the push / the list shows it again */ }
        setBusy(false);
        setRinging(null);
    }, [ringing, dispatch]);

    useEffect(() => {
        if (!ringing) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); answer('snooze'); } };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [ringing, answer]);

    if (!ringing) return null;
    return createPortal(
        <div className={styles.alert} role="alertdialog" aria-modal="true" aria-labelledby="reminder-alert-text" aria-describedby="reminder-alert-time">
            <div className={styles.alertBody}>
                <span className={styles.alertIcon} aria-hidden="true"><Icon name="alarm" size={40} /></span>
                <p className={styles.alertLabel}>{t('reminderAlertLabel')}</p>
                <p id="reminder-alert-time" className={styles.alertTime}>{hhmm(ringing.at)}</p>
                <h2 id="reminder-alert-text" className={styles.alertText}>{ringing.reminder.text}</h2>
                <div className={styles.alertActions}>
                    <button ref={doneRef} type="button" className={ui.btnYes} disabled={busy} onClick={() => answer('done')}>
                        <Icon name="check" size={20} /> {t('reminderDone')}
                    </button>
                    <button type="button" className={ui.btnNo} disabled={busy} onClick={() => answer('snooze')}>
                        {t('reminderSnooze')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
