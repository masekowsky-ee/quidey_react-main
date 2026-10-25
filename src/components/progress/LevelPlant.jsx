import styles from './LevelPlant.module.css';
import { TIERS, tierFor } from '../../features/progress/progress';

// The level as a plant that grows: a seed in a pot at level 1, a sprout, a sapling, a shrub,
// then a tree on its own little island, a grove, a forest and, from level 40, an old tree with
// golden fruit. Every level adds something (a leaf, a ring of crown, a blossom), and `share`
// (0..1, the way to the next level) lets the newest part grow in, so the plant changes with
// every bit of XP. Each part keeps its key from level to level, so it grows in place (CSS
// transitions) instead of popping up again; new parts grow in from their base.
// A drawing only: the level is said in words next to it (aria-hidden).

const BASE_Y = 112;     // the soil line
const CX = 60;
// The small plants in their pot are drawn larger (around the pot's foot, y 128), so a seed
// doesn't sit lost at the bottom of the frame; from the tree on the island fills it at 1
const ZOOM = [1.9, 1.75, 1.45, 1.22, 1, 1, 1, 1];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// A leaf with its base at (0, 0), pointing up, 17 units long at size 1
const LEAF = 'M0 0C5-4 6-11 0-17C-6-11-5-4 0 0Z';

// One part of the plant, drawn around its own (0, 0) and placed at (x, y), turned by `angle`
// and grown to `scale` (a number, or [width, height] for stems and trunks). The placement is a
// CSS transform, so a part moves and grows smoothly when the level changes; the inner group
// grows it in from nothing when it first appears.
function Part({ x = 0, y = 0, angle = 0, scale = 1, className, children }) {
    const [sx, sy] = Array.isArray(scale) ? scale : [scale, scale];
    return (
        <g className={`${styles.part} ${className ?? ''}`}
            style={{ transform: `translate(${x}px, ${y}px) rotate(${angle}deg) scale(${sx}, ${sy})` }}>
            <g className={styles.grow}>{children}</g>
        </g>
    );
}

// a circle of radius 10, grown to radius r
const Blob = ({ r, className, ...place }) => (
    <Part {...place} scale={r / 10}><circle r={10} className={className} /></Part>
);

// A stem of length 1 (drawn upwards from 0, 0), stretched to `height`; the line keeps its width
const Stem = ({ height, ...place }) => (
    <Part {...place} scale={[1, height]}><path d="M0 0C-0.06-0.35 0.06-0.7 0-1" className={styles.stem} /></Part>
);

const Leaf = ({ tone = 1, ...place }) => (
    <Part {...place}><path d={LEAF} className={styles[`leaf${tone}`]} /></Part>
);

// a round crown of overlapping circles, its middle at (x, y)
function Crown({ id, x, y, r, blossoms = 0, fruits = 0 }) {
    const lobes = [[0, 0, 1], [-0.62, 0.22, 0.72], [0.62, 0.22, 0.72], [-0.32, -0.42, 0.68], [0.34, -0.38, 0.66]];
    const spots = [[-0.45, -0.1], [0.4, -0.25], [0.05, 0.35], [-0.15, -0.55], [0.55, 0.2], [-0.6, 0.3], [0.2, -0.05], [-0.3, 0.15]];
    return (
        <g>
            {lobes.map(([dx, dy, k], i) => (
                <Blob key={`${id}-lobe${i}`} x={x + dx * r} y={y + dy * r} r={r * k}
                    className={styles[`leaf${i % 3 === 0 ? 2 : i % 3 === 1 ? 1 : 3}`]} />
            ))}
            {spots.slice(0, blossoms).map(([dx, dy], i) => (
                <Part key={`${id}-blossom${i}`} x={x + dx * r} y={y + dy * r}>
                    <circle r={2.2} className={styles.blossom} />
                </Part>
            ))}
            {spots.slice(0, fruits).map(([dx, dy], i) => (
                <Part key={`${id}-fruit${i}`} x={x - dx * r * 0.9} y={y + dy * r * 0.8}>
                    <circle r={2.6} className={styles.fruit} />
                </Part>
            ))}
        </g>
    );
}

