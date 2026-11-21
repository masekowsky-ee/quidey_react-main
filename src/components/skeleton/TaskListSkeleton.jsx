import taskStyles from '../TaskContainer.module.css';
import { useTranslation } from '../../i18n/useTranslation';
import Icon from '../icons';
import { Bone, Skeleton } from './Skeleton.jsx';
import { TaskRowSkeleton } from '../task/TaskRow.jsx';

// The list's shape while my tasks are on their way: open rows, grey where the tasks will be
export function SkeletonPanel() {
    return (
        <Skeleton className={taskStyles.panel}>
            <ul className={taskStyles.list}>
                {[0, 1, 2, 3].map(i => <TaskRowSkeleton key={i} index={i} />)}
            </ul>
        </Skeleton>
    );
}

// The whole section before the app knows it may load anything (the start screen, see AppSkeleton)
export function TaskListSkeleton() {
    const { t } = useTranslation();
    return (
        <section className={taskStyles.section}>
            <div className={taskStyles.sectionHead}>
                <span className={taskStyles.collapseBtn}><Icon name="chevronDown" className={taskStyles.chevron} /></span>
                <h2 className={taskStyles.sectionTitle}>{t('taskContainer')}</h2>
                <div className={taskStyles.headActions}><Bone pill w="9.5rem" h="2.25rem" /></div>
            </div>
            <SkeletonPanel />
        </section>
    );
}
