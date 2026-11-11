import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { fetchSubjects, saveSubject, selectSubjects } from '../../features/study/study';
import { showToast } from '../../features/toast/toast';
import { groupColorAttr } from '../../features/tasks/taskColors';
import TaskColorButton from '../task/TaskColorButton.jsx';
import GoalShape from './GoalShape.jsx';
import { fill } from '../../features/helperFunction';
import { formatGrade } from '../../features/study/grades';
import { useTranslation } from '../../i18n/useTranslation';
import Icon from '../icons.jsx';
import { Bone, Skeleton } from '../skeleton/Skeleton.jsx';
import { ProgressBar } from './GoalProgress.jsx';
import { countdownText, useStudyError } from './studyUi';
import styles from './Study.module.css';
import ScanSheet from '../scan/ScanSheet.jsx';
import { useAiQuota } from '../../features/ai/ai';

const NAME_MAX = 60;

function SubjectRow({ subject, onArchive, onColor }) {
    const { t, language } = useTranslation();
    const goal = subject.nextGoal;
    return (
        <li className={styles.item} data-task-color={groupColorAttr(subject)}>
            <Link to={`/study/${subject.id}`} className={styles.itemLink}>
                <span className={styles.itemName}>
                    {subject.emoji && <span aria-hidden="true">{subject.emoji} </span>}
                    <span>{subject.name}</span>
                </span>
                {goal ? (
                    <span className={styles.meta}>
                        <span><GoalShape shape={goal.shape} /> {goal.name}</span>
                        <span>{countdownText(goal.due, t)}</span>
                        {goal.behindMinutes > 0 && <span className={styles.badge}>{t('studyBehind')}</span>}
                        <ProgressBar value={goal.progress} label={goal.name} />
                    </span>
                ) : (
                    <span className={styles.meta}>{t('studyNoGoal')}</span>
                )}
                {/* the two averages: all exams, and everything else that was graded */}
                <span className={styles.meta}>
                    <span>{fill(t('studyAvgExam'), { value: formatGrade(subject.exam?.avg, language) })}</span>
                    <span>{fill(t('studyAvgOther'), { value: formatGrade(subject.other?.avg, language) })}</span>
                </span>
            </Link>
            <TaskColorButton task={subject} label={t('studySubjectColor')} onChange={(color) => onColor(subject, color)} />
            <button type="button" className={styles.iconButton} onClick={() => onArchive(subject)}
                aria-label={`${subject.archived ? t('studyUnarchive') : t('studyArchive')}: ${subject.name}`}
                title={subject.archived ? t('studyUnarchive') : t('studyArchive')}>
                <Icon name="archive" size={18} />
            </button>
        </li>
    );
}

export default function SubjectList() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const errorText = useStudyError();
    const subjects = useSelector(selectSubjects);
    const [loaded, setLoaded] = useState(false);
    const aiQuota = useAiQuota();
    const [scanning, setScanning] = useState(false);
    const [name, setName] = useState('');
    const [showArchived, setShowArchived] = useState(false);

    useEffect(() => {
        dispatch(fetchSubjects()).catch(() => dispatch(showToast(t('studyError_default'), 'error'))).finally(() => setLoaded(true));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch]);

    const add = async (e) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return;
        try {
            await dispatch(saveSubject(null, { name: trimmed }));
            setName('');
        } catch (err) {
            dispatch(showToast(err.code === 'subject_exists' ? t('studySubjectExists') : errorText(err), 'error'));
        }
    };

    const archive = (subject) => dispatch(saveSubject(subject.id, { archived: !subject.archived }))
        .catch((err) => dispatch(showToast(errorText(err), 'error')));
    const recolor = (subject, color) => dispatch(saveSubject(subject.id, { color }))
        .catch((err) => dispatch(showToast(errorText(err), 'error')));

    const active = subjects.filter(s => !s.archived);
    const archived = subjects.filter(s => s.archived);

    return (
        <div className={styles.page} data-part="study">
            {scanning && <ScanSheet onClose={() => setScanning(false)} onDone={(made) => { if (made.plan) dispatch(fetchSubjects()).catch(() => {}); }} />}
            <header className={styles.head}>
                <div>
                    <h1 className={styles.title}>{t('studyTitle')}</h1>
                    <p className={styles.subtitle}>{t('studySubtitle')}</p>
                </div>
                <div className={styles.actions}>
                    {/* a syllabus or exam plan read by the AI into a study goal (ScanSheet) */}
                    {aiQuota?.available &&
                        <button type="button" className={styles.btn} onClick={() => setScanning(true)}>
                            <Icon name="brain" size={14} /> {t('scanTitle')}
                        </button>}
                    <button type="button" className={styles.btn} onClick={() => navigate({ search: '?new=goal' })} data-tip="study-new-goal">
                        <Icon name="plus" size={14} /> {t('studyAddGoal')}
                    </button>
                </div>
            </header>

            <form className={styles.newRow} onSubmit={add} data-tip="study-new-subject">
                <input value={name} maxLength={NAME_MAX} onChange={e => setName(e.target.value)}
                    placeholder={t('studyNewSubject')} aria-label={t('studySubjectName')} />
                <button type="submit" className={styles.btnPrimary} disabled={!name.trim()}>
                    <Icon name="plus" size={16} /> {t('studyAddSubject')}
                </button>
            </form>

            {!loaded ? (
                <Skeleton className={styles.list}>
                    {[0, 1, 2].map(i => <Bone key={i} h="4.2rem" />)}
                </Skeleton>
            ) : (
                <>
                    {active.length === 0
                        ? <p className={styles.empty}>{t('studySubjectsEmpty')}</p>
                        : <ul className={styles.list}>{active.map(s => <SubjectRow key={s.id} subject={s} onArchive={archive} onColor={recolor} />)}</ul>}
                    {archived.length > 0 && (
                        <div className={styles.group}>
                            <button type="button" className={styles.groupToggle} aria-expanded={showArchived}
                                onClick={() => setShowArchived(v => !v)}>
                                <Icon name="chevronDown" size={16} /> {fill(t('studyArchived'), { n: archived.length })}
                            </button>
                            {showArchived && <ul className={styles.list}>{archived.map(s => <SubjectRow key={s.id} subject={s} onArchive={archive} onColor={recolor} />)}</ul>}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
