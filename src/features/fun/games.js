// Logic of the fun page games, kept free of React so it can be tested on its own.
// Everything random takes an rng (() => number in [0, 1)) so tests can pass a seeded one.

// Small seeded generator (mulberry32)
export function makeRng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export const randomInt = (min, max, rng = Math.random) => min + Math.floor(rng() * (max - min + 1));
export const pick = (list, rng = Math.random) => list[Math.floor(rng() * list.length)];

export function shuffle(list, rng = Math.random) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

// ---------- difficulty ----------

export const LEVELS = ['easy', 'normal', 'hard'];

// The chosen difficulty of a game, remembered in the browser
export function readLevel(game) {
    try {
        const stored = localStorage.getItem(`funLevel:${game}`);
        return LEVELS.includes(stored) ? stored : 'normal';
    } catch {
        return 'normal';
    }
}

export function storeLevel(game, level) {
    try { localStorage.setItem(`funLevel:${game}`, level); } catch { /* only for this visit */ }
}

// ---------- word guess ----------

// easy: short word and an extra try; hard: a longer word
export const GUESS_LEVELS = {
    easy: { length: 4, tries: 7 },
    normal: { length: 5, tries: 6 },
    hard: { length: 6, tries: 6 },
};

// 'correct' = right letter, right spot; 'present' = in the word, elsewhere; 'absent' = not (again) in the word.
// Repeated letters only count as often as they appear: guessing EERIE for STEEL marks two Es, not three.
export function scoreGuess(guess, answer) {
    const result = Array(guess.length).fill('absent');
    const left = {};
    for (let i = 0; i < answer.length; i++) {
        if (guess[i] === answer[i]) result[i] = 'correct';
        else left[answer[i]] = (left[answer[i]] ?? 0) + 1;
    }
    for (let i = 0; i < guess.length; i++) {
        if (result[i] === 'correct') continue;
        if (left[guess[i]] > 0) {
            result[i] = 'present';
            left[guess[i]]--;
        }
    }
    return result;
}

const RANK = { absent: 0, present: 1, correct: 2 };

// Colors for the on-screen keyboard: each letter keeps the best result it has had so far
export function keyStates(guesses, answer) {
    const states = {};
    for (const guess of guesses) {
        scoreGuess(guess, answer).forEach((state, i) => {
            const letter = guess[i];
            if (!(letter in states) || RANK[state] > RANK[states[letter]]) states[letter] = state;
        });
    }
    return states;
}

// ---------- letter scramble ----------

// Word length range, whether the category is shown, and how many letters are given away for free
export const SCRAMBLE_LEVELS = {
    easy: { min: 3, max: 6, category: true, given: 1 },
    normal: { min: 6, max: 8, category: true, given: 0 },
    hard: { min: 8, max: 20, category: false, given: 0 },
};

export const scrambleWordsFor = (list, level) => {
    const { min, max } = SCRAMBLE_LEVELS[level];
    return list.filter(([word]) => word.length >= min && word.length <= max);
};

// The letters of the word in a new order, never the word itself (unless all letters are the same)
export function scramble(word, rng = Math.random) {
    if (new Set(word).size < 2) return word;
    let mixed = word;
    while (mixed === word) mixed = shuffle([...word], rng).join('');
    return mixed;
}

// ---------- number sequences ----------

const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53];

