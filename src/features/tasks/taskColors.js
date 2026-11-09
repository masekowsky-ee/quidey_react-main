// The colours a task can have (the api knows the same list). The colour values live in
// index.css ([data-task-color], one tone per theme); components only set the attribute.
export const TASK_COLORS = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'violet', 'pink'];

// A colour of one's own, picked on the colour wheel (task/ColorWheel.jsx): "#rrggbb", lower case.
// It goes into data-task-color as it is; features/tasks/ownColors.js gives such an attribute its
// --task-color. The same colour in both themes (it is the one that was picked).
export const HEX_COLOR = /^#[0-9a-f]{6}$/;
export const isOwnColor = (value) => typeof value === 'string' && HEX_COLOR.test(value);
// one of the eight names or a colour of one's own
export const isTaskColor = (value) => TASK_COLORS.includes(value) || isOwnColor(value);

// "#rrggbb" <-> { h 0-360, s 0-100, l 0-100 } for the wheel
export function hexToHsl(hex) {
    if (!isOwnColor(hex)) return null;
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0) return { h: 0, s: 0, l: Math.round(l * 100) };
    const s = d / (1 - Math.abs(2 * l - 1));
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: Math.round((h * 60 + 360) % 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToHex({ h, s, l }) {
    const sat = s / 100;
    const light = l / 100;
    const a = sat * Math.min(light, 1 - light);
    const channel = (n) => {
        const k = (n + h / 30) % 12;
        const value = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
        return Math.round(value * 255).toString(16).padStart(2, '0');
    };
    return `#${channel(0)}${channel(8)}${channel(4)}`;
}

// The colour a task shows: its own; an event without one takes its type's
const shownColor = (task) => task?.color ?? (task?.kind === 'event' ? task.event_type?.color : null);

// The data-task-color attribute of a task's row or chip: its colour while it's open, nothing
// when it has none or is done (done tasks are greyed out like before)
export const taskColorAttr = (task) =>
    !task?.done && isTaskColor(shownColor(task)) ? shownColor(task) : undefined;

// The same attribute for a group (its tasks show a dot in that colour): its colour or nothing
export const groupColorAttr = (group) =>
    isTaskColor(group?.color) ? group.color : undefined;
