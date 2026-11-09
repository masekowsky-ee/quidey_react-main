import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPlanPreview, applyPlan, selectPlanPreview, formatHours } from '../../features/study/study';
import { fill, parseDate, mondayIndex } from '../../features/helperFunction';
import { useTranslation } from '../../i18n/useTranslation';
import { FormSheet } from '../QuickAdd.jsx';
import SheetGrabber from '../SheetGrabber.jsx';
import Icon from '../icons.jsx';
import { Bone, Skeleton } from '../skeleton/Skeleton.jsx';
import { useStudyError } from './studyUi';
import styles from './Study.module.css';
import own from './GoalSheet.module.css';

// the minutes a goal is short, from the planner's shortfall ({ goalId: minutes } or a list)
function shortfallOf(shortfall, goalId) {
    if (Array.isArray(shortfall)) return shortfall.find(s => s.goalId === goalId)?.minutes ?? 0;
    return Number(shortfall?.[goalId] ?? 0);
}

// "Di 12.11. 16:00" (no time: "Di 12.11.")
function useWhen() {
    const { t } = useTranslation();
    return (at) => {
        const day = parseDate(at?.date);
        if (!day) return '';
        const text = `${t('weekDays', mondayIndex(day))} ${day.getDate()}.${day.getMonth() + 1}.`;
        return at.time ? `${text} ${at.time}` : text;
    };
}

function summaryText(summary, t) {
    const parts = [];
    if (summary.moved > 0) parts.push(fill(t(summary.moved === 1 ? 'studySummaryMoved_one' : 'studySummaryMoved'), { n: summary.moved }));
    if (summary.added > 0) parts.push(fill(t('studySummaryNew'), { n: summary.added }));
    if (summary.dropped > 0) parts.push(fill(t(summary.dropped === 1 ? 'studySummaryDropped_one' : 'studySummaryDropped'), { n: summary.dropped }));
    return parts.length > 0 ? parts.join(' · ') : t('studySummaryUnchanged');
}

function ChangeRow({ change }) {
    const { t } = useTranslation();
    const when = useWhen();
    let text;
    if (change.type === 'moved') text = `${when(change.from)} → ${when(change.to)}`;
    else if (change.type === 'new') text = fill(t('studyChangeNew'), { when: when(change.to) });
    else text = t('studyChangeDropped');
    return (
        <li className={own.change}>
            <span className={own.changePart}>{change.partName}</span>
            <span className={own.changeWhen}>{text}</span>
        </li>
    );
}

// The plan the planner proposes, grouped by goal. Übernehmen applies all of it or nothing; when
// the plan changed meanwhile (409) the fresh proposal is shown with a line saying so.
// onCancel(): put the sheet away; onApplied(): the plan was applied.
export function PlanPreviewContent({ onCancel, onApplied }) {
    const { t, language } = useTranslation();
    const dispatch = useDispatch();
    const errorText = useStudyError();
    const preview = useSelector(selectPlanPreview);
    const goals = useSelector(state => state.study.goals);
    const [state, setState] = useState('loading');
    const [busy, setBusy] = useState(false);
    const [changed, setChanged] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        let alive = true;
        dispatch(fetchPlanPreview())
            .then(() => { if (alive) setState('ready'); })
            .catch(() => { if (alive) setState('error'); });
        return () => { alive = false; };
    }, [dispatch]);

    const apply = async () => {
        setBusy(true);
        setError(null);
        try {
            await dispatch(applyPlan(preview.inputHash));
            onApplied();
        } catch (err) {
            if (err.code === 'plan_changed') setChanged(true);
            else setError(errorText(err));
            setBusy(false);
        }
    };

    if (state === 'loading' || (state === 'ready' && !preview)) {
        return (
            <Skeleton className={own.rows} aria-label={t('studyPreviewLoading')}>
                {[0, 1, 2].map(i => <Bone key={i} h="3rem" />)}
            </Skeleton>
        );
    }
    if (state === 'error') {
        return (
            <>
                <p className={own.error} role="alert">{t('studyPreviewError')}</p>
                <div className={own.footer}>
                    <button type="button" className={styles.btn} onClick={onCancel}>{t('close')}</button>
                </div>
            </>
        );
    }

    const nothing = preview.goals.every(g => g.summary.moved + g.summary.added + g.summary.dropped === 0);
    // a goal that doesn't fit is not "everything fits": then only its banner and Schließen
    const short = preview.goals.some(g => shortfallOf(preview.shortfall, g.goalId) > 0);
    return (
        <>
            {changed && <p className={own.notice} role="status">{t('studyPlanChanged')}</p>}
            {preview.goals.map(group => {
                const missing = shortfallOf(preview.shortfall, group.goalId);
                const kind = goals[group.goalId]?.kind ?? 'other';
                return (
                    <fieldset key={group.goalId} className={own.group} aria-label={group.name}>
                        <legend className={own.groupName}>{group.name}</legend>
                        {missing > 0 && (
                            <p className={own.banner} role="status">{fill(t(`studyShortfall_${kind}`), { hours: formatHours(missing, language) })}</p>
                        )}
                        {!nothing && <p className={own.summary}>{summaryText(group.summary, t)}</p>}
                        {group.changes.length > 0 && (
                            <ul className={own.changes}>
                                {group.changes.map((change, i) => <ChangeRow key={i} change={change} />)}
                            </ul>
                        )}
                    </fieldset>
                );
            })}
            {nothing && !short && <p className={own.hint}>{t('studyPlanNothing')}</p>}
            {error && <p className={own.error} role="alert">{error}</p>}
            <div className={own.footer}>
                {nothing ? (
                    <button type="button" className={styles.btn} onClick={onCancel}>{t('close')}</button>
                ) : (
                    <>
                        <button type="button" className={styles.btn} disabled={busy} onClick={onCancel}>{t('studyCancel')}</button>
                        <button type="button" className={styles.btnPrimary} disabled={busy} onClick={apply}>{t('studyApply')}</button>
                    </>
                )}
            </div>
        </>
    );
}

// The preview as its own sheet ("Neu planen", the Home card). onDone(applied?) when it is closed.
export default function PlanPreview({ onDone }) {
    const { t } = useTranslation();
    return (
        <FormSheet onClose={() => onDone?.(false)}>
            {(sheet, close) => (
                <div className={own.panel} role="dialog" aria-modal="true" aria-labelledby="planPreviewTitle" {...sheet.panel}>
                    <SheetGrabber />
                    <button type="button" className={own.close} onClick={close} aria-label={t('close')}><Icon name="close" size={18} /></button>
                    <div className={own.head} data-sheet-drag>
                        <h2 id="planPreviewTitle" className={own.title}>{t('studyPreviewTitle')}</h2>
                    </div>
                    <PlanPreviewContent onCancel={close} onApplied={() => onDone?.(true)} />
                </div>
            )}
        </FormSheet>
    );
}
