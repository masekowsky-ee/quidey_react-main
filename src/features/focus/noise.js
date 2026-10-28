// Focus sounds for the Fokusraum, made with the Web Audio API like the app's other sounds (no
// files, nothing loaded from elsewhere): brown noise (deep, like a far-off waterfall), pink noise
// (softer than white) and rain (pink noise through a band filter with slow gusts).
// One at a time; started from a click (browsers allow sound only after one).

let context = null;
let playing = null; // { nodes, gain }

const NOISE_SECONDS = 4;

function noiseBuffer(ctx, kind) {
    const length = ctx.sampleRate * NOISE_SECONDS;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    if (kind === 'brown') {
        let last = 0;
        for (let i = 0; i < length; i++) {
            last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
            data[i] = last * 3.5;
        }
    } else {
        // pink: Paul Kellet's filter over white noise
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < length; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.969 * b2 + white * 0.153852;
            b3 = 0.8665 * b3 + white * 0.3104856;
            b4 = 0.55 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.016898;
            data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
            b6 = white * 0.115926;
        }
    }
    return buffer;
}

export function stopNoise() {
    if (!playing) return;
    const { nodes, gain } = playing;
    playing = null;
    try {
        gain.gain.setTargetAtTime(0, context.currentTime, 0.3);
        setTimeout(() => nodes.forEach(node => { try { node.stop?.(); node.disconnect(); } catch { /* gone */ } }), 1200);
    } catch { /* closed */ }
}

// kind: 'brown' | 'pink' | 'rain'; volume 0..1
export function playNoise(kind, volume = 0.5) {
    stopNoise();
    if (kind === 'off') return;
    const Ctx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!Ctx) return;
    context ??= new Ctx();
    context.resume?.();
    const source = context.createBufferSource();
    source.buffer = noiseBuffer(context, kind === 'brown' ? 'brown' : 'pink');
    source.loop = true;
    const gain = context.createGain();
    gain.gain.value = 0;
    const nodes = [source];
    let tail = source;
    if (kind === 'rain') {
        const band = context.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.value = 1800;
        band.Q.value = 0.4;
        // slow gusts: a very slow wave on the filter
        const lfo = context.createOscillator();
        const depth = context.createGain();
        lfo.frequency.value = 0.07;
        depth.gain.value = 700;
        lfo.connect(depth).connect(band.frequency);
        lfo.start();
        nodes.push(lfo, depth, band);
        tail.connect(band);
        tail = band;
    }
    tail.connect(gain).connect(context.destination);
    source.start();
    gain.gain.setTargetAtTime(volume * 0.6, context.currentTime, 0.4);
    playing = { nodes: [...nodes, gain], gain };
}

export function setNoiseVolume(volume) {
    if (!playing || !context) return;
    playing.gain.gain.setTargetAtTime(volume * 0.6, context.currentTime, 0.1);
}

export const noisePlaying = () => Boolean(playing);
