import styles from './Community.module.css';
import { useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { fill } from '../../features/helperFunction';
import { challengeAmount, challengeTitle } from '../../features/progress/progress';
import Icon from '../icons';

// Today's three challenges (period "day") or this week's two ("week"): what to do, how far I
// am, the XP. The same for all friends on a day, new ones at midnight and on Monday.
export default function Challenges({ period }) {
    const { t, language } = useTranslation();
    const progress = useSelector(state => state.progress.data);
    const list = progress ? (period === 'day' ? progress.daily : progress.weekly) : null;
    const titleId = `challenges-${period}`;
    const done = list?.filter(c => c.done).length ?? 0;

    return (
        <section className={styles.panel} aria-labelledby={titleId}>
            <div className={styles.panelHead}>
                <h2 id={titleId} className={styles.panelTitle}>
                    {t(period === 'day' ? 'challengesToday' : 'challengesWeek')}
                </h2>
                <span className={styles.panelMeta}>
                    {list ? `${fill(t('challengeDoneCount'), { done, total: list.length })} · ` : ''}
                    {t(period === 'day' ? 'challengesTodayEnds' : 'challengesWeekEnds')}
                </span>
            </div>
            <ul className={styles.challengeList}>
                {(list ?? Array.from({ length: period === 'day' ? 3 : 2 }, (_, i) => ({ id: `loading-${i}` }))).map(challenge => (
                    !list ? (
                        <li key={challenge.id} className={styles.challenge} aria-hidden="true">
                            <span className={styles.skeleton} style={{ width: '70%', height: '0.875rem' }} />
                            <span className={styles.skeleton} style={{ width: '2.5rem', height: '0.8125rem' }} />
                            <span className={styles.challengeBar} />
                        </li>
                    ) : (
                        <li key={challenge.id} className={styles.challenge} data-done={challenge.done}>
                            <span className={styles.challengeName}>{challengeTitle(t, challenge)}</span>
                            <span className={styles.challengeXp}>{fill(t('challengeXp'), { xp: challenge.xp })}</span>
                            <span className={styles.challengeBar} role="progressbar" aria-valuemin={0} aria-valuemax={challenge.goal}
                                aria-valuenow={challenge.value} aria-label={challengeTitle(t, challenge)}>
                                <span style={{ transform: `scaleX(${challenge.value / challenge.goal})` }} />
                            </span>
                            {challenge.done
                                ? <span className={styles.doneMark}><Icon name="check" size={14} strokeWidth={2.2} />{t('challengeDone')}</span>
                                : <span className={styles.challengeAmount}>{challengeAmount(t, challenge, language)}</span>}
                        </li>
                    )
                ))}
            </ul>
        </section>
    );
}
