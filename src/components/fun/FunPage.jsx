import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import styles from './Fun.module.css';
import { useTranslation } from '../../i18n/useTranslation';
import { lineOfDay } from '../../features/fun/dailyLines';
import { LEVELS, readLevel, storeLevel } from '../../features/fun/games';
import WordGuess from './WordGuess';
import Scramble from './Scramble';
import Sequence from './Sequence';

const GAMES = [
    { id: 'guess', title: 'gameGuess', desc: 'gameGuessDesc', glyph: 'Aa', Component: WordGuess },
    { id: 'scramble', title: 'gameScramble', desc: 'gameScrambleDesc', glyph: '?!', Component: Scramble },
    { id: 'sequence', title: 'gameSequence', desc: 'gameSequenceDesc', glyph: '1 2 ?', Component: Sequence },
];

// The hidden playground. Not in the menu: it only opens through the daily line in the header,
// which passes a marker in the navigation state (kept on reload, missing when typed in).
export default function FunPage() {
    const { t, language } = useTranslation();
    const location = useLocation();
    const [gameId, setGameId] = useState('guess');
    // difficulty per game, remembered in the browser
    const [levels, setLevels] = useState(() => Object.fromEntries(GAMES.map((g) => [g.id, readLevel(g.id)])));

    if (!location.state?.fromTicker) return <Navigate to="/" replace />;

    const line = lineOfDay();
    const game = GAMES.find((g) => g.id === gameId);
    const Game = game.Component;
    const level = levels[gameId];

    const changeLevel = (next) => {
        storeLevel(gameId, next);
        setLevels((l) => ({ ...l, [gameId]: next }));
    };

    return (
        <div className={styles.page}>
            <header className={styles.hero}>
                <span className={styles.secret}>{t('funSecret')}</span>
                <h1 className={styles.title}>{t('funTitle')}</h1>
                <p className={styles.intro}>{t('funIntro')}</p>
                <figure className={styles.lineCard}>
                    <figcaption className={styles.lineLabel}>{t(`lineOf_${line.type}`)}</figcaption>
                    <blockquote className={styles.lineText}>{line[language] ?? line.en}</blockquote>
                </figure>
            </header>

            <div className={styles.picker} role="tablist" aria-label={t('funTitle')}>
                {GAMES.map((g) => (
                    <button
                        key={g.id}
                        type="button"
                        role="tab"
                        aria-selected={g.id === gameId}
                        className={`${styles.pick} ${g.id === gameId ? styles.pickActive : ''}`}
                        onClick={() => setGameId(g.id)}
                    >
                        <span className={styles.pickGlyph} aria-hidden="true">{g.glyph}</span>
                        <span className={styles.pickTitle}>{t(g.title)}</span>
                        <span className={styles.pickDesc}>{t(g.desc)}</span>
                    </button>
                ))}
            </div>

            <section className={styles.stage} role="tabpanel" aria-label={t(game.title)}>
                <div className={styles.levelBar}>
                    <span className={styles.levelLabel}>{t('funLevel')}</span>
                    <div className={styles.segmented} role="group" aria-label={t('funLevel')}>
                        {LEVELS.map((l) => (
                            <button
                                key={l}
                                type="button"
                                aria-pressed={l === level}
                                className={l === level ? styles.segmentActive : undefined}
                                onClick={() => changeLevel(l)}
                            >
                                {t(`level_${l}`)}
                            </button>
                        ))}
                    </div>
                </div>
                <p className={styles.levelHint}>{t(`levelHint_${gameId}_${level}`)}</p>
                {/* a new language or difficulty starts a fresh game */}
                <Game key={`${gameId}-${language}-${level}`} level={level} />
            </section>

            <Link to="/" className={styles.backLink}>{t('funBack')}</Link>
        </div>
    );
}
