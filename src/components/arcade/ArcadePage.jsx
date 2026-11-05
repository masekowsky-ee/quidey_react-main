import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
    ARCADE_GAMES, gameById, MODES, readMode, storeMode, submitScore, fetchMyArcade, fetchLeaderboard, leaveLeaderboards,
    bestsByGame, bestOf, worthSending,
} from '../../features/arcade/arcade';
import { readLevel, storeLevel } from '../../features/fun/games';
import { fetchAccess } from '../../features/auth/authAction';
import { displayName, fill } from '../../features/helperFunction';
import { LANDING_URL } from '../../features/site';
import { useTranslation } from '../../i18n/useTranslation';
import WordGuess from '../fun/WordGuess';
import Scramble from '../fun/Scramble';
import Sequence from '../fun/Sequence';
import Reflex from './Reflex';
import Pattern from './Pattern';
import Icon from '../icons.jsx';
import { Bone } from '../skeleton/Skeleton.jsx';
import styles from './Arcade.module.css';

const COMPONENTS = { guess: WordGuess, scramble: Scramble, sequence: Sequence, reflex: Reflex, pattern: Pattern };
const GLYPHS = { reflex: '◎', pattern: '◆◇', guess: 'Aa', scramble: '?!', sequence: '1 2 ?' };
const ACCESS_CHECK_MS = 60 * 1000;

// The best of one game and difficulty: the top places, and mine (also when I'm further down)
function Leaderboard({ game, level, version, onLeave }) {
    const { t } = useTranslation();
    // the answer for this game and difficulty (one for another is not shown: skeleton until it comes)
    const [loaded, setLoaded] = useState({ key: null, board: null });
    const key = `${game}:${level}`;
    useEffect(() => {
        let gone = false;
        fetchLeaderboard(game, level)
            .then(data => { if (!gone) setLoaded({ key: `${game}:${level}`, board: { top: Array.isArray(data?.top) ? data.top : [], me: data?.me ?? null } }); })
            .catch(() => { if (!gone) setLoaded({ key: `${game}:${level}`, board: { top: [], me: null, failed: true } }); });
        return () => { gone = true; };
    }, [game, level, version]);
    const board = loaded.key === key ? loaded.board : null;

    const meInTop = board?.top.some(row => row.me);
    return (
        <section className={styles.board} aria-labelledby="arcade-board-title">
            <h2 id="arcade-board-title" className={styles.boardTitle}>
                <Icon name="star" size={16} /> {t('arcadeLeaderboard')}
            </h2>
            <p className={styles.boardFor}>
                {t(`arcadeGame_${game}`)}{gameById(game).levels.length > 1 && ` · ${t(`level_${level}`)}`}
            </p>
            {board === null
                ? <div className={styles.boardRows}>{[0, 1, 2, 3].map(i => <Bone key={i} h="2.2rem" />)}</div>
                : board.top.length === 0
                    ? <p className={styles.muted}>{t(board.failed ? 'arcadeBoardFailed' : 'arcadeBoardEmpty')}</p>
                    : <ol className={styles.boardRows}>
                        {board.top.map(row =>
                            <li key={row.user.id} className={styles.boardRow} data-me={row.me || undefined} data-rank={row.rank <= 3 ? row.rank : undefined}>
                                <span className={styles.rank}>{row.rank}</span>
                                <span className={styles.who}>
                                    <span className={styles.whoName}>{displayName(row.user)}</span>
                                    <span className={styles.whoUser}>@{row.user.username}</span>
                                </span>
                                <span className={styles.points}>{row.score}</span>
                            </li>)}
                        {board.me && !meInTop &&
                            <li className={styles.boardRow} data-me="" data-gap="">
                                <span className={styles.rank}>{board.me.rank}</span>
                                <span className={styles.who}><span className={styles.whoName}>{t('arcadeYou')}</span></span>
                                <span className={styles.points}>{board.me.score}</span>
                            </li>}
                    </ol>}
            {board?.me && <button type="button" className={styles.leaveBtn} onClick={onLeave}>{t('arcadeLeave')}</button>}
        </section>
    );
}

