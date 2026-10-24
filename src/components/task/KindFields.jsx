import styles from './KindFields.module.css';
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { addEventType } from '../../features/tasks/taskAction';
import { EVENT_TYPE_SUGGESTIONS, eventTypeErrorText } from '../../features/tasks/kinds';
import { showToast } from '../../features/toast/toast';

// Task or event, as two buttons side by side (a radio group). value: 'task' | 'event'.
export function KindSwitch({ value, onChange }) {
    const { t } = useTranslation();
    const name = useId();
    return (
        <fieldset className={styles.kind}>
            <legend className={styles.srOnly}>{t('kindLegend')}</legend>
            {['task', 'event'].map(kind => (
                <label key={kind} className={value === kind ? styles.kindOn : styles.kindOption}>
                    <input type="radio" name={name} value={kind} checked={value === kind} onChange={() => onChange(kind)} />
                    <span className={styles.kindName}>{t(`kind_${kind}`)}</span>
                    <small className={styles.kindHint}>{t(`kind_${kind}_hint`)}</small>
                </label>
            ))}
        </fieldset>
    );
}

// What kind of event it is: my types as chips (radio buttons), "none" first; "+ New type"
// adds one right here and picks it. While I have none, a few suggestions are offered.
// value: a type id or null; onChange(id | null). autoNote: why it was picked by itself (a keyword
// of the name), shown under the chips; picking another one or "none" takes it away.
export function EventTypePicker({ value, onChange, autoNote = null }) {
    const { t, language } = useTranslation();
    const dispatch = useDispatch();
    const name = useId();
    const types = useSelector(state => state.task.eventTypes) ?? [];
    const [adding, setAdding] = useState(false);
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);

    const create = async (typeName, color = null) => {
        const clean = typeName.trim();
        if (!clean || busy) return;
        const known = types.find(type => type.name.toLowerCase() === clean.toLowerCase());
        if (known) {
            onChange(known.id);
            setAdding(false);
            setDraft('');
            return;
        }
        setBusy(true);
        try {
            const type = await dispatch(addEventType(clean, color));
            onChange(type.id);
            setAdding(false);
            setDraft('');
        } catch (err) {
            dispatch(showToast(eventTypeErrorText(t, err), 'error'));
        } finally {
            setBusy(false);
        }
    };

    const suggestions = types.length === 0 ? EVENT_TYPE_SUGGESTIONS[language] ?? EVENT_TYPE_SUGGESTIONS.de : [];

    return (
        <fieldset className={styles.types}>
            <legend className={styles.typesLegend}>{t('eventType')}</legend>
            <div className={styles.chips}>
                {[null, ...types].map(type => (
                    <label key={type?.id ?? 'none'} className={value === (type?.id ?? null) ? styles.chipOn : styles.chip}
                        data-task-color={type?.color ?? undefined}>
                        <input type="radio" name={name} checked={value === (type?.id ?? null)} onChange={() => onChange(type?.id ?? null)} />
                        {type && <span className={styles.dot} aria-hidden="true" />}
                        {type ? type.name : t('eventTypeNone')}
                    </label>
                ))}
                {suggestions.map(suggestion => (
                    <button key={suggestion.name} type="button" className={styles.suggestion} data-task-color={suggestion.color}
                        disabled={busy} onClick={() => create(suggestion.name, suggestion.color)}
                        title={t('eventTypeSuggestionHint')}>
                        + {suggestion.name}
                    </button>
                ))}
                {adding
                    ? <span className={styles.addRow}>
                        <input className={styles.addInput} autoFocus value={draft} maxLength={40} placeholder={t('eventTypeNewPlaceholder')}
                            aria-label={t('eventTypeNew')} onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                                // Enter adds the type, not the whole form
                                if (e.key === 'Enter') { e.preventDefault(); create(draft); }
                                if (e.key === 'Escape') { e.stopPropagation(); setAdding(false); setDraft(''); }
                            }} />
                        <button type="button" className={styles.addBtn} disabled={!draft.trim() || busy} onClick={() => create(draft)}>{t('add')}</button>
                    </span>
                    : <button type="button" className={styles.newBtn} onClick={() => setAdding(true)}>+ {t('eventTypeNew')}</button>}
            </div>
            {autoNote && <p className={styles.autoNote}>{autoNote}</p>}
            {types.length > 0 && <Link to="/settings#event-types" className={styles.manage}>{t('eventTypesManage')}</Link>}
        </fieldset>
    );
}
