import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    fetchStudyStatus, fetchStudySettings, fetchGoals, dismissBehind, formatHours,
    selectStudyStatus, selectStudySettings,
} from '../../features/study/study';
import { fill, toInputDate } from '../../features/helperFunction';
import { useTranslation } from '../../i18n/useTranslation';
import PlanPreview from './PlanPreview.jsx';
import { useStudyLoad } from './useStudyLoad.js';
import styles from './Study.module.css';
import { read, write } from '../../features/storedSetting';
import { quietly } from '../../features/api/quietly';

const LATER_KEY = 'studyLater';
const today = () => toInputDate(new Date());
const laterToday = () => read(LATER_KEY) === today();
const storeLater = () => write(LATER_KEY, today());

// Home, testers only: asks to adjust the plan when a goal is behind (and not dismissed), time was
// freed or an appointment overlaps a session. Ansehen opens the preview in place, Später hides the
// card until tomorrow, So lassen dismisses the deficits.
function ReplanCardContent() {
    const { t, language } = useTranslation();
    const dispatch = useDispatch();
    const status = useSelector(selectStudyStatus);
    const settings = useSelector(selectStudySettings);
    const [hidden, setHidden] = useState(laterToday);
    const [preview, setPreview] = useState(false);

    useStudyLoad((d) => [d(fetchStudyStatus()), !settings && d(fetchStudySettings())]);

    const goals = status?.goals ?? [];
    const sessionMinutes = settings?.sessionMinutes;
    // a dismissed deficit only comes back after it grew by a whole session
    const behindGoals = sessionMinutes == null ? [] : goals.filter(g =>
        g.behindMinutes > 0 && g.behindMinutes >= (status.notifiedMinutes?.[g.goalId] ?? 0) + sessionMinutes);
    const freed = goals.reduce((sum, g) => sum + (g.freedMinutes ?? 0), 0);
    const conflict = goals.some(g => g.conflictTaskIds?.length > 0);

    let text = null;
    if (behindGoals.length === 1) text = fill(t('studyCardOne'), { name: behindGoals[0].name, hours: formatHours(behindGoals[0].behindMinutes, language) });
    else if (behindGoals.length > 1) text = fill(t('studyCardMany'), { n: behindGoals.length });
    else if (freed > 0) text = fill(t('studyCardFreed'), { hours: formatHours(freed, language) });
    else if (conflict) text = t('studyCardConflict');

    const view = async () => {
        await quietly(dispatch(fetchGoals()));
        setPreview(true);
    };
    const later = () => { storeLater(); setHidden(true); };
    const keep = async () => {
        await Promise.all(behindGoals.map(g => quietly(dispatch(dismissBehind(g.goalId)))));
        // freed time / a conflict have nothing to dismiss: leave them be for today
        if (behindGoals.length === 0) later();
    };
    const done = (applied) => {
        setPreview(false);
        if (applied) quietly(dispatch(fetchStudyStatus()));
    };

    return (
        <>
            {text && !hidden && (
                <section className={styles.replanCard} aria-label={t('studyReplan')} data-part="home-replan">
                    <p className={styles.replanText}>{text}</p>
                    <div className={styles.actions}>
                        <button type="button" className={styles.btn} onClick={view}>{t('studyCardView')}</button>
                        <button type="button" className={styles.btn} onClick={later}>{t('studyCardLater')}</button>
                        <button type="button" className={styles.btn} onClick={keep}>{t('studyCardKeep')}</button>
                    </div>
                </section>
            )}
            {preview && <PlanPreview onDone={done} />}
        </>
    );
}

export default function ReplanCard() {
    return <ReplanCardContent />;
}
