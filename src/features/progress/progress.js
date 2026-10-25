import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { apiFetch, fill } from '../helperFunction';
import { showToast } from '../toast/toast';
import { COMMUNITY_PATHS } from '../community/paths';
import { translate } from '../../i18n/useTranslation';
import { burst } from '../settings/motion';
import { PROFILE_COLORS, PROFILE_BANNERS, PROFILE_EMOJIS, AVATAR_FRAMES } from '../profile/profileOptions';

// Levels, XP and challenges. The server works them out (GET /api/progress, utils/progress.js in
// the api) from focus minutes, tasks done and the challenges completed; these are the same rules,
// for showing what a level unlocks and how far the next one is. Keep both in step.

export const DAY_FOCUS_XP_MAX = 600;
export const TASK_XP = 5;
export const DAY_TASKS_MAX = 30;

// The top level. The owner's account (admin for good) is always on it, with everything unlocked.
export const MAX_LEVEL = 50;

// total XP at which a level starts: 0, 150, 375, 675, ... (150 + 75 per level for each step)
export const levelStartXp = (level) => 150 * (level - 1) + 37.5 * (level - 1) * (level - 2);

// Streaks worth celebrating (the api posts them to the feed too): the next one after `streak`
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365];
export const nextStreakMilestone = (streak, milestones = STREAK_MILESTONES) =>
    milestones.find(goal => goal > streak) ?? null;

// From this hour on, a streak that today hasn't continued yet gets one reminder (once a day,
// remembered in localStorage as `streakNudge`)
export const STREAK_NUDGE_HOUR = 18;

// The level names: Quidey grows like a plant, from a seed to an old forest
export const TIERS = [
    { id: 'seed', level: 1 }, { id: 'sprout', level: 3 }, { id: 'sapling', level: 6 }, { id: 'shrub', level: 10 },
    { id: 'tree', level: 15 }, { id: 'grove', level: 20 }, { id: 'forest', level: 30 }, { id: 'ancient', level: 40 },
];
export const tierFor = (level) => [...TIERS].reverse().find(tier => level >= tier.level) ?? TIERS[0];

// ---------- unlocks ----------
export const TITLES_FROM = 5;
const BANNER_LEVELS = { gradient: 1, dots: 1, stripes: 5, grid: 5, aurora: 8, glow: 8, rings: 14, topo: 18, sky: 24 };
const FRAME_LEVELS = { ring: 10, double: 16, dotted: 22, orbit: 30 };
export const TITLE_LEVELS = {
    ...Object.fromEntries(TIERS.map(tier => [tier.id, Math.max(TITLES_FROM, tier.level)])),
    planner: 5, nightOwl: 7, earlyBird: 7, teamPlayer: 9, deepFocus: 12, marathon: 16, mentor: 25,
};
export const PROFILE_TITLES = Object.keys(TITLE_LEVELS).sort((a, b) => TITLE_LEVELS[a] - TITLE_LEVELS[b]);
export const SHOWCASE_LEVEL = 18;
export const SHOWCASE_MAX = 3;

// The level a profile choice needs (1: always there)
export function requiredLevel(field, value) {
    if (value === null || value === undefined) return 1;
    switch (field) {
        case 'emoji': {
            const index = PROFILE_EMOJIS.indexOf(value);
            return index < 10 ? 1 : index < 20 ? 3 : index < 30 ? 6 : 12;
        }
        case 'color': return PROFILE_COLORS.indexOf(value) < 4 ? 1 : 4;
        case 'banner': return BANNER_LEVELS[value] ?? 1;
        case 'frame': return FRAME_LEVELS[value] ?? 1;
        case 'title': return TITLE_LEVELS[value] ?? 1;
        case 'showcase': return SHOWCASE_LEVEL;
        default: return 1;
    }
}

