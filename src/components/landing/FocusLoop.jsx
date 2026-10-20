import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { LogoMark } from '../intro/LogoIntro';

// The word in the headline: a focus session, fast-forwarded. The timer runs from 25:00 to 0,
// its progress ring is the ring of the Q, and when the time is up the check draws in as the
// Q's tail: the Quidey logo. Then it starts again.
export const LOOP_FPS = 30;
export const LOOP_FRAMES = 240;
export const LOOP_WIDTH = 300;
export const LOOP_HEIGHT = 110;

const RUN_END = 150;      // the timer reaches 0
const CHECK_END = 172;    // the check is drawn
const FADE_START = 222;   // fades back to the start

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };

export default function FocusLoop({ doneLabel = 'Done' }) {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const progress = interpolate(frame, [6, RUN_END], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
    const check = interpolate(frame, [RUN_END, CHECK_END], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
    const pop = spring({ frame: frame - RUN_END, fps, config: { damping: 9, stiffness: 180 } });
    const fade = interpolate(frame, [FADE_START, LOOP_FRAMES], [1, 0], clamp);

    const seconds = Math.round((1 - progress) * 25 * 60);
    const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    const finished = frame >= RUN_END;

    return (
        <AbsoluteFill style={{
            background: 'var(--landing-slot, #211f1e)',
            borderRadius: 22,
            alignItems: 'center',
            flexDirection: 'row',
            padding: '0 26px 0 18px',
            gap: 14,
            opacity: fade,
        }}>
            <span style={{ position: 'relative', width: 84, height: 84, flexShrink: 0 }}>
                {/* the empty ring the timer fills, so the arc reads as time left, not as a spinner */}
                <svg viewBox="9 5 50 50" width="84" height="84" style={{ position: 'absolute', inset: 0, opacity: 1 - check }}>
                    <circle cx="25" cy="27" r="12" fill="none" stroke="#3a3633" strokeWidth="6" />
                </svg>
                <LogoMark id="landing-loop-cut" ring={progress} check={check} size={84}
                    style={{ position: 'absolute', inset: 0, transform: `scale(${finished ? 0.94 + pop * 0.06 : 0.94})` }} />
            </span>
            <span style={{
                font: '700 52px/1 var(--sans)',
                letterSpacing: '-0.03em',
                fontVariantNumeric: 'tabular-nums',
                color: finished ? 'var(--primary, #fb923c)' : 'var(--text-h, #f4f3f1)',
            }}>
                {finished ? doneLabel : time}
            </span>
        </AbsoluteFill>
    );
}