// A tree: trunk from the ground at (x, BASE_Y) up `height`, crown of radius r on top
function Tree({ id, x, height, r, blossoms = 0, fruits = 0, roots = false }) {
    const top = BASE_Y - height;
    return (
        <g>
            {roots && (
                <Part key={`${id}-roots`} x={x} y={BASE_Y}>
                    <path d="M-3 0C-8 2-12 3-16 6M3 0C8 2 12 3 16 6M0 1C0 4-1 6-2 8" className={styles.root} />
                </Part>
            )}
            {/* a unit trunk (2 wide at the foot, 1 at the top), stretched to its width and height */}
            <Part key={`${id}-trunk`} x={x} y={BASE_Y} scale={[2 + height / 22, height]}>
                <path d="M-1 0L-0.55-1L0.55-1L1 0Z" className={styles.trunk} />
            </Part>
            <Part key={`${id}-branch`} x={x} y={BASE_Y - height * 0.55} angle={38} scale={[1, r * 0.45]}>
                <path d="M0 0L0-1" className={styles.branch} />
            </Part>
            <Crown id={id} x={x} y={top - r * 0.35} r={r} blossoms={blossoms} fruits={fruits} />
        </g>
    );
}

// Everything that stands in the pot or on the island at `level` (+ `share` of the next)
function scene(level, share) {
    const L = clamp(level, 1, 50);
    const tier = TIERS.indexOf(tierFor(L));
    const g = L + share;   // a smooth level number, for sizes
    const parts = [];

    if (tier === 0) {
        // seed: half in the soil; level 2 sends up a tip
        parts.push(<Part key="seed" x={CX} y={BASE_Y - 1} scale={1}><ellipse rx={5} ry={3.4} className={styles.seed} /></Part>);
        if (g >= 1.5) parts.push(<Leaf key="tip" x={CX + 1} y={BASE_Y - 3} angle={12} scale={0.25 + (g - 1.5) * 0.3} />);
        return parts;
    }

    if (tier <= 2) {
        // sprout and sapling: one stem, leaves in pairs up along it
        const height = tier === 1 ? 10 + (g - 3) * 4 : 22 + (g - 6) * 5.5;
        parts.push(<Stem key="stem" x={CX} y={BASE_Y} height={height} />);
        const pairs = tier === 1 ? 1 : Math.min(5, 1 + Math.floor(g - 5));
        for (let i = 0; i < pairs; i++) {
            const at = pairs === 1 ? 1 : 0.35 + (0.65 * i) / (pairs - 1);
            const size = (tier === 1 ? 0.55 + (g - 3) * 0.12 : 0.7 + i * 0.05) * (i === pairs - 1 ? clamp(0.5 + share, 0.5, 1) : 1);
            parts.push(<Leaf key={`l${i}`} x={CX} y={BASE_Y - height * at} angle={-58 + i * 4} scale={size} tone={i % 2 ? 2 : 1} />);
            parts.push(<Leaf key={`r${i}`} x={CX} y={BASE_Y - height * at - 1.5} angle={58 - i * 4} scale={size} tone={i % 2 ? 1 : 2} />);
        }
        if (tier === 2) parts.push(<Leaf key="top" x={CX} y={BASE_Y - height} angle={0} scale={0.8} tone={1} />);
        return parts;
    }

    if (tier === 3) {
        // shrub: three stems fanning out, full of leaves; berries from level 12
        const height = 32 + (g - 10) * 2.2;
        [-24, 0, 24].forEach((angle, s) => {
            parts.push(<Stem key={`stem${s}`} x={CX} y={BASE_Y} angle={angle} height={height * (s === 1 ? 1 : 0.85)} />);
        });
        const leaves = [
            [-16, -0.55, -70], [-20, -0.8, -40], [-12, -0.95, -15], [16, -0.55, 70], [20, -0.8, 40], [12, -0.95, 15],
            [0, -1.05, 0], [-6, -0.7, -30], [6, -0.7, 30], [-24, -0.62, -85], [24, -0.62, 85], [0, -0.82, 8],
        ];
        const count = Math.min(leaves.length, 7 + Math.floor((g - 10) * 1.3));
        leaves.slice(0, count).forEach(([dx, k, angle], i) => {
            parts.push(<Leaf key={`leaf${i}`} x={CX + dx} y={BASE_Y + height * k} angle={angle} scale={0.95 + (i % 3) * 0.08} tone={(i % 3) + 1} />);
        });
        const berries = Math.max(0, Math.floor(g) - 11);
        [[-10, -0.75], [9, -0.68], [-2, -0.92]].slice(0, berries).forEach(([dx, k], i) => {
            parts.push(<Part key={`berry${i}`} x={CX + dx} y={BASE_Y + height * k}><circle r={2.4} className={styles.fruit} /></Part>);
        });
        return parts;
    }

    // from here on a tree (and later more) on a little island of grass
    if (tier === 4) {
        parts.push(<Tree key="main" id="main" x={CX} height={42 + (g - 15) * 2} r={20 + (g - 15) * 0.9} />);
    } else if (tier === 5) {
        parts.push(<Tree key="main" id="main" x={CX - 4} height={50 + (g - 20) * 0.4} r={24 + (g - 20) * 0.3}
            blossoms={Math.min(8, 1 + Math.floor((g - 20) / 1.3))} />);
        parts.push(<Tree key="side1" id="side1" x={CX + 30} height={14 + (g - 20) * 1.1} r={7 + (g - 20) * 0.55} />);
    } else if (tier === 6) {
        parts.push(<Tree key="side2" id="side2" x={CX - 30} height={18 + (g - 30) * 0.8} r={9 + (g - 30) * 0.35} />);
        parts.push(<Tree key="side1" id="side1" x={CX + 30} height={24 + (g - 30) * 0.6} r={11 + (g - 30) * 0.3} />);
        parts.push(<Tree key="main" id="main" x={CX} height={54 + (g - 30) * 0.2} r={27 + (g - 30) * 0.2}
            blossoms={8} fruits={Math.min(6, 1 + Math.floor((g - 30) / 1.7))} />);
    } else {
        parts.push(<Blob key="halo" x={CX} y={BASE_Y - 62} r={40 * (1 + (g - 40) * 0.02)} className={styles.halo} />);
        parts.push(<Tree key="side2" id="side2" x={CX - 32} height={22} r={10} />);
        parts.push(<Tree key="side1" id="side1" x={CX + 32} height={27} r={12} />);
        parts.push(<Tree key="main" id="main" x={CX} height={52 + (g - 40) * 0.5} r={28 + (g - 40) * 0.35}
            blossoms={8} fruits={Math.min(8, 4 + Math.floor((g - 40) / 2.5))} roots />);
        // fireflies around the old tree, one more every two levels
        const flies = [[-38, -70], [36, -84], [-22, -98], [42, -56], [-44, -42], [24, -104]];
        flies.slice(0, Math.min(flies.length, 1 + Math.floor((g - 40) / 2))).forEach(([dx, dy], i) => {
            parts.push(<Part key={`fly${i}`} x={CX + dx} y={BASE_Y + dy} className={styles.firefly}><circle r={1.6} className={styles.fly} /></Part>);
        });
    }
    // grass tufts on the island
    const tufts = tier >= 6 ? [[-40, 0.9], [-14, 0.7], [18, 0.8], [44, 0.9]] : [[-36, 0.8], [36, 0.7]];
    tufts.forEach(([dx, k], i) => {
        parts.push(
            <Part key={`tuft${i}`} x={CX + dx} y={BASE_Y + 1} scale={k}>
                <path d="M-3 0L-4-7M0 0L0-9M3 0L4-6" className={styles.grass} />
            </Part>
        );
    });
    return parts;
}

