// The arcade (/arcade): small games for everybody signed in, also while waiting for beta access
// (the beta screen leads there, "Warteraum"; so does the daily line in the header). Three quiz games
// (components/fun/: word guess, scramble, sequence; score = the streak, per difficulty) and two arcade games
// (reflex: hit the lights until one is missed; pattern: play back a growing pattern). Each run counts in one
// of two modes, picked before playing and remembered (localStorage arcadeMode):
//   ranked  personal best and the leaderboard (display and user name seen by everybody)
//   casual  only my personal best
// API: POST /api/arcade/scores { game, level, score, ranked }, GET /api/arcade/me,
// GET /api/arcade/leaderboard?game=&level=, DELETE /api/arcade/ranked (off every board).

import { apiFetch } from '../helperFunction';

// max: the most the server takes (the same numbers as ARCADE_GAMES in the api)
export const ARCADE_GAMES = [
    { id: 'reflex', kind: 'arcade', levels: ['normal'], max: 10000 },
    { id: 'pattern', kind: 'arcade', levels: ['normal'], max: 200 },
    { id: 'guess', kind: 'quiz', levels: ['easy', 'normal', 'hard'], max: 500 },
    { id: 'scramble', kind: 'quiz', levels: ['easy', 'normal', 'hard'], max: 500 },
    { id: 'sequence', kind: 'quiz', levels: ['easy', 'normal', 'hard'], max: 500 },
];
export const gameById = (id) => ARCADE_GAMES.find(game => game.id === id) ?? ARCADE_GAMES[0];

export const MODES = ['ranked', 'casual'];
const MODE_KEY = 'arcadeMode';
export function readMode() {
    try { return MODES.includes(localStorage.getItem(MODE_KEY)) ? localStorage.getItem(MODE_KEY) : 'casual'; } catch { return 'casual'; }
}
export function storeMode(mode) {
    try { localStorage.setItem(MODE_KEY, mode); } catch { /* only for this visit */ }
}

export const submitScore = (game, level, score, ranked) =>
    apiFetch('/api/arcade/scores', { method: 'POST', body: JSON.stringify({ game, level, score, ranked }) });
export const fetchMyArcade = () => apiFetch('/api/arcade/me');
export const fetchLeaderboard = (game, level) =>
    apiFetch(`/api/arcade/leaderboard?game=${encodeURIComponent(game)}&level=${encodeURIComponent(level)}`);
export const leaveLeaderboards = () => apiFetch('/api/arcade/ranked', { method: 'DELETE' });

const bestKey = (game, level) => `${game}:${level}`;
// [{ game, level, best, rankedBest }] → Map 'game:level' → { best, rankedBest }
export const bestsByGame = (rows) => new Map((Array.isArray(rows) ? rows : []).map(row => [bestKey(row.game, row.level), row]));
export const bestOf = (bests, game, level) => bests.get(bestKey(game, level)) ?? { best: 0, rankedBest: null };

// Whether a score is worth sending: it beats what this mode already has on the server
// (a casual run only counts for the personal best, a ranked one for both)
export function worthSending(known, score, ranked) {
    if (score <= 0) return false;
    if (score > known.best) return true;
    return ranked && (known.rankedBest === null || known.rankedBest === undefined || score > known.rankedBest);
}

// ---------- reflex ----------
// A 4 × 4 field; a light shows on one tile at a time and goes out after a while. No time limit:
// a run goes on until a light goes out untouched or a dark tile is tapped. A hit: +1 (+1 more when
// hit in the first third of its time). Every 8 hits the lights get 5 % shorter, down to 420 ms.
export const REFLEX_TILES = 16;
export const reflexLifeMs = (hits) => Math.max(420, Math.round(1250 * 0.95 ** Math.floor(hits / 8)));
export const reflexPoints = (reactionMs, lifeMs) => (reactionMs <= lifeMs / 3 ? 2 : 1);
// the next lit tile: never the same one twice in a row
export function nextTile(previous, rng = Math.random) {
    const tile = Math.floor(rng() * (REFLEX_TILES - 1));
    return previous === null || previous === undefined || tile < previous ? tile : tile + 1;
}

// ---------- pattern ----------
// Four pads; the pattern grows by one pad each round, played back faster as it grows; one wrong pad ends it.
export const PATTERN_PADS = 4;
export const patternStepMs = (length) => Math.max(260, 620 - length * 22);
export const growPattern = (pattern, rng = Math.random) => [...pattern, Math.floor(rng() * PATTERN_PADS)];
