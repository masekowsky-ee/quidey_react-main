import { matchPath, useLocation } from 'react-router-dom';
import SubjectList from './SubjectList.jsx';
import SubjectView from './SubjectView.jsx';
import GoalView from './GoalView.jsx';

// /study (subjects), /study/:subjectId (its goals), /study/goals/:id (one goal). Wrapped in
// TesterOnly by App. Task 13 hooks its sheets into the query parameters ?new=goal (SubjectView)
// and ?replan=1 (GoalView).
export default function StudyPage() {
    const { pathname } = useLocation();
    const goal = matchPath('/study/goals/:id', pathname);
    if (goal) return <GoalView key={goal.params.id} goalId={Number(goal.params.id)} />;
    const subject = matchPath('/study/:subjectId', pathname);
    if (subject) return <SubjectView key={subject.params.subjectId} subjectId={Number(subject.params.subjectId)} />;
    return <SubjectList />;
}