// Everything a level unlocks, level by level: [{ level, items: [{ kind, value? }] }].
// kind: 'emojis' (count), 'colors' (count), 'banner', 'frame', 'titles' (the feature), 'title', 'showcase'
export const UNLOCKS = (() => {
    const at = new Map();
    const add = (level, item) => at.set(level, [...(at.get(level) ?? []), item]);
    add(3, { kind: 'emojis', value: 10 });
    add(6, { kind: 'emojis', value: 10 });
    add(12, { kind: 'emojis', value: 10 });
    add(4, { kind: 'colors', value: PROFILE_COLORS.length - 4 });
    for (const banner of PROFILE_BANNERS) if (BANNER_LEVELS[banner] > 1) add(BANNER_LEVELS[banner], { kind: 'banner', value: banner });
    for (const frame of AVATAR_FRAMES) add(FRAME_LEVELS[frame], { kind: 'frame', value: frame });
    add(TITLES_FROM, { kind: 'titles' });
    for (const title of PROFILE_TITLES) if (TITLE_LEVELS[title] > TITLES_FROM) add(TITLE_LEVELS[title], { kind: 'title', value: title });
    add(SHOWCASE_LEVEL, { kind: 'showcase' });
    return [...at.entries()].sort((a, b) => a[0] - b[0]).map(([level, items]) => ({ level, items }));
})();

// "Banner “Aurora”", "10 new avatar emojis", ...
export function unlockText(t, item) {
    switch (item.kind) {
        case 'emojis': return fill(t('unlock_emojis'), { count: item.value });
        case 'colors': return fill(t('unlock_colors'), { count: item.value });
        case 'banner': return fill(t('unlock_banner'), { name: t(`profileBanner_${item.value}`) });
        case 'frame': return fill(t('unlock_frame'), { name: t(`frame_${item.value}`) });
        case 'title': return fill(t('unlock_title'), { name: t(`title_${item.value}`) });
        default: return t(`unlock_${item.kind}`);
    }
}

// The next few levels that unlock something, after `level`
export const nextUnlocks = (level, count = 3) => UNLOCKS.filter(step => step.level > level).slice(0, count);

// ---------- the store ----------
const PROGRESS_LOADED = 'PROGRESS_LOADED';
const RANKING_LOADED = 'RANKING_LOADED';
const PROGRESS_FAILED = 'PROGRESS_FAILED';

// failed: the last look went wrong (what is on screen stays)
const initialState = { data: null, ranking: null, failed: false };

export default function progressReducer(state = initialState, action) {
    switch (action.type) {
        case PROGRESS_LOADED:
            return { ...state, data: action.payload, failed: false };
        case PROGRESS_FAILED:
            return { ...state, failed: true };
        case RANKING_LOADED:
            return { ...state, ranking: action.payload };
        default:
            return state;
    }
}

const allChallenges = (data) => data ? [...data.daily, ...data.weekly] : [];

// Evening, a streak running and no focus today yet: one quiet reminder a day
function nudgeStreak(dispatch, data, t, now = new Date()) {
    if (!data || data.streak <= 0 || data.streakToday || now.getHours() < STREAK_NUDGE_HOUR) return;
    try {
        if (localStorage.getItem('streakNudge') === data.today) return;
        localStorage.setItem('streakNudge', data.today);
    } catch {
        return; // without storage it would come on every look: better not at all
    }
    dispatch(showToast(fill(t(data.streak === 1 ? 'toast_streakWaitingOne' : 'toast_streakWaiting'), { days: data.streak }), 'info',
        { to: '/', detail: t('toast_streakWaitingDetail') }));
}

