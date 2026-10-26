import { displayName, fill } from '../helperFunction';

// When an entry was made and by whom, whichever list it comes from: own tasks carry created_at
// and owner (null: mine, else the friend who shared it with me), a session's or a family's
// entries createdAt and addedBy (null: an account that is gone).
// "Erstellt am 26. Okt. 2026 um 14:03 von Anna" / "… von dir"; '' when the time isn't known.
export function createdText(task, t, language, myUsername) {
    const value = task.created_at ?? task.createdAt;
    const at = value ? new Date(value) : null;
    if (!at || Number.isNaN(at.getTime())) return '';
    const locale = language === 'de' ? 'de-DE' : 'en-GB';
    const when = fill(t('createdOn'), {
        date: at.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }),
        time: at.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
    });
    const by = 'addedBy' in task ? task.addedBy : (task.owner ?? 'me');
    if (by === 'me' || (by && myUsername && by.username === myUsername)) return `${when} ${t('createdByMe')}`;
    if (!by) return when;
    return `${when} ${fill(t('addedByName'), { name: displayName(by) })}`;
}
