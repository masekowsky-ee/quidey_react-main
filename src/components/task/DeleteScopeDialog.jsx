import styles from './DeleteScopeDialog.module.css';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { answerDeleteScope, useDeleteScopeQuestion } from '../../features/tasks/deleteScope';
import { isEvent } from '../../features/tasks/kinds';
import { parseDate } from '../../features/helperFunction';
import { dateKey } from '../../features/calendar/calendar';
import Icon from '../icons';

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
    const dayText = day ? day.toLocaleDateString(language === 'en' ? 'en-GB' : 'de-DE', { weekday: 'short', day: 'numeric', month: 'short' }) : '';

    useEffect(() => {
        const previous = document.activeElement;
        firstRef.current?.focus();
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            // only this dialog closes, not the editor behind it
            e.preventDefault();
            e.stopPropagation();
            answerDeleteScope(null);
        };
        window.addEventListener('keydown', onKey, true);
        return () => {
            window.removeEventListener('keydown', onKey, true);
            previous?.focus?.();
        };
    }, []);

    return createPortal(
        <div className={styles.backdrop} onPointerDown={(e) => { if (e.target === e.currentTarget) answerDeleteScope(null); }}>
            <div className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby={titleId}>
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
                <button type="button" className={styles.cancel} onClick={() => answerDeleteScope(null)}>{t('cancel')}</button>
            </div>
        </div>,
        document.body
    );
}
