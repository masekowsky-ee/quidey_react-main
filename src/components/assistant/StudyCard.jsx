// The assistant's cards for the study area (Lernen): a new subject / goal / topic (made at once, with
// Undo), a change or a delete (waits for "Bestätigen"; deleting a goal that has planned sessions asks
// whether they stay), and the re-plan (one button that opens the plan preview). What a card says comes
// from the app's own copy (`card.study`, see features/assistant/studyActions.js), never from the model.

import { useId } from 'react';
import { applyAction } from '../../features/assistant/applyAction';
import { fill } from '../../features/helperFunction';
import { useTranslation } from '../../i18n/useTranslation';
import Icon from '../icons.jsx';
import { useDay } from './useDay';
import styles from './AssistantSheet.module.css';

const DATES = ['due', 'studyFrom', 'studyTo'];
const MINUTES = ['estimateMinutes', 'sessionMinutes', 'dailyMaxMinutes'];

function useShown() {
    const { t } = useTranslation();
    const dayText = useDay();
    return (field, value) => {
        const none = t('assistantStudyNone');
        if (value === null || value === undefined || value === '') return none;
        if (typeof value === 'boolean') return t(value ? 'assistantStudyYes' : 'assistantStudyNo');
        if (DATES.includes(field)) return dayText(value);
        if (field === 'dueTime') return String(value).slice(0, 5);
        if (field === 'kind') return t(`studyKind_${value}`);
        if (field === 'status') return t(`assistantStudyStatus_${value}`);
        if (field === 'gradeScale') return t(`studyScale_${value}`);
        if (MINUTES.includes(field)) return fill(t('assistantStudyMinutes'), { n: value });
        if (field === 'windows') {
            if (!Array.isArray(value) || value.length === 0) return t('assistantStudyNoWindows');
            return value.map(w => `${t('weekDays', Number(w.weekday) - 1)} ${w.start}–${w.end}`).join(', ');
        }
        return String(value);
    };
}

export default function StudyCard({ card, deps, onChange, onCreate, onLeave }) {
    const { t } = useTranslation();
    const shown = useShown();
    const id = useId();
    const kindId = `${id}-kind`;
    const { type, action, study, status } = card;
    const { kind, title, rows, sessions = 0 } = study;
    const target = action.target;

    const kindLabel = kind === 'replan' ? t('assistantStudyReplan') : t(`assistantStudy${{ create: 'New', update: 'Change', delete: 'Delete' }[kind]}_${target}`);

    // update / delete: after the confirm; a failure stays on the card and the button tries again
    async function confirm(mode) {
        onChange({ status: 'busy', error: null });
        try {
            await applyAction(action, { ...deps, sessions: mode });
            onChange({ status: 'done' });
        } catch (err) {
            onChange({ status: 'failed', error: err.code === 'NOT_FOUND' ? t('assistantGone') : err.message });
        }
    }

    async function openPlan() {
        onChange({ status: 'busy', error: null });
        try {
            await applyAction(action, deps);
            onChange({ status: 'pending' });
            onLeave();
        } catch (err) {
            onChange({ status: 'failed', error: err.message });
        }
    }

    function retryCreate() {
        onChange({ status: 'busy', error: null });
        onCreate(card);
    }

    const statusLine = status === 'done' ? t(`assistantStudyDone_${kind}`)
        : status === 'cancelled' ? t('assistantCancelled')
            : status === 'undone' ? t('assistantStudyUndone')
                : status === 'failed' ? fill(t('assistantActionFailed'), { error: card.error || t('assistantFailed') })
                    : null;

    const asks = type === 'study_delete' && target === 'goal' && sessions > 0;
    const goneText = type === 'study_delete' && target === 'subject' && sessions > 0
        ? (sessions === 1 ? t('assistantStudyGone_one') : fill(t('assistantStudyGone'), { n: sessions }))
        : null;
    const askText = asks ? (sessions === 1 ? t('assistantStudyAsk_one') : fill(t('assistantStudyAsk'), { n: sessions })) : null;
    const waiting = status === 'pending' || status === 'busy' || status === 'failed';
    const busy = status === 'busy';

    return (
        <div role="group" aria-labelledby={title ? `${kindId} ${id}` : kindId} className={styles.card} data-status={status} data-kind={type}>
            <p id={kindId} className={styles.cardKind}>{kindLabel}</p>
            {title && <p id={id} className={styles.cardTitle}>{title}</p>}
            {kind === 'replan' && <p className={styles.cardMeta}>{t('assistantStudyReplanText')}</p>}
            {(askText || goneText) && <p className={styles.cardMeta}>{askText ?? goneText}</p>}
            {rows.length > 0 && (
                <dl className={styles.changes}>
                    {rows.map(row => (
                        <div key={row.field} className={styles.change}>
                            <dt>{t(`assistantStudyField_${row.field}`)}</dt>
                            <dd>
                                {kind !== 'create' && (
                                    <>
                                        <span className={styles.from}>{shown(row.field, row.from)}</span>
                                        <Icon name="arrowRight" size={14} className={styles.arrow} />
                                        <span className={styles.srOnly}> {t('assistantTo')} </span>
                                    </>
                                )}
                                <span className={styles.to}>{shown(row.field, row.to)}</span>
                            </dd>
                        </div>
                    ))}
                </dl>
            )}
            {statusLine && <p className={styles.cardStatus} data-status={status} role={status === 'failed' ? 'alert' : undefined}>{statusLine}</p>}
            {card.undoError && <p className={styles.cardStatus} data-status="failed" role="alert">{card.undoError}</p>}

            {kind === 'replan' && (
                <div className={styles.cardActions}>
                    <button type="button" className={styles.confirm} onClick={openPlan} disabled={busy}>{t('assistantPlanOpen')}</button>
                </div>
            )}
            {kind === 'create' && status === 'failed' && (
                <div className={styles.cardActions}>
                    <button type="button" className={styles.confirm} onClick={retryCreate}>{t('assistantStudyRetry')}</button>
                </div>
            )}
            {kind === 'create' && status === 'done' && card.undo && (
                <div className={styles.cardActions}>
                    <button type="button" className={styles.cancel} disabled={card.undoing}
                        onClick={() => card.undo().catch(() => { /* said on the card and in a toast */ })}>{t('assistantUndo')}</button>
                </div>
            )}
            {(kind === 'update' || kind === 'delete') && waiting && (
                <div className={styles.cardActions}>
                    {asks ? (
                        <>
                            <button type="button" className={styles.confirm} onClick={() => confirm('keep')} disabled={busy}>{t('assistantStudyKeep')}</button>
                            <button type="button" className={styles.confirm} onClick={() => confirm('delete')} disabled={busy}>{t('assistantStudyRemove')}</button>
                        </>
                    ) : (
                        <button type="button" className={styles.confirm} onClick={() => confirm()} disabled={busy}>{t('assistantConfirm')}</button>
                    )}
                    <button type="button" className={styles.cancel} onClick={() => onChange({ status: 'cancelled' })} disabled={busy}>{t('assistantCancel')}</button>
                </div>
            )}
        </div>
    );
}
