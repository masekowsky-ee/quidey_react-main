import { useEffect } from 'react';
import { readGoalDraft } from '../../features/study/goalDraft';
import { useDispatch } from 'react-redux';
import { fetchStudyStatus } from '../../features/study/study';
import { matchPath, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import SubjectList from './SubjectList.jsx';
import SubjectView from './SubjectView.jsx';
import GoalView from './GoalView.jsx';
import GoalSheet from './GoalSheet.jsx';
import PlanPreview from './PlanPreview.jsx';

// /study (subjects), /study/:subjectId (its goals), /study/goals/:id (one goal).
// For everybody (it was tester only until 2026-11-10). The sheets hang on query parameters: ?new=goal (create sheet, on the subject
// list and a subject's page) and ?replan=1 (plan preview, on every study page). Closing removes them.
export default function StudyPage() {
    const dispatch = useDispatch();
    // the status feeds the goal pages' behind badge (and frees what is ahead), once per visit
    useEffect(() => { dispatch(fetchStudyStatus()).catch(() => {}); }, [dispatch]);
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const goal = matchPath('/study/goals/:id', pathname);
    const subject = goal ? null : matchPath('/study/:subjectId', pathname);
    const close = () => navigate({ search: '' }, { replace: true });
    // back from the settings (where the sheet was left for the study times): the sheet opens again with its draft
    useEffect(() => {
        const draft = readGoalDraft();
        if (draft?.away && draft.path === pathname && !params.get('new')) navigate({ search: '?new=goal' }, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const page = goal
        ? <GoalView key={goal.params.id} goalId={Number(goal.params.id)} />
        : subject
            ? <SubjectView key={subject.params.subjectId} subjectId={Number(subject.params.subjectId)} />
            : <SubjectList />;

    return (
        <>
            {page}
            {params.get('new') === 'goal' && !goal && (
                <GoalSheet subjectId={subject ? Number(subject.params.subjectId) : null} onClose={close} />
            )}
            {params.get('replan') === '1' && <PlanPreview onDone={close} />}
        </>
    );
}
