import styles from './DeleteScopeDialog.module.css';
import { useId, useRef } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { localeOf } from '../../i18n/locale';
import { answerDeleteScope, useDeleteScopeQuestion } from '../../features/tasks/deleteScope';
import { isEvent } from '../../features/tasks/kinds';
import { parseDate } from '../../features/helperFunction';
import { dateKey } from '../../features/calendar/calendar';
import Icon from '../icons';
import Dialog from '../Dialog.jsx';

const SCOPES = ['one', 'following', 'all'];

// "What should be deleted?" for a repeating task: three choices, each saying what it does, and
// cancel. Mounted once in the app shell; askDeleteScope(task) opens it (features/tasks/deleteScope).
// The first choice has the focus, so Enter deletes only this one; Escape or a click next to it cancels.
export default function DeleteScopeDialog() {
    const question = useDeleteScopeQuestion();
    if (!question) return null;
    // a new question gets a fresh dialog (and focus)
    return <ScopeQuestion key={question.task.id} task={question.task} />;
}

function ScopeQuestion({ task }) {
    const { t, language } = useTranslation();
    const titleId = useId();
    const firstRef = useRef(null);
    const event = isEvent(task);
    const day = parseDate(dateKey(task.due));
    const dayText = day ? day.toLocaleDateString(localeOf(language), { weekday: 'short', day: 'numeric', month: 'short' }) : '';

    // on phones a sheet: pulled down, nothing is deleted
    return (
        <Dialog onClose={() => answerDeleteScope(null)} role="alertdialog" labelledBy={titleId} initialFocus={firstRef} drag
            backdropClassName={styles.backdrop} className={styles.dialog}>
            {(dismiss) => (<>
                <span className={styles.badge} aria-hidden="true"><Icon name="repeat" size={20} /></span>
                <h2 id={titleId} className={styles.title}>{t(event ? 'deleteScopeTitleEvent' : 'deleteScopeTitle')}</h2>
                <p className={styles.name}>{task.name}</p>
                <div className={styles.choices}>
                    {SCOPES.map((scope, i) => (
                        <button key={scope} ref={i === 0 ? firstRef : undefined} type="button"
                            className={`${styles.choice} ${scope === 'all' ? styles.choiceAll : ''}`}
                            onClick={() => answerDeleteScope(scope)}>
                            <span className={styles.choiceLabel}>{t(`deleteScope_${scope}`)}</span>
                            <span className={styles.choiceHint}>
                                {scope === 'one' && dayText ? `${dayText} · ` : ''}{t(`deleteScope_${scope}_hint`)}
                            </span>
                        </button>
                    ))}
                </div>
                <button type="button" className={styles.cancel} onClick={() => dismiss()}>{t('cancel')}</button>
            </>)}
        </Dialog>
    );
}