// Each kind builds six terms; five are shown and the sixth is the answer.
// rule is a translation key plus the values for its {placeholders}.
// level: the easiest difficulty the kind shows up in (normal also has the easy kinds, hard has all).
const SEQUENCE_KINDS = [
    { level: 'easy', make: (rng) => {
        const a = randomInt(1, 30, rng), d = randomInt(2, 15, rng);
        return { terms: Array.from({ length: 6 }, (_, i) => a + i * d), rule: ['seqAdd', { d }] };
    } },
    { level: 'easy', make: (rng) => {
        const d = randomInt(3, 12, rng), a = randomInt(6 * d, 6 * d + 40, rng);
        return { terms: Array.from({ length: 6 }, (_, i) => a - i * d), rule: ['seqSub', { d }] };
    } },
    { level: 'easy', make: (rng) => {
        const a = randomInt(1, 5, rng), r = pick([2, 3], rng);
        return { terms: Array.from({ length: 6 }, (_, i) => a * r ** i), rule: ['seqMul', { r }] };
    } },
    { level: 'easy', make: (rng) => {
        const n = randomInt(1, 8, rng);
        return { terms: Array.from({ length: 6 }, (_, i) => (n + i) ** 2), rule: ['seqSquares', {}] };
    } },
    { level: 'normal', make: (rng) => {
        const a = randomInt(1, 10, rng), d = randomInt(1, 4, rng), inc = pick([1, 2], rng);
        const terms = [a];
        for (let i = 0; i < 5; i++) terms.push(terms[i] + d + i * inc);
        return { terms, rule: ['seqGrow', { d, inc }] };
    } },
    { level: 'normal', make: (rng) => {
        const terms = [randomInt(1, 5, rng), randomInt(1, 5, rng)];
        while (terms.length < 6) terms.push(terms.at(-1) + terms.at(-2));
        return { terms, rule: ['seqFib', {}] };
    } },
    { level: 'normal', make: (rng) => {
        const a = randomInt(2, 6, rng);
        const terms = [randomInt(1, 6, rng)];
        for (let i = 0; i < 5; i++) terms.push(i % 2 === 0 ? terms[i] + a : terms[i] * 2);
        return { terms, rule: ['seqAlt', { a }] };
    } },
    { level: 'normal', make: (rng) => {
        const c = randomInt(1, 3, rng);
        const terms = [randomInt(1, 4, rng)];
        for (let i = 0; i < 5; i++) terms.push(terms[i] * 2 + c);
        return { terms, rule: ['seqDouble', { c }] };
    } },
    { level: 'normal', make: (rng) => {
        const start = randomInt(0, PRIMES.length - 6, rng);
        return { terms: PRIMES.slice(start, start + 6), rule: ['seqPrimes', {}] };
    } },
    { level: 'hard', make: (rng) => {
        const n = randomInt(1, 4, rng);
        return { terms: Array.from({ length: 6 }, (_, i) => (n + i) ** 3), rule: ['seqCubes', {}] };
    } },
    { level: 'hard', make: (rng) => {
        // the gap doubles every time: +d, +2d, +4d, ...
        const a = randomInt(1, 20, rng), d = randomInt(1, 4, rng);
        const terms = [a];
        for (let i = 0; i < 5; i++) terms.push(terms[i] + d * 2 ** i);
        return { terms, rule: ['seqGapDouble', { d }] };
    } },
    { level: 'hard', make: (rng) => {
        // n² + n: 2, 6, 12, 20, ... (the gap grows by 2)
        const n = randomInt(1, 6, rng);
        return { terms: Array.from({ length: 6 }, (_, i) => (n + i) * (n + i + 1)), rule: ['seqPronic', {}] };
    } },
];

export const SEQUENCE_KIND_COUNT = SEQUENCE_KINDS.length;

// The kinds a difficulty can draw from
export const sequenceKindsFor = (level) => {
    const upTo = LEVELS.indexOf(level);
    return SEQUENCE_KINDS.map((k, i) => (LEVELS.indexOf(k.level) <= upTo ? i : -1)).filter((i) => i >= 0);
};

// On hard the answer is typed in instead of picked from four choices
export const sequenceIsTyped = (level) => level === 'hard';

// A puzzle: five numbers, the next one, four answer choices (one right) and the rule behind it.
// Without a kind, a random one that fits the difficulty.
export function makeSequence(rng = Math.random, kind, level = 'normal') {
    if (kind === undefined) kind = pick(sequenceKindsFor(level), rng);
    const { terms, rule } = SEQUENCE_KINDS[kind].make(rng);
    const shown = terms.slice(0, 5);
    const answer = terms[5];
    const step = shown[4] - shown[3];
    // wrong answers that look plausible: off by a little, or the right idea with the wrong step
    const near = [answer + 1, answer - 1, answer + 2, answer - 2, shown[4] + step, answer + step, answer - step, answer + 10, answer - 10];
    const distractors = shuffle([...new Set(near)].filter((n) => n > 0 && n !== answer), rng).slice(0, 3);
    return { shown, answer, rule, choices: shuffle([answer, ...distractors], rng) };
}

// ---------- best scores, remembered in the browser ----------

// One best per game and difficulty, e.g. readBest('guess', 'hard')
const bestKey = (game, level) => `funBest:${game}:${level}`;

export function readBest(game, level = 'normal') {
    try { return Number(localStorage.getItem(bestKey(game, level))) || 0; } catch { return 0; }
}

// Saves the score if it beats the old best; returns the best after that
export function saveBest(game, level, score) {
    const best = readBest(game, level);
    if (score <= best) return best;
    try { localStorage.setItem(bestKey(game, level), String(score)); } catch { /* only for this visit */ }
    return score;
}
