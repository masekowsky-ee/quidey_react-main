import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';

// The opening animation as a Remotion composition: the ring of the Q draws itself,
// the check swings in as its tail, then the name fades up beside it.
// Same drawing as Logo.jsx; the colors come from the page's CSS variables.
const COLOR = 'var(--primary, #fb923c)';
// length of the check path M27 32 l9 12 L54 24 (15 + ~26.9), rounded up
const CHECK_LENGTH = 42;
const RING_LENGTH = 2 * Math.PI * 12;

export const INTRO_FPS = 60;
export const INTRO_FRAMES = 96;

export default function LogoIntro() {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const ease = Easing.bezier(0.32, 0.72, 0, 1);

    const ring = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp', easing: ease });
    const check = interpolate(frame, [18, 44], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });
    const settle = spring({ frame: frame - 34, fps, config: { damping: 14, stiffness: 140 } });
    const word = interpolate(frame, [38, 62], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });
    // everything lifts away softly at the end
    const out = interpolate(frame, [80, INTRO_FRAMES], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

    return (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: out }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, transform: `translateY(${(1 - out) * -8}px)` }}>
                <svg viewBox="9 5 50 50" width="104" height="104" style={{ transform: `scale(${0.92 + settle * 0.08})` }}>
                    <defs>
                        <mask id="intro-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
                            <rect width="64" height="64" fill="#fff" />
                            <path d="M27 32l9 12" stroke="#000" strokeWidth="10.5" strokeLinecap="round" />
                        </mask>
                    </defs>
                    {/* starts at the top and runs clockwise; the mask sits on the group so it doesn't turn with the ring */}
                    <g mask="url(#intro-cut)">
                        <circle cx="25" cy="27" r="12" fill="none" style={{ stroke: COLOR }} strokeWidth="6"
                            strokeDasharray={RING_LENGTH} strokeDashoffset={RING_LENGTH * (1 - ring)}
                            transform="rotate(-90 25 27)" strokeLinecap={ring < 1 ? 'round' : 'butt'} />
                    </g>
                    <path d="M27 32l9 12L54 24" fill="none" style={{ stroke: COLOR }} strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round"
                        strokeDasharray={CHECK_LENGTH} strokeDashoffset={CHECK_LENGTH * (1 - check)} opacity={check > 0 ? 1 : 0} />
                </svg>
                <span style={{
                    font: '700 52px/1 var(--sans)',
                    letterSpacing: '-0.03em',
                    color: 'var(--text-h)',
                    opacity: word,
                    transform: `translateX(${(1 - word) * -12}px)`,
                    clipPath: `inset(0 ${(1 - word) * 100}% 0 0)`,
                }}>
                    Quidey
                </span>
            </div>
        </AbsoluteFill>
    );
}
