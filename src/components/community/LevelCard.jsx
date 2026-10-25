import styles from './Community.module.css';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { fill } from '../../features/helperFunction';
import { TIERS, UNLOCKS, fetchProgress, formatNumber, nextUnlocks, tierFor, unlockText } from '../../features/progress/progress';
import Icon from '../icons';

// limit: at most this many rows (the next few unlocks)
function UnlockRows({ steps, reached, t, limit = Infinity, className = '' }) {
    return (
        <ul className={`${styles.unlockList} ${className}`}>
            {steps.flatMap(step => step.items.map((item, i) => ({ step, item, i }))).slice(0, limit).map(({ step, item, i }) => (
                <li key={`${step.level}-${i}`} className={styles.unlockRow} data-unlocked={step.level <= reached}>
                    <span>{unlockText(t, item)}</span>
                    <span className={styles.unlockLevel}>
                        {step.level <= reached ? t('levelUnlocked') : fill(t('levelLabel'), { level: step.level })}
                    </span>
                </li>
            ))}
        </ul>
    );
}

// My level: the number and its name, the way to the next one, how far I have grown, what
// comes next, and (folded) how XP is earned and every unlock
export default function LevelCard() {
    const { t, language } = useTranslation();
    const n = (value) => formatNumber(value, language);
    const dispatch = useDispatch();
    const progress = useSelector(state => state.progress.data);
    const failed = useSelector(state => state.progress.failed);

    if (!progress) {
        return (
            <div className={styles.panel} aria-busy={!failed}>
                <div className={styles.panelHead}><h2 className={styles.panelTitle}>{t('levelTitle')}</h2></div>
                {failed ? (
                    <p className={styles.errorLine}>
                        {t('progressFailed')}
                        <button type="button" className={styles.textBtn} onClick={() => dispatch(fetchProgress()).catch(() => {})}>{t('feedRetry')}</button>
                    </p>
                ) : (
                    <>
                        <span className={styles.skeleton} style={{ width: '4.5rem', height: '2rem' }} />
                        <div className={styles.track} />
                        <span className={styles.skeleton} style={{ width: '60%', height: '0.75rem' }} />
                    </>
                )}
            </div>
        );
    }

    const { level, xp, levelStartXp, nextLevelXp } = progress;
    const reached = progress.unlockLevel ?? level;
    // on the top level there is no next one: the track is full
    const top = nextLevelXp === null;
    const share = top ? 1 : Math.min(1, Math.max(0, (xp - levelStartXp) / (nextLevelXp - levelStartXp)));
    const tier = tierFor(level);
    const nextTier = TIERS.find(item => item.level > level);
    const upcoming = nextUnlocks(reached);

    return (
        <div className={styles.panel}>
            <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>{t('levelTitle')}</h2>
                {progress.streak > 0 && (
                    <span className={styles.panelMeta}>
                        {progress.streak === 1 ? t('levelStreakOne') : fill(t('levelStreak'), { days: progress.streak })}
                    </span>
                )}
            </div>

            <div className={styles.levelTop}>
                <div>
                    <p className={styles.levelNumber}>{level}</p>
                    <p className={styles.levelTier}>{t(`tier_${tier.id}`)}</p>
                </div>
                <p className={styles.levelXp}>
                    <strong>{n(xp)}</strong> XP<br />
                    {top ? t('levelMax') : fill(t('levelToNext'), { xp: n(nextLevelXp - xp), level: level + 1 })}
                </p>
            </div>

            <div className={styles.track} role="progressbar" aria-valuemin={levelStartXp} aria-valuemax={top ? xp : nextLevelXp} aria-valuenow={xp}
                aria-label={top ? t('levelMax') : fill(t('levelXpOf'), { xp: n(xp), next: n(nextLevelXp) })}>
                <span className={styles.trackFill} style={{ transform: `scaleX(${share})` }} />
            </div>
            <div className={styles.trackEnds} aria-hidden="true">
                <span>{fill(t('levelLabel'), { level })}</span>
                <span>{top ? t('levelMax') : fill(t('levelLabel'), { level: level + 1 })}</span>
            </div>

            <ol className={styles.growth} aria-label={TIERS.map(item => t(`tier_${item.id}`)).join(', ')}>
                {TIERS.map(item => (
                    <li key={item.id} data-reached={level >= item.level} data-current={item.id === tier.id}
                        title={`${t(`tier_${item.id}`)} · ${fill(t('levelLabel'), { level: item.level })}`} />
                ))}
            </ol>
            <div className={styles.growthLabels}>
                <strong>{t(`tier_${tier.id}`)}</strong>
                {nextTier && <span>{t(`tier_${nextTier.id}`)} · {fill(t('levelLabel'), { level: nextTier.level })}</span>}
            </div>

            {upcoming.length > 0 && (
                <>
                    <h3 className={styles.subTitle}>{t('levelNext')}</h3>
                    <UnlockRows steps={upcoming} reached={reached} t={t} limit={3} className={styles.upcoming} />
                </>
            )}

            <div className={styles.disclosures}>
                <details className={styles.disclosure}>
                    <summary>{t('xpHow')}<Icon name="chevronDown" size={16} /></summary>
                    <div className={styles.disclosureBody}>
                        <ul className={styles.howList}>
                            <li>{t('xpHowFocus')}</li>
                            <li>{t('xpHowTasks')}</li>
                            <li>{t('xpHowChallenges')}</li>
                        </ul>
                        <p className={styles.howNote}>
                            {fill(t('xpSources'), {
                                focus: n(progress.sources.focus),
                                tasks: n(progress.sources.tasks),
                                challenges: n(progress.sources.challenges),
                            })}
                        </p>
                        <p className={styles.howNote}>{t('xpHowKeep')}</p>
                    </div>
                </details>
                <details className={styles.disclosure}>
                    <summary>{t('levelAllUnlocks')}<Icon name="chevronDown" size={16} /></summary>
                    <div className={`${styles.disclosureBody} ${styles.ladder}`}>
                        <UnlockRows steps={UNLOCKS} reached={reached} t={t} />
                    </div>
                </details>
            </div>
        </div>
    );
}
