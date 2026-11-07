import { useTranslation } from '../../i18n/useTranslation';
import styles from './Study.module.css';
import GoalShape from './GoalShape.jsx';

// "📊 Statistik II · Thema 3" under a planned session's name, in the subject's colour; a pin when
// the session is pinned (the plan leaves it alone)
export default function SessionMarker({ study, pinned = false }) {
    const { t } = useTranslation();
    if (!study) return null;
    const label = [study.subjectEmoji, study.subjectName].filter(Boolean).join(' ');
    return (
        <span className={styles.marker} data-task-color={study.subjectColor || undefined}>
            <GoalShape shape={study.goalShape} size={12} />
            {pinned && <span role="img" aria-label={t('studySessionPinned')}>📌</span>}
            {`${label} · ${study.partName}`}
        </span>
    );
}
