import styles from './PlantCard.module.css';
import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { fill } from '../../features/helperFunction';
import { TIERS, formatNumber, tierFor } from '../../features/progress/progress';
import { COMMUNITY_PATHS } from '../../features/community/paths';
import LevelPlant from './LevelPlant';

// a replay takes about this long, however high the level
const REPLAY_MS = 4200;

// My plant, large: how far it has grown (the level and its name, the way to the next one), and
// "watch it grow": a replay from the seed up to today, or the slider to look at any level
// reached so far. Profile page.
export default function PlantCard() {
    const { t, language } = useTranslation();
    const progress = useSelector(state => state.progress.data);
    // the level shown: null = today's
    const [shown, setShown] = useState(null);
    const [playing, setPlaying] = useState(false);
    const timer = useRef(null);

    useEffect(() => () => clearInterval(timer.current), []);

    if (!progress) return null;
    const { level, xp, levelStartXp, nextLevelXp } = progress;
    const top = nextLevelXp === null;
    const share = top ? 1 : Math.min(1, Math.max(0, (xp - levelStartXp) / (nextLevelXp - levelStartXp)));
    const current = shown ?? level;
    const tier = tierFor(current);
    const nextTier = TIERS.find(item => item.level > level);

    const stop = () => {
        clearInterval(timer.current);
        setPlaying(false);
    };

    // from the seed to today: one level per step
    const replay = () => {
        stop();
        if (level <= 1) return;
        setPlaying(true);
        let at = 1;
        setShown(1);
        timer.current = setInterval(() => {
            at += 1;
            if (at >= level) {
                stop();
                setShown(null);
                return;
            }
            setShown(at);
        }, Math.max(90, REPLAY_MS / level));
    };

    return (
        <section className={styles.card} aria-labelledby="plant-title">
            <div className={styles.head}>
                <h2 id="plant-title" className={styles.title}>{t('plantTitle')}</h2>
                <Link to={COMMUNITY_PATHS.progress} className={styles.link}>{t('plantToCommunity')} →</Link>
            </div>
            <div className={styles.body}>
                <LevelPlant level={current} share={shown === null ? share : 0} size={176} className={styles.plant}
                    label={fill(t('plantLabel'), { level: current, tier: t(`tier_${tier.id}`) })} />
                <div className={styles.text}>
                    <p className={styles.tier}>{t(`tier_${tier.id}`)}</p>
                    <p className={styles.level}>
                        {fill(t('levelLabel'), { level: current })}
                        {shown !== null && shown !== level && <span className={styles.past}> · {t('plantPast')}</span>}
                    </p>
                    <p className={styles.hint} aria-live="polite">
                        {shown !== null && shown !== level
                            ? t(`plantTierText_${tier.id}`)
                            : top ? t('plantTop')
                            : nextTier
                                ? fill(t('plantNext'), {
                                    xp: formatNumber(nextLevelXp - xp, language), next: level + 1,
                                    tier: t(`tier_${nextTier.id}`), level: nextTier.level,
                                })
                                : fill(t('levelToNext'), { xp: formatNumber(nextLevelXp - xp, language), level: level + 1 })}
                    </p>
                    {level > 1 && (
                        <div className={styles.controls}>
                            <button type="button" className={styles.replay} onClick={playing ? stop : replay}>
                                {t(playing ? 'plantReplayStop' : 'plantReplay')}
                            </button>
                            <label className={styles.slider}>
                                <span className={styles.sliderLabel}>{t('plantSlider')}</span>
                                <input type="range" min={1} max={level} step={1} value={current}
                                    onChange={(e) => { stop(); const value = Number(e.target.value); setShown(value === level ? null : value); }}
                                    aria-valuetext={fill(t('plantLabel'), { level: current, tier: t(`tier_${tier.id}`) })} />
                            </label>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
