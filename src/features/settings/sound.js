// Quidey's sounds, made on the spot with the Web Audio API (no sound files). They all share one
// voice so they are recognisable together: a soft sine bell with a quiet octave and a short glassy
// tine, a little echo of "air" behind it, notes of A major pentatonic, and the signature motif
// "Qui-dey", a step up a fourth onto the A (E → A), which most of them carry in some form.
// Three levels, 'off' | 'soft' | 'full', remembered in localStorage like the motion level.
export const SOUND_LEVELS = ['off', 'soft', 'full'];
const STORAGE_KEY = 'sound';
const VOLUME = { off: 0, soft: 0.45, full: 0.9 };

export function readStoredSound() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (SOUND_LEVELS.includes(stored)) return stored;
    } catch { /* storage blocked: the default */ }
    return 'soft';
}

let level = readStoredSound();

export function storeSound(next) {
    level = next;
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* still applied, just not remembered */ }
}

let ctx = null;
let master = null;
let air = null;
let noise = null;

// Made on first use; browsers only let it play after a click or key press on the page
function audio() {
    if (ctx) return ctx;
    const AudioContext = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AudioContext) return null;
    ctx = new AudioContext();
    master = ctx.createGain();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 6;
    master.connect(limiter).connect(ctx.destination);
    // the air: a short, darkened echo every sound is sent into a little
    air = ctx.createGain();
    air.gain.value = 0.22;
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.11;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.3;
    const dark = ctx.createBiquadFilter();
    dark.type = 'lowpass';
    dark.frequency.value = 3200;
    air.connect(delay).connect(dark).connect(feedback).connect(delay);
    dark.connect(master);
    return ctx;
}

// half steps from A4 (0 = A4, 7 = E5, 12 = A5, 19 = E6, 24 = A6)
const hz = (step) => 440 * 2 ** (step / 12);

// a gain that rises in a few milliseconds and dies away, feeding the master and the air
function envelope(t, len, peak, attack = 0.004) {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
    gain.connect(master);
    gain.connect(air);
    return gain;
}

function osc(type, freq, t, len, into) {
    const node = ctx.createOscillator();
    node.type = type;
    node.frequency.setValueAtTime(freq, t);
    node.connect(into);
    node.start(t);
    node.stop(t + len + 0.05);
    return node;
}

// one struck note in Quidey's voice
function bell(t, step, len = 0.5, gain = 0.4) {
    const f = hz(step);
    osc('sine', f, t, len, envelope(t, len, gain));
    osc('sine', f * 2, t, len * 0.6, envelope(t, len * 0.6, gain * 0.2));
    osc('sine', f * 5.04, t, 0.09, envelope(t, 0.09, gain * 0.1, 0.002));
}

// a soft, muffled knock
function knock(t, step, len = 0.25, gain = 0.45) {
    const muffle = ctx.createBiquadFilter();
    muffle.type = 'lowpass';
    muffle.frequency.value = 900;
    muffle.connect(envelope(t, len, gain, 0.006));
    osc('triangle', hz(step), t, len, muffle);
}