// The arcade (/arcade): pick a game, pick how it counts (leaderboard or only for me), play, see
// the leaderboard beside it. waiting: shown from the beta screen to somebody still waiting for
// access ("Warteraum"): access is checked now and then, so they move on into the app by themselves.
export default function ArcadePage({ waiting = false }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const username = useSelector(state => state.auth.user?.username);
    const [gameId, setGameId] = useState('reflex');
    const [levels, setLevels] = useState(() => Object.fromEntries(ARCADE_GAMES.map(g => [g.id, g.levels.length > 1 ? readLevel(g.id) : 'normal'])));
    const [mode, setMode] = useState(readMode);
    const [bests, setBests] = useState(() => new Map());
    const [boardVersion, setBoardVersion] = useState(0);
    const [news, setNews] = useState(null);
    const sending = useRef(new Set());

    const game = gameById(gameId);
    const level = levels[gameId];
    const ranked = mode === 'ranked';
    const known = bestOf(bests, gameId, level);
    const Game = COMPONENTS[gameId];

    useEffect(() => { fetchMyArcade().then(rows => setBests(bestsByGame(rows))).catch(() => {}); }, []);

    // still waiting: is access there yet? (the app then opens by itself, the arcade stays open)
    useEffect(() => {
        if (!waiting) return undefined;
        const timer = setInterval(() => dispatch(fetchAccess()).catch(() => {}), ACCESS_CHECK_MS);
        return () => clearInterval(timer);
    }, [waiting, dispatch]);

    const pickMode = (next) => { setMode(next); storeMode(next); };
    const pickLevel = (next) => { storeLevel(gameId, next); setLevels(prev => ({ ...prev, [gameId]: next })); };

    // a run's score (the quiz games: every right answer, with the streak so far)
    const onScore = useCallback(async (score) => {
        const forGame = gameId;
        const forLevel = levels[forGame];
        const sendKey = `${forGame}:${forLevel}:${score}:${ranked}`;
        if (!worthSending(bestOf(bests, forGame, forLevel), score, ranked) || sending.current.has(sendKey)) return;
        sending.current.add(sendKey);
        try {
            const saved = await submitScore(forGame, forLevel, Math.min(score, gameById(forGame).max), ranked);
            const before = bestOf(bests, forGame, forLevel);
            setBests(prev => new Map(prev).set(`${forGame}:${forLevel}`, { game: forGame, level: forLevel, best: saved.best, rankedBest: saved.rankedBest }));
            if (ranked && saved.rank) setNews(fill(t('arcadeNewRank'), { rank: saved.rank }));
            else if (saved.best > before.best) setNews(fill(t('arcadeNewBest'), { n: saved.best }));
            if (ranked) setBoardVersion(v => v + 1);
        } catch {
            setNews(t('arcadeSendFailed'));
        } finally {
            sending.current.delete(sendKey);
        }
    }, [gameId, levels, ranked, bests, t]);

    const leave = async () => {
        try {
            await leaveLeaderboards();
            setBests(prev => new Map([...prev].map(([key, row]) => [key, { ...row, rankedBest: null }])));
            setBoardVersion(v => v + 1);
            pickMode('casual');
            setNews(t('arcadeLeft'));
        } catch {
            setNews(t('arcadeSendFailed'));
        }
    };

    return (
        <div className={styles.page} data-waiting={waiting || undefined}>
            <header className={styles.hero}>
                <span className={styles.kicker}>{t(waiting ? 'arcadeWaitingKicker' : 'arcadeKicker')}</span>
                <h1 className={styles.title}>{t('arcade')}</h1>
                <p className={styles.intro}>{t(waiting ? 'arcadeWaitingIntro' : 'arcadeIntro')}</p>
                {waiting &&
                    <div className={styles.waitingLinks}>
                        <Link to="/beta" className={styles.ghostLink}><Icon name="release" size={15} /> {t('arcadeBackToBeta')}</Link>
                        <a href={LANDING_URL} className={styles.ghostLink}>{t('betaToLanding')}</a>
                        {username && <span className={styles.muted}>@{username}</span>}
                    </div>}
            </header>

            <div className={styles.modeBar}>
                <div className={styles.segmented} role="radiogroup" aria-label={t('arcadeMode')}>
                    {MODES.map(item =>
                        <button key={item} type="button" role="radio" aria-checked={mode === item} onClick={() => pickMode(item)}>
                            <Icon name={item === 'ranked' ? 'star' : 'eyeOff'} size={15} /> {t(`arcadeMode_${item}`)}
                        </button>)}
                </div>
                <p className={styles.modeHint}>{t(`arcadeModeHint_${mode}`)}</p>
            </div>

            <div className={styles.picker} role="tablist" aria-label={t('arcadeGames')}>
                {ARCADE_GAMES.map(item => {
                    const mine = bestOf(bests, item.id, levels[item.id]);
                    return (
                        <button key={item.id} type="button" role="tab" aria-selected={item.id === gameId} className={styles.pick}
                            onClick={() => { setGameId(item.id); setNews(null); }}>
                            <span className={styles.pickGlyph} aria-hidden="true">{GLYPHS[item.id]}</span>
                            <span className={styles.pickTitle}>{t(`arcadeGame_${item.id}`)}</span>
                            <span className={styles.pickDesc}>{t(`arcadeGameDesc_${item.id}`)}</span>
                            <span className={styles.pickBest}>{mine.best > 0 ? fill(t('arcadeBestShort'), { n: mine.best }) : t('arcadeNotPlayed')}</span>
                        </button>
                    );
                })}
            </div>

            <div className={styles.layout}>
                <section className={styles.stage} role="tabpanel" aria-label={t(`arcadeGame_${gameId}`)}>
                    <div className={styles.stageHead}>
                        <dl className={styles.myBests}>
                            <div><dt>{t('arcadePersonalBest')}</dt><dd>{known.best}</dd></div>
                            <div><dt>{t('arcadeRankedBest')}</dt><dd>{known.rankedBest ?? '–'}</dd></div>
                        </dl>
                        {game.levels.length > 1 &&
                            <div className={styles.segmentedSmall} role="group" aria-label={t('funLevel')}>
                                {game.levels.map(item =>
                                    <button key={item} type="button" aria-pressed={item === level} onClick={() => pickLevel(item)}>{t(`level_${item}`)}</button>)}
                            </div>}
                    </div>
                    {game.kind === 'quiz' && <p className={styles.muted}>{t('arcadeQuizScore')}</p>}
                    <p className={styles.news} role="status">{news}</p>
                    {/* a new game, difficulty or mode starts a fresh run */}
                    <Game key={`${gameId}-${level}-${mode}`} level={level} onScore={onScore} onFinish={onScore} />
                </section>
                <Leaderboard game={gameId} level={level} version={boardVersion} onLeave={leave} />
            </div>
        </div>
    );
}
