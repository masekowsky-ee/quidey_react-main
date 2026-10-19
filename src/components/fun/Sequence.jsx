import { useState } from 'react';
import styles from './Fun.module.css';
import { useTranslation } from '../../i18n/useTranslation';
import { fill } from '../../features/helperFunction';
import { makeSequence, sequenceIsTyped, readBest, saveBest } from '../../features/fun/games';
import Stats from './Stats';

// "What comes next?": spot the rule behind five numbers and name the sixth.
// Easy has only simple rules, hard adds trickier ones and the answer must be typed in.
export default function Sequence({ level = 'normal' }) {
    const { t, language } = useTranslation();
    const typed = sequenceIsTyped(level);
    const [puzzle, setPuzzle] = useState(() => makeSequence(Math.random, undefined, level));
    const [chosen, setChosen] = useState(null);
    const [input, setInput] = useState('');
    const [score, setScore] = useState(0);
    const [streak, setStreak] = useState(0);
    const [best, setBest] = useState(() => readBest('sequence', level));

    const answered = chosen !== null;
    const right = chosen === puzzle.answer;
    const number = (n) => n.toLocaleString(language);

    const choose = (n) => {
        if (answered) return;
        setChosen(n);
        if (n === puzzle.answer) {
            setScore((s) => s + 1);
            const nextStreak = streak + 1;
            setStreak(nextStreak);
            setBest(saveBest('sequence', level, nextStreak));
        } else {
            setStreak(0);
        }
    };

    const submitTyped = (e) => {
        e.preventDefault();
        const n = Number(input.trim());
        if (input.trim() === '' || !Number.isFinite(n)) return;
        choose(n);
    };

    const next = () => {
        setPuzzle(makeSequence(Math.random, undefined, level));
        setChosen(null);
        setInput('');
    };

    const [ruleKey, ruleValues] = puzzle.rule;

    return (
        <div className={styles.game}>
            <Stats items={[
                { label: t('funScore'), value: score },
                { label: t('funStreak'), value: streak },
                { label: t('funBest'), value: best },
            ]} />
            <p className={styles.help}>{t('seqQuestion')}</p>

            <div className={styles.sequence}>
                {puzzle.shown.map((n, i) => (
                    <span key={i} className={styles.seqNum}>{number(n)}</span>
                ))}
                <span className={`${styles.seqNum} ${styles.seqGap} ${answered ? (right ? styles.correct : styles.present) : ''}`}>
                    {answered ? number(puzzle.answer) : '?'}
                </span>
            </div>

            {typed ? (
                <form className={styles.answerForm} onSubmit={submitTyped}>
                    <input
                        className={styles.answerInput}
                        type="number"
                        inputMode="numeric"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={answered}
                        aria-label={t('seqYourAnswer')}
                        placeholder={t('seqYourAnswer')}
                        autoFocus
                    />
                    {!answered && <button type="submit" className={styles.primary}>{t('seqCheck')}</button>}
                </form>
            ) : (
                <div className={styles.choices}>
                    {puzzle.choices.map((n) => {
                        let state = '';
                        if (answered && n === puzzle.answer) state = styles.choiceRight;
                        else if (answered && n === chosen) state = styles.choiceWrong;
                        return (
                            <button key={n} type="button" className={`${styles.choice} ${state}`} onClick={() => choose(n)} disabled={answered && !state}>
                                {number(n)}
                            </button>
                        );
                    })}
                </div>
            )}

            <div className={styles.status} aria-live="polite">
                {answered && (
                    <>
                        <strong className={right ? styles.statusWin : undefined}>
                            {right ? t('seqRight') : fill(t('seqWrong'), { answer: number(puzzle.answer) })}
                        </strong>
                        <span className={styles.rule}>{fill(t(ruleKey), ruleValues)}</span>
                    </>
                )}
            </div>

            {answered && <button type="button" className={styles.primary} onClick={next}>{t('seqNext')}</button>}
        </div>
    );
}
