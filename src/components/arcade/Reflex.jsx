import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { fill } from '../../features/helperFunction';
import { REFLEX_TILES, nextTile, reflexLifeMs, reflexPoints } from '../../features/arcade/arcade';
import { playSound } from '../../features/settings/sound';
import styles from './Arcade.module.css';

// the wall clock (event handlers and timers only)
const clock = () => Date.now();

// "Reflex": one light at a time on a 4 × 4 field, hit it before it goes out. Endless: the lights
// get quicker as the hits add up, and the run is over once a light goes out untouched or a dark
// tile is tapped. Quick hits count double. onFinish(score) when it's over.
export default function Reflex({ onFinish }) {
    const { t } = useTranslation();
    const [phase, setPhase] = useState('idle'); // idle | running | over
    const [tile, setTile] = useState(null);
    const [score, setScore] = useState(0);
    const [hits, setHits] = useState(0);
    const [endedBy, setEndedBy] = useState(null); // 'missed' | 'wrong'
    const [flash, setFlash] = useState(null); // { tile, kind: 'hit' | 'fast' | 'miss' }
    const litAt = useRef(0);
    const scoreRef = useRef(0);
    const finish = useRef(onFinish);
    useEffect(() => { finish.current = onFinish; });

    const start = () => {
        scoreRef.current = 0;
        setScore(0);
        setHits(0);
        setFlash(null);
        setEndedBy(null);
        litAt.current = clock();
        setTile(nextTile(null));
        setPhase('running');
    };

    const end = (reason, at) => {
        setPhase('over');
        setEndedBy(reason);
        setFlash({ tile: at, kind: 'miss' });
        setTile(null);
        playSound('challenge');
        finish.current?.(scoreRef.current);
    };

    // a light that goes out untouched ends the run
    useEffect(() => {
        if (phase !== 'running' || tile === null) return undefined;
        const timer = setTimeout(() => end('missed', tile), reflexLifeMs(hits));
        return () => clearTimeout(timer);
    }, [phase, tile, hits]);

    const hit = (index) => {
        if (phase !== 'running') return;
        if (index !== tile) { end('wrong', index); return; }
        const points = reflexPoints(clock() - litAt.current, reflexLifeMs(hits));
        scoreRef.current += points;
        setScore(scoreRef.current);
        setHits(h => h + 1);
        setFlash({ tile: index, kind: points === 2 ? 'fast' : 'hit' });
        litAt.current = clock();
        setTile(nextTile(index));
    };

    return (
        <div className={styles.game}>
            <dl className={styles.gameStats}>
                <div><dt>{t('arcadeScore')}</dt><dd>{score}</dd></div>
                <div><dt>{t('arcadeHits')}</dt><dd>{hits}</dd></div>
            </dl>
            <div className={styles.reflexField} data-phase={phase} role="group" aria-label={t('arcadeGame_reflex')}>
                {Array.from({ length: REFLEX_TILES }, (_, index) =>
                    <button key={index} type="button" className={styles.reflexTile}
                        data-lit={index === tile || undefined}
                        data-flash={flash?.tile === index ? flash.kind : undefined}
                        onAnimationEnd={() => setFlash(prev => (prev?.tile === index ? null : prev))}
                        aria-label={index === tile ? t('arcadeReflexLit') : t('arcadeReflexDark')}
                        disabled={phase !== 'running'}
                        onPointerDown={(e) => { e.preventDefault(); hit(index); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hit(index); } }} />)}
                {phase !== 'running' &&
                    <div className={styles.overlay}>
                        {phase === 'over' && <p className={styles.overlayScore}>{fill(t('arcadeRunScore'), { n: score })}</p>}
                        {phase === 'over' && endedBy && <p className={styles.overlayText}>{t(endedBy === 'wrong' ? 'arcadeReflexWrong' : 'arcadeReflexMissed')}</p>}
                        <p className={styles.overlayText}>{t(phase === 'over' ? 'arcadeAgainHint' : 'arcadeReflexHow')}</p>
                        <button type="button" className={styles.startBtn} onClick={start}>{t(phase === 'over' ? 'arcadeAgain' : 'arcadeStart')}</button>
                    </div>}
            </div>
        </div>
    );
}
