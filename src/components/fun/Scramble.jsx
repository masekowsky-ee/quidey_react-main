import { useEffect, useState } from 'react';
import styles from './Fun.module.css';
import { useTranslation } from '../../i18n/useTranslation';
import { fill } from '../../features/helperFunction';
import { SCRAMBLE_WORDS } from '../../features/fun/words';
import { SCRAMBLE_LEVELS, scrambleWordsFor, pick, scramble, shuffle, readBest, saveBest } from '../../features/fun/games';
import { useCelebrate } from '../../features/settings/motion';
import Stats from './Stats';

function newRound(language, level, previous) {
    const list = scrambleWordsFor(SCRAMBLE_WORDS[language] ?? SCRAMBLE_WORDS.en, level);
    let entry = pick(list);
    while (list.length > 1 && entry[0] === previous) entry = pick(list);
    const [word, hint] = entry;
    // easy gives the first letter away for free
    return { word, hint, letters: [...scramble(word)], picked: [], revealed: SCRAMBLE_LEVELS[level].given, result: null };
}

// Letter salad: tap (or type) the mixed-up letters in the right order.
// The difficulty sets the word length, whether the category is shown and free letters.
export default function Scramble({ level = 'normal' }) {
    const { t, language } = useTranslation();
    const settings = SCRAMBLE_LEVELS[level];
    const [round, setRound] = useState(() => newRound(language, level));
    const [score, setScore] = useState(0);
    const [streak, setStreak] = useState(0);
    const [best, setBest] = useState(() => readBest('scramble', level));
    const celebrate = useCelebrate(0);
    const [shake, setShake] = useState(0);

    const { word, hint, letters, picked, revealed, result } = round;
    const finished = result === 'right' || result === 'skipped';
    // revealed letters are fixed at the start of the answer
    const guess = word.slice(0, revealed) + picked.map((i) => letters[i]).join('');
    // letters bought with "reveal" (not the free one on easy)
    const hintsUsed = revealed - settings.given;

    const check = (nextPicked) => {
        const attempt = word.slice(0, revealed) + nextPicked.map((i) => letters[i]).join('');
        if (attempt.length < word.length) return setRound((r) => ({ ...r, picked: nextPicked, result: null }));
        if (attempt === word) {
            // longer words and fewer hints give more points
            setScore((s) => s + Math.max(1, word.length - hintsUsed * 2));
            const nextStreak = streak + 1;
            setStreak(nextStreak);
            setBest(saveBest('scramble', level, nextStreak));
            celebrate();
            setRound((r) => ({ ...r, picked: nextPicked, result: 'right' }));
        } else {
            setShake((n) => n + 1);
            setRound((r) => ({ ...r, picked: [], result: 'wrong' }));
        }
    };

    // letters still to place: all minus the revealed ones (removed once each) minus the picked ones
    const available = (() => {
        const free = letters.map((_, i) => i);
        for (const ch of word.slice(0, revealed)) {
            const at = free.findIndex((i) => letters[i] === ch);
            if (at >= 0) free.splice(at, 1);
        }
        return free.filter((i) => !picked.includes(i));
    })();

    const tap = (i) => {
        if (finished || !available.includes(i)) return;
        check([...picked, i]);
    };

    const undo = () => {
        if (finished) return;
        setRound((r) => ({ ...r, picked: r.picked.slice(0, -1), result: null }));
    };

    const reveal = () => {
        if (finished || revealed >= word.length - 1) return;
        setRound((r) => ({ ...r, revealed: r.revealed + 1, picked: [], result: null }));
    };

    const skip = () => {
        setStreak(0);
        setRound((r) => ({ ...r, result: 'skipped' }));
    };

    const next = () => setRound(newRound(language, level, word));

    const reshuffle = () => setRound((r) => ({ ...r, letters: shuffle(r.letters), picked: [], result: null }));

    // typing picks the first free tile with that letter
    useEffect(() => {
        const onKey = (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.target.closest?.('input, textarea')) return;
            if (e.key === 'Backspace') undo();
            else if (e.key === 'Enter') {
                // Enter on a focused button already clicks it
                if (!finished || e.target.closest?.('button')) return;
                next();
            } else if (/^[a-z]$/i.test(e.key)) {
                const i = available.find((idx) => letters[idx] === e.key.toUpperCase());
                if (i !== undefined) tap(i);
            } else return;
            e.preventDefault();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    let status = '';
    if (result === 'right') status = t('scrambleRight');
    else if (result === 'wrong') status = t('scrambleWrong');
    else if (result === 'skipped') status = fill(t('scrambleSkipped'), { word });

    return (
        <div className={styles.game}>
            <Stats items={[
                { label: t('funScore'), value: score },
                { label: t('funStreak'), value: streak },
                { label: t('funBest'), value: best },
            ]} />
            <p className={styles.help}>
                {settings.category ? fill(t('scrambleCategory'), { hint }) : fill(t('scrambleNoCategory'), { n: word.length })}
            </p>

            {/* the answer so far */}
            <div key={shake} className={`${styles.answerRow} ${shake && result === 'wrong' ? styles.shake : ''}`} aria-label={guess || undefined}>
                {[...word].map((ch, i) => {
                    const shown = result === 'skipped' ? ch : guess[i];
                    return (
                        <span
                            key={i}
                            className={`${styles.slot} ${shown ? styles.slotFilled : ''} ${i < revealed ? styles.slotHint : ''} ${result === 'right' ? styles.correct : ''}`}
                            style={result === 'right' ? { animationDelay: `${i * 60}ms` } : undefined}
                        >
                            {shown ?? ''}
                        </span>
                    );
                })}
            </div>

            <p className={`${styles.status} ${result === 'right' ? styles.statusWin : ''}`} aria-live="polite">{status}</p>

            {finished ? (
                <button type="button" className={styles.primary} onClick={next}>{t('scrambleNext')}</button>
            ) : (
                <>
                    <div className={styles.letterPool}>
                        {letters.map((ch, i) => (
                            <button
                                key={i}
                                type="button"
                                className={styles.letter}
                                // a click doesn't keep the focus, so Enter and typing still go to the game
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => tap(i)}
                                disabled={!available.includes(i)}
                            >
                                {ch}
                            </button>
                        ))}
                    </div>
                    <div className={styles.toolRow}>
                        <button type="button" onClick={undo} disabled={picked.length === 0}>{t('scrambleUndo')}</button>
                        <button type="button" onClick={reshuffle}>{t('scrambleShuffle')}</button>
                        <button type="button" onClick={reveal} disabled={revealed >= word.length - 1}>{t('scrambleReveal')}</button>
                        <button type="button" className={styles.quiet} onClick={skip}>{t('scrambleSkip')}</button>
                    </div>
                </>
            )}
        </div>
    );
}
