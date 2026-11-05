import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { fill } from '../../features/helperFunction';
import { PATTERN_PADS, growPattern, patternStepMs } from '../../features/arcade/arcade';
import { playPad, playSound } from '../../features/settings/sound';
import styles from './Arcade.module.css';

// each pad its own colour (the task colours, which every theme has)
const PAD_COLORS = ['teal', 'orange', 'violet', 'yellow'];

// "Muster": four pads, each with its own colour and tone. The game plays a pattern, you play it
// back; every round it grows by one and gets a little faster. One wrong pad ends the run; the
// score is the rounds played back. onFinish(score).
export default function Pattern({ onFinish }) {
    const { t } = useTranslation();
    const [phase, setPhase] = useState('idle'); // idle | showing | input | over
    const [pattern, setPattern] = useState([]);
    const [lit, setLit] = useState(null);
    const [pos, setPos] = useState(0);
    const [wrong, setWrong] = useState(null);
    const finish = useRef(onFinish);
    useEffect(() => { finish.current = onFinish; });

    const rounds = Math.max(0, pattern.length - 1);

    const start = () => {
        setWrong(null);
        setPos(0);
        setPattern(growPattern([]));
        setPhase('showing');
    };

    // the pattern played: each pad lights and sounds in turn, then it is my turn
    useEffect(() => {
        if (phase !== 'showing') return undefined;
        const step = patternStepMs(pattern.length);
        const timers = [];
        pattern.forEach((pad, i) => {
            timers.push(setTimeout(() => { setLit(pad); playPad(pad); }, 500 + i * step));
            timers.push(setTimeout(() => setLit(null), 500 + i * step + step * 0.6));
        });
        timers.push(setTimeout(() => { setPos(0); setPhase('input'); }, 500 + pattern.length * step));
        return () => timers.forEach(clearTimeout);
    }, [phase, pattern]);

    const press = (pad) => {
        if (phase !== 'input') return;
        playPad(pad);
        setLit(pad);
        setTimeout(() => setLit(prev => (prev === pad ? null : prev)), 180);
        if (pad !== pattern[pos]) {
            setWrong(pad);
            setPhase('over');
            playSound('error');
            finish.current?.(pattern.length - 1);
            return;
        }
        if (pos + 1 < pattern.length) { setPos(pos + 1); return; }
        // all of it: one more
        setPattern(prev => growPattern(prev));
        setPhase('showing');
    };

    return (
        <div className={styles.game}>
            <dl className={styles.gameStats}>
                <div><dt>{t('arcadeRounds')}</dt><dd>{rounds}</dd></div>
                <div><dt>{t('arcadeTurn')}</dt><dd>{t(phase === 'input' ? 'arcadeTurnYou' : phase === 'showing' ? 'arcadeTurnWatch' : 'arcadeTurnNone')}</dd></div>
            </dl>
            <div className={styles.patternField} data-phase={phase} role="group" aria-label={t('arcadeGame_pattern')}>
                {Array.from({ length: PATTERN_PADS }, (_, pad) =>
                    <button key={pad} type="button" className={styles.pad} data-task-color={PAD_COLORS[pad]}
                        data-lit={lit === pad || undefined} data-wrong={wrong === pad || undefined}
                        aria-label={fill(t('arcadePad'), { n: pad + 1 })}
                        disabled={phase !== 'input'}
                        onPointerDown={(e) => { e.preventDefault(); press(pad); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); press(pad); } }} />)}
                {(phase === 'idle' || phase === 'over') &&
                    <div className={styles.overlay}>
                        {phase === 'over' && <p className={styles.overlayScore}>{fill(t(rounds === 1 ? 'arcadeRunRound' : 'arcadeRunRounds'), { n: rounds })}</p>}
                        <p className={styles.overlayText}>{t(phase === 'over' ? 'arcadeAgainHint' : 'arcadePatternHow')}</p>
                        <button type="button" className={styles.startBtn} onClick={start}>{t(phase === 'over' ? 'arcadeAgain' : 'arcadeStart')}</button>
                    </div>}
            </div>
            <p className={styles.srOnly} role="status">{phase === 'input' ? t('arcadeTurnYou') : ''}</p>
        </div>
    );
}