// My progress, completing what I reached. What is new since the last look (a challenge done, a
// level up) comes with a toast; a level up also with confetti when the motion setting allows.
export const fetchProgress = () => async (dispatch, getState) => {
    const before = getState().progress.data;
    let data;
    try {
        data = await apiFetch('/api/progress');
    } catch (err) {
        dispatch({ type: PROGRESS_FAILED });
        throw err;
    }
    dispatch({ type: PROGRESS_LOADED, payload: data });
    const { language, motion } = getState().settings;
    const t = (key) => translate(language, key);
    nudgeStreak(dispatch, data, t);
    if (!before) return data;

    const wasDone = new Set(allChallenges(before).filter(c => c.done).map(c => `${c.id}:${before.today}:${before.weekStart}`));
    for (const challenge of allChallenges(data)) {
        if (challenge.done && !wasDone.has(`${challenge.id}:${data.today}:${data.weekStart}`)
            && (challenge.period === 'day' ? data.today === before.today : data.weekStart === before.weekStart)) {
            dispatch(showToast(fill(t('toast_challengeDone'), { xp: challenge.xp }), 'success',
                { to: COMMUNITY_PATHS.progress, detail: challengeTitle(t, challenge) }));
        }
    }
    // the streak went on today: a milestone is celebrated, any other day just counted
    if (data.streakToday && !before.streakToday && data.today === before.today && data.streak > 0) {
        const milestone = STREAK_MILESTONES.includes(data.streak);
        dispatch(showToast(fill(t(milestone ? 'toast_streakMilestone' : data.streak === 1 ? 'toast_streakStartedOne' : 'toast_streakGoesOn'), { days: data.streak }),
            'success', { to: '/', detail: milestone ? t('toast_streakMilestoneDetail') : undefined }));
        if (milestone && motion !== 'minimal' && typeof window !== 'undefined') burst(window.innerWidth / 2, window.innerHeight * 0.3, motion === 'extreme' ? 60 : 30);
    }
    if (data.level > before.level) {
        dispatch(showToast(fill(t('toast_levelUp'), { level: data.level }), 'success',
            { to: COMMUNITY_PATHS.progress, detail: t(`tier_${tierFor(data.level).id}`) }));
        if (motion !== 'minimal' && typeof window !== 'undefined') burst(window.innerWidth / 2, window.innerHeight * 0.4, motion === 'extreme' ? 70 : 36);
    }
    return data;
};

// This week among friends
export const fetchRanking = () => async (dispatch) => {
    const data = await apiFetch('/api/progress/friends');
    dispatch({ type: RANKING_LOADED, payload: data });
    return data;
};

// "Focus 45 minutes", "Tick off 3 tasks", ...
export const challengeTitle = (t, challenge) => fill(t(`challenge_${challenge.id}`), { goal: challenge.goal, hours: challenge.goal / 60 });

// A number in the app's language: 1.944 / 1,944, 2,2 / 2.2
export const formatNumber = (value, language, digits = 0) =>
    new Intl.NumberFormat(language === 'de' ? 'de-DE' : 'en-GB', { maximumFractionDigits: digits }).format(value);

// How a challenge's numbers read: minutes as "18 / 45 Min.", long ones in hours, others as "2 / 3"
export function challengeAmount(t, challenge, language) {
    const minutes = ['focus25', 'focus45', 'focus90', 'deepWork', 'earlyBird', 'together20', 'week5h', 'week8h', 'togetherWeek'].includes(challenge.id);
    if (!minutes) return `${challenge.value} / ${challenge.goal}`;
    if (challenge.goal >= 120) return `${formatNumber(challenge.value / 60, language, 1)} / ${formatNumber(challenge.goal / 60, language, 1)} ${t('unitHours')}`;
    return `${challenge.value} / ${challenge.goal} ${t('unitMinutes')}`;
}

// App-wide: my progress is loaded once allowed and looked at again whenever a focus session is
// saved or a task is ticked off (debounced), so challenges complete right when they are reached
const REFRESH_DELAY_MS = 1500;

export function useProgressWatcher(enabled) {
    const dispatch = useDispatch();
    const sessions = useSelector(state => state.session.workedSessionData?.length ?? 0);
    const done = useSelector(state => state.task.tasks?.filter(task => task.done).length ?? 0);
    const timer = useRef(null);

    useEffect(() => {
        if (!enabled) return;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => dispatch(fetchProgress()).catch(() => {}), REFRESH_DELAY_MS);
        return () => clearTimeout(timer.current);
    }, [enabled, sessions, done, dispatch]);
}
