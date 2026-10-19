import { AbsoluteFill, interpolate, spring, random, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { LogoMark, COLOR } from './LogoIntro';

// The "extreme" opening: the logo spins in out of nothing, the check slams into place with a
// flash, a shock wave, a burst of sparks and a shaking screen, then the letters of the name
// rain down one by one, an accent line sweeps under them and the camera pushes through.
export const EXTREME_FRAMES = 216;

const LETTERS = 'Quidey'.split('');
const SPARKS = 28;
const IMPACT = 50; // frame where the check lands
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };
// half of the name's width plus the gap: how far the mark sits right of its final place at first
const WORD_SHIFT = 150;

export default function ExtremeIntro() {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const ease = Easing.bezier(0.32, 0.72, 0, 1);

    // logo: spins and grows in with an overshoot, ring and check draw themselves
    const spin = spring({ frame, fps, config: { damping: 11, stiffness: 70 } });
    const ring = interpolate(frame, [4, 38], [0, 1], { ...clamp, easing: ease });
    const check = interpolate(frame, [36, IMPACT], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
    // the impact squashes the mark and lets it bounce back
    const punch = spring({ frame: frame - IMPACT, fps, config: { damping: 7, stiffness: 260 } });
    const squash = frame < IMPACT ? 1 : 1.25 - 0.25 * punch;

    // screen shake right after the impact, dying out
    const shakeLeft = interpolate(frame, [IMPACT, IMPACT + 22], [1, 0], clamp);
    const shakeX = Math.sin(frame * 2.7) * 14 * shakeLeft;
    const shakeY = Math.cos(frame * 3.3) * 10 * shakeLeft;

    const flash = interpolate(frame, [IMPACT, IMPACT + 3, IMPACT + 14], [0, 0.55, 0], clamp);
    const glow = interpolate(frame, [0, IMPACT, IMPACT + 30, 170], [0, 0.35, 0.8, 0.45], clamp);

    // the mark moves aside to make room for the name
    const slide = spring({ frame: frame - 72, fps, config: { damping: 14, stiffness: 90 } });

    // the accent line under the name
    const line = interpolate(frame, [128, 150], [0, 1], { ...clamp, easing: ease });

    // the camera pushes through at the end
    const push = interpolate(frame, [184, EXTREME_FRAMES], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });

    return (
        <AbsoluteFill style={{ overflow: 'hidden', opacity: 1 - push }}>
            {/* accent glow breathing behind everything */}
            <AbsoluteFill style={{
                // closest-side: fully faded before the edges of the 16:9 frame
                background: `radial-gradient(circle closest-side, color-mix(in srgb, ${COLOR} ${Math.round(glow * 45)}%, transparent) 0%, transparent 100%)`,
                transform: `scale(${1 + Math.sin(frame / 9) * 0.04 + push})`,
            }} />

            <AbsoluteFill style={{
                alignItems: 'center',
                justifyContent: 'center',
                transform: `translate(${shakeX}px, ${shakeY}px) scale(${1 + push * 1.8})`,
                filter: `blur(${push * 12}px)`,
            }}>
                {/* shock waves from the impact */}
                {[0, 9].map((delay) => {
                    const t = interpolate(frame, [IMPACT + delay, IMPACT + delay + 45], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
                    return (
                        <div key={delay} style={{
                            position: 'absolute',
                            width: 40 + t * 620,
                            height: 40 + t * 620,
                            borderRadius: '50%',
                            // the app draws squircles everywhere; waves stay round
                            cornerShape: 'round',
                            border: `${Math.max(0.5, 6 * (1 - t))}px solid ${COLOR}`,
                            opacity: t > 0 && t < 1 ? 1 - t : 0,
                        }} />
                    );
                })}

                {/* sparks flying out and falling */}
                {Array.from({ length: SPARKS }, (_, i) => {
                    const t = interpolate(frame, [IMPACT, IMPACT + 70], [0, 1], clamp);
                    if (t <= 0 || t >= 1) return null;
                    const angle = (i / SPARKS) * Math.PI * 2 + random(`a${i}`) * 0.4;
                    const speed = 180 + random(`s${i}`) * 260;
                    const travel = Easing.out(Easing.cubic)(t);
                    const x = Math.cos(angle) * speed * travel;
                    const y = Math.sin(angle) * speed * travel + t * t * 160;
                    const size = 4 + random(`z${i}`) * 8;
                    return (
                        <div key={i} style={{
                            position: 'absolute',
                            width: size,
                            height: size,
                            borderRadius: i % 3 === 0 ? 2 : '50%',
                            background: i % 4 === 0 ? 'var(--text-h)' : COLOR,
                            transform: `translate(${x}px, ${y}px) rotate(${t * 720 * (i % 2 ? 1 : -1)}deg)`,
                            opacity: 1 - t,
                        }} />
                    );
                })}

                <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <LogoMark id="intro-cut-extreme" ring={ring} check={check} size={140} style={{
                        transform: `translateX(${(1 - slide) * WORD_SHIFT}px) rotate(${(1 - spin) * -320}deg) scale(${spin * squash}, ${spin * (2 - squash)})`,
                        filter: `drop-shadow(0 0 ${glow * 24}px ${COLOR})`,
                    }} />
                    <div style={{ position: 'relative', display: 'flex' }}>
                        {LETTERS.map((letter, i) => {
                            const drop = spring({ frame: frame - 82 - i * 7, fps, config: { damping: 9, stiffness: 120 } });
                            return (
                                <span key={i} style={{
                                    display: 'inline-block',
                                    font: '800 76px/1 var(--sans)',
                                    letterSpacing: '-0.03em',
                                    color: 'var(--text-h)',
                                    opacity: drop > 0.01 ? 1 : 0,
                                    transform: `translateY(${(1 - drop) * -260}px) rotate(${(1 - drop) * (i % 2 ? 40 : -40)}deg) scale(${1 + (1 - drop) * 1.2})`,
                                }}>
                                    {letter}
                                </span>
                            );
                        })}
                        <div style={{
                            position: 'absolute',
                            left: 0,
                            bottom: -14,
                            height: 6,
                            width: `${line * 100}%`,
                            borderRadius: 3,
                            background: COLOR,
                            boxShadow: `0 0 18px ${COLOR}`,
                        }} />
                    </div>
                </div>
            </AbsoluteFill>

            <AbsoluteFill style={{ background: '#fff', opacity: flash, pointerEvents: 'none' }} />
        </AbsoluteFill>
    );
}