// air rushing past: noise through a band that sweeps from one pitch to another
function whoosh(t, len, from, to, gain = 0.15) {
    if (!noise) {
        noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 1.2;
    band.frequency.setValueAtTime(from, t);
    band.frequency.exponentialRampToValueAtTime(to, t + len);
    source.connect(band).connect(envelope(t, len, gain, len * 0.6));
    source.start(t);
    source.stop(t + len + 0.05);
}

const SOUNDS = {
    // a task ticked off: the motif, quick as a tick
    done: (t) => { bell(t, 7, 0.25, 0.35); bell(t + 0.07, 12, 0.5, 0.45); },
    // ticked off taken back: the motif backwards, quieter
    undo: (t) => { bell(t, 12, 0.18, 0.25); bell(t + 0.08, 7, 0.35, 0.3); },
    // focus begins: a breath in, then the motif an octave lower, calm
    focusStart: (t) => { whoosh(t, 0.35, 300, 1800, 0.1); bell(t + 0.22, -5, 0.4, 0.35); bell(t + 0.3, 0, 0.9, 0.45); },
    // paused or stopped: one muffled low A
    pause: (t) => { knock(t, 0, 0.3, 0.75); },
    // the countdown ran out: the motif grows into the whole chord and rings
    focusEnd: (t) => {
        bell(t, 7, 0.4, 0.35); bell(t + 0.12, 12, 0.5, 0.38); bell(t + 0.24, 16, 0.6, 0.35);
        bell(t + 0.4, 24, 1.5, 0.42); bell(t + 0.4, 19, 1.2, 0.2);
    },
    // a challenge done: the motif and one step further, open towards the next one
    challenge: (t) => { bell(t, 7, 0.2, 0.3); bell(t + 0.06, 12, 0.25, 0.35); bell(t + 0.13, 14, 0.6, 0.4); },
    // the streak goes on: a flame catches, then the motif on the way up
    streak: (t) => { whoosh(t, 0.4, 200, 2500, 0.16); bell(t + 0.25, 7, 0.3, 0.35); bell(t + 0.32, 12, 0.5, 0.42); bell(t + 0.42, 16, 0.8, 0.3); },
    // a streak milestone (3, 7, 14, … days): the streak, crowned with the high A
    milestone: (t) => { SOUNDS.streak(t); bell(t + 0.55, 24, 1.3, 0.38); bell(t + 0.55, 19, 1.1, 0.18); },
    // a new level: a fast run up the scale into a ringing chord with a sparkle
    levelUp: (t) => {
        [0, 4, 7, 12, 16, 19].forEach((step, i) => bell(t + i * 0.055, step, 0.3, 0.28));
        bell(t + 0.36, 24, 1.6, 0.42); bell(t + 0.36, 19, 1.4, 0.22); bell(t + 0.36, 12, 1.4, 0.22);
        whoosh(t + 0.3, 0.5, 2000, 8000, 0.05);
    },
    // a message from a friend: a short "bling", the motif squeezed into a grace note onto a high A
    message: (t) => { bell(t, 19, 0.08, 0.18); bell(t + 0.03, 24, 0.45, 0.38); bell(t + 0.03, 36, 0.2, 0.08); },
    // a notice: the motif an octave up, light as glass
    notify: (t) => { bell(t, 19, 0.3, 0.25); bell(t + 0.12, 24, 0.6, 0.3); },
    // a task's reminder: ding, ding, and up
    reminder: (t) => { bell(t, 12, 0.35, 0.35); bell(t + 0.18, 12, 0.35, 0.35); bell(t + 0.36, 19, 0.8, 0.4); },
    // a friend cheered me on: a quick flame and a spark
    cheer: (t) => { whoosh(t, 0.25, 400, 3000, 0.12); bell(t + 0.12, 16, 0.25, 0.3); bell(t + 0.18, 19, 0.5, 0.3); },
    // something went wrong: a low "uh-oh"
    error: (t) => { knock(t, -9, 0.18, 0.45); knock(t + 0.13, -12, 0.3, 0.45); },
};

export const SOUND_NAMES = Object.keys(SOUNDS);

const lastPlayed = {};

// Plays one of SOUND_NAMES at the chosen level. Nothing while sounds are off, the page is in the
// background (a push says it then) or the same sound just played (a double click). Before the first
// click on the page the browser keeps it silent; a sound asked for then is dropped, not saved up.
export function playSound(name) {
    const sound = SOUNDS[name];
    if (!sound || level === 'off' || typeof document === 'undefined' || document.hidden) return;
    const asked = Date.now();
    if (asked - (lastPlayed[name] ?? 0) < 120) return;
    lastPlayed[name] = asked;
    if (!audio()) return;
    const run = () => {
        master.gain.value = VOLUME[level];
        sound(ctx.currentTime + 0.02);
    };
    if (ctx.state === 'running') run();
    else ctx.resume().then(() => { if (Date.now() - asked < 400) run(); }).catch(() => {});
}

// The first click or key press unlocks the audio, so sounds that come in later (a message) can play
if (typeof window !== 'undefined') {
    const unlock = () => {
        if (level === 'off') return;
        audio()?.resume().catch(() => {});
        window.removeEventListener('pointerdown', unlock, true);
        window.removeEventListener('keydown', unlock, true);
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
}
