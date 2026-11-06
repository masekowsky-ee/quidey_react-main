import { matchPath, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import SubjectList from './SubjectList.jsx';
import SubjectView from './SubjectView.jsx';
import GoalView from './GoalView.jsx';
import GoalSheet from './GoalSheet.jsx';
import PlanPreview from './PlanPreview.jsx';

// /study (subjects), /study/:subjectId (its goals), /study/goals/:id (one goal). Wrapped in
// TesterOnly by App. The sheets hang on query parameters: ?new=goal (create sheet, on the subject
// list and a subject's page) and ?replan=1 (plan preview, on every study page). Closing removes them.
export default function StudyPage() {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const goal = matchPath('/study/goals/:id', pathname);
    const subject = goal ? null : matchPath('/study/:subjectId', pathname);
    const close = () => navigate({ search: '' }, { replace: true });

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
