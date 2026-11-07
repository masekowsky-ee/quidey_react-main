import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { fetchSubjects, fetchGoals, deleteSubject, selectSubjects } from '../../features/study/study';
import { showToast } from '../../features/toast/toast';
import { fill } from '../../features/helperFunction';
import { useTranslation } from '../../i18n/useTranslation';
import GoalShape from './GoalShape.jsx';
import ConfirmDeleteButton from '../ConfirmDeleteButton.jsx';
import Icon from '../icons.jsx';
import { Bone, Skeleton } from '../skeleton/Skeleton.jsx';
import GoalProgress from './GoalProgress.jsx';
import SubjectEditSheet from './SubjectEditSheet.jsx';
import { countdownText, goalStateKey, useStudyError } from './studyUi';
import styles from './Study.module.css';

const sum = (parts, key) => parts.reduce((total, p) => total + (p[key] ?? 0), 0);

// One subject: its goals by date. "+ Ziel" sets ?new=goal, where the create sheet (Task 13) opens.
export default function SubjectView({ subjectId }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const errorText = useStudyError();
    const subjects = useSelector(selectSubjects);
    const allGoals = useSelector(state => state.study.goals);
    const [loaded, setLoaded] = useState(false);
    const [editing, setEditing] = useState(false);
    const subject = subjects.find(s => s.id === subjectId);

    useEffect(() => {
        Promise.all([dispatch(fetchSubjects()), dispatch(fetchGoals(subjectId))])
            .catch(() => dispatch(showToast(t('studyError_default'), 'error')))
            .finally(() => setLoaded(true));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, subjectId]);

    const goals = useMemo(() => Object.values(allGoals)
        .filter(g => g.subjectId === subjectId)
        .sort((a, b) => a.due.localeCompare(b.due) || a.id - b.id), [allGoals, subjectId]);

    const remove = () => dispatch(deleteSubject(subjectId))
        .then(() => navigate('/study'))
        .catch((err) => dispatch(showToast(errorText(err), 'error')));

    if (loaded && !subject) {
        return (
            <div className={styles.page}>
                <Link to="/study" className={styles.back}>{t('studyBack')}</Link>
                <p className={styles.empty}>{t('studySubjectNotFound')}</p>
            </div>
        );
    }

    return (
        <div className={styles.page} data-part="study-subject">
            <Link to="/study" className={styles.back}>{t('studyBack')}</Link>
            <header className={styles.head}>
                <h1 className={styles.title}>
                    {subject ? <>{subject.emoji && <span aria-hidden="true">{subject.emoji} </span>}{subject.name}</> : <Bone w="10rem" h="1.5rem" />}
                </h1>
                <div className={styles.actions}>
                    <button type="button" className={styles.btnPrimary} onClick={() => navigate({ search: '?new=goal' })}>
                        <Icon name="plus" size={16} /> {t('studyAddGoal')}
                    </button>
                    {subject && (
                        <button type="button" className={styles.btn} onClick={() => setEditing(true)}>
                            <Icon name="edit" size={14} /> {t('studyEditSubject')}
                        </button>
                    )}
                    {subject && <ConfirmDeleteButton onConfirm={remove} label={fill(t('studyDeleteSubject'), { name: subject.name })} />}
                </div>
            </header>
            {editing && subject && <SubjectEditSheet subject={subject} onClose={() => setEditing(false)} />}

            <h2 className={styles.sectionTitle}>{t('studyGoals')}</h2>
            {!loaded && goals.length === 0 ? (
                <Skeleton className={styles.list}>{[0, 1].map(i => <Bone key={i} h="4.5rem" />)}</Skeleton>
            ) : goals.length === 0 ? (
                <p className={styles.empty}>{t('studyGoalsEmpty')}</p>
            ) : (
                <ul className={styles.list}>
                    {goals.map(goal => {
                        const state = goalStateKey(goal);
                        return (
                            <li key={goal.id} className={styles.item}>
                                <Link to={`/study/goals/${goal.id}`} className={styles.itemLink}>
                                    <span className={styles.itemName}>
                                        <GoalShape shape={goal.shape} color={subject?.color} /> {goal.name}
                                    </span>
                                    <span className={styles.meta}>
                                        <span>{t(`studyKind_${goal.kind}`)}</span>
                                        <span>{countdownText(goal.due, t)}</span>
                                        {state && <span className={styles.badgeQuiet}>{t(state)}</span>}
                                    </span>
                                    <GoalProgress credit={sum(goal.parts, 'credit')} estimate={sum(goal.parts, 'estimateMinutes')} />
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