export default function LevelPlant({ level = 1, share = 0, size = 120, className = '', label }) {
    const tier = TIERS.indexOf(tierFor(clamp(level, 1, 50)));
    const island = tier >= 4;
    const zoom = ZOOM[tier] ?? 1;
    return (
        <span className={`${styles.frame} ${className}`} style={{ '--plant-size': `${size}px` }}
            data-tier={TIERS[tier]?.id} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>
            <svg viewBox="0 0 120 132" className={styles.svg} focusable="false">
                <g className={styles.part} style={{ transform: `translate(${CX}px, 128px) scale(${zoom}) translate(-${CX}px, -128px)` }}>
                {island
                    ? <g key="island">
                        <ellipse cx={CX} cy={BASE_Y + 6} rx={52} ry={9} className={styles.soilDark} />
                        <ellipse cx={CX} cy={BASE_Y + 2} rx={52} ry={7} className={styles.grassGround} />
                    </g>
                    : <g key="pot">
                        <path d={`M${CX - 19} ${BASE_Y + 2}L${CX + 19} ${BASE_Y + 2}L${CX + 14} ${BASE_Y + 20}L${CX - 14} ${BASE_Y + 20}Z`} className={styles.pot} />
                        <rect x={CX - 22} y={BASE_Y - 2} width={44} height={7} rx={2} className={styles.potRim} />
                        <ellipse cx={CX} cy={BASE_Y} rx={18} ry={2.4} className={styles.soil} />
                    </g>}
                {scene(level, clamp(share, 0, 1))}
                </g>
            </svg>
        </span>
    );
}
