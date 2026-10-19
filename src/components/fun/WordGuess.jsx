import { useEffect, useState } from 'react';
import styles from './Fun.module.css';
import { useTranslation } from '../../i18n/useTranslation';
import { fill } from '../../features/helperFunction';
import { GUESS_WORDS } from '../../features/fun/words';
import { GUESS_LEVELS, scoreGuess, keyStates, pick, readBest, saveBest } from '../../features/fun/games';
import { useCelebrate } from '../../features/settings/motion';
import Stats from './Stats';

const KEY_ROWS = {
    en: ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'],
    de: ['QWERTZUIOP', 'ASDFGHJKL', 'YXCVBNM'],
};

// On-screen keys don't take the focus when clicked, so Enter on the real keyboard still submits
const keepFocus = (e) => e.preventDefault();

const newAnswer = (language, length) => pick((GUESS_WORDS[language] ?? GUESS_WORDS.en)[length]);

// Guess the word; tiles show which letters are right. The difficulty sets length and tries.
export default function WordGuess({ level = 'normal' }) {
    const { t, language } = useTranslation();
    const { length, tries } = GUESS_LEVELS[level];
    const [answer, setAnswer] = useState(() => newAnswer(language, length));
    const [guesses, setGuesses] = useState([]);
    const [current, setCurrent] = useState('');
    const [message, setMessage] = useState('');
    const [shake, setShake] = useState(0);
    const [streak, setStreak] = useState(0);
    const [best, setBest] = useState(() => readBest('guess', level));
    const celebrate = useCelebrate(700);

    const won = guesses.at(-1) === answer;
    const over = won || guesses.length === tries;
    const keys = keyStates(guesses, answer);

    const press = (key) => {
        if (over) return;
        setMessage('');
        if (key === 'ENTER') {
            if (current.length < length) {
                setMessage(fill(t('guessTooShort'), { n: length }));
                setShake((n) => n + 1);
                return;
            }
            const next = [...guesses, current];
            setGuesses(next);
            setCurrent('');
            if (current === answer) {
                const nextStreak = streak + 1;
                setStreak(nextStreak);
                setBest(saveBest('guess', level, nextStreak));
                celebrate();
            } else if (next.length === tries) {
                setStreak(0);
            }
        } else if (key === 'BACK') {
            setCurrent((c) => c.slice(0, -1));
        } else if (/^[A-Z]$/.test(key) && current.length < length) {
            setCurrent((c) => c + key);
        }
    };

    // typing on a real keyboard
    useEffect(() => {
        const onKey = (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.target.closest?.('input, textarea, [contenteditable="true"]')) return;
            if (e.key === 'Enter') {
                // Enter on a focused button already clicks it
                if (e.target.closest?.('button')) return;
                press('ENTER');
            } else if (e.key === 'Backspace') press('BACK');
            else if (/^[a-z]$/i.test(e.key)) press(e.key.toUpperCase());
            else return;
            e.preventDefault();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    const restart = () => {
        setAnswer(newAnswer(language, length));
        setGuesses([]);
        setCurrent('');
        setMessage('');
    };

    const rows = Array.from({ length: tries }, (_, i) => {
        if (i < guesses.length) return { letters: guesses[i], states: scoreGuess(guesses[i], answer), done: true };
        if (i === guesses.length && !over) return { letters: current, states: [], active: true };
        return { letters: '', states: [] };
    });

    let status = message;
    // the more tries were needed, the calmer the praise (the last entry for anything past six)
    if (won) status = t('guessWon', Math.min(guesses.length, 6) - 1);
    else if (over) status = fill(t('guessLost'), { word: answer });

    return (
        <div className={styles.game}>
            <Stats items={[{ label: t('funStreak'), value: streak }, { label: t('funBest'), value: best }]} />
            <p className={styles.help}>{fill(t('guessHelp'), { n: length, tries })}</p>

            <div className={styles.board} role="grid" aria-label={t('gameGuess')}>
                {rows.map((row, r) => (
                    <div
                        key={row.active ? `active-${shake}` : r}
                        role="row"
                        className={`${styles.boardRow} ${row.active && shake ? styles.shake : ''}`}
                    >
                        {Array.from({ length }, (_, c) => {
                            const letter = row.letters[c] ?? '';
                            const state = row.states[c];
                            return (
                                <span
                                    key={c}
                                    role="gridcell"
                                    aria-label={state ? `${letter} ${t(`guessState_${state}`)}` : letter || undefined}
                                    className={`${styles.tile} ${letter ? styles.tileFilled : ''} ${state ? styles[state] : ''}`}
                                    style={row.done ? { animationDelay: `${c * 90}ms` } : undefined}
                                >
                                    {letter}
                                </span>
                            );
                        })}
                    </div>
                ))}
            </div>

            <p className={`${styles.status} ${won ? styles.statusWin : ''}`} aria-live="polite">{status}</p>

            {over ? (
                <button type="button" className={styles.primary} onClick={restart}>{t('guessNew')}</button>
            ) : (
                <div className={styles.keyboard}>
                    {(KEY_ROWS[language] ?? KEY_ROWS.en).map((row, i) => (
                        <div key={row} className={styles.keyRow}>
                            {i === 2 && <button type="button" className={`${styles.key} ${styles.keyWide}`} onMouseDown={keepFocus} onClick={() => press('ENTER')}>{t('guessEnter')}</button>}
                            {[...row].map((k) => (
                                <button key={k} type="button" className={`${styles.key} ${keys[k] ? styles[keys[k]] : ''}`} onMouseDown={keepFocus} onClick={() => press(k)}>
                                    {k}
                                </button>
                            ))}
                            {i === 2 && <button type="button" className={`${styles.key} ${styles.keyWide}`} onMouseDown={keepFocus} onClick={() => press('BACK')} aria-label={t('guessDelete')}>⌫</button>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
