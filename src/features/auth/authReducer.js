import { session } from "../api/session";
import { LOGIN_SUCCESS, LOGOUT, SET_USER, SET_ACCESS, TOUR_SEEN, SAVED_COLORS_SET, TIPS_SET } from "./authActionTypes";

// What /api/me says about my access, as it stands before the server answered (and after sign-out).
// SET_ACCESS reads the server's answer field by field with these defaults (FIELD_READERS below):
// a field the server doesn't send (an older backend) falls back to what is here.
//
// closed beta: may I use the app? checked = the server answered (until then nothing is shown)
// betaRequest: my request for access, { status: 'pending' | 'approved' | 'declined', reason, createdAt } or null
// isAdmin: sees the admin panel; adminPendingCount: open beta requests (admins only)
// isTester: sees features not released to everyone yet (see features/auth/tester.js)
// allDayReminderTime: "HH:MM", where tasks without a time count their reminders from (tasks/reminders.js)
// tourSeen: false only for a new account that hasn't closed the intro tour yet (it opens by itself then)
// savedColors: my own colours ("#rrggbb", newest first) every colour picker offers (tasks/savedColors.js)
// tipsSeen / tipsOff: the feature tips I have seen / hid (features/tips/tips.js)
// max: Quidey Max { active, gift, until }, a superset of Pro (admins count as Max).
// isPro: may use the app (the name is older than Quidey Pro). pro: Quidey Pro { active, gift,
// until }; accessMode: 'beta' | 'open'; limits / usage: the free plan's (null without limits),
// see features/pro/pro.js; proSales: whether Pro is on sale (features/pro/flag.js). hasPassword: false for an account made with Google without one.
const DEFAULT_ACCESS = {
    checked: false, isPro: false, isAdmin: false, isTester: false, adminPendingCount: 0, betaRequest: null, allDayReminderTime: '12:00', tourSeen: true, userId: null, savedColors: [], tipsSeen: [], tipsOff: false,
    pro: { active: false, gift: false, until: null }, max: { active: false, gift: false, until: null }, proSales: false, trial: false, accessMode: 'beta', limits: null, usage: null, hasPassword: true, googleLinked: false,
    // anonymous usage statistics: my answer (choice 'granted' | 'denied' | null = not asked), when, which version of the question
    usageConsent: { choice: null, at: null, version: null },
};

const orDefault = (key) => (value) => value ?? DEFAULT_ACCESS[key];
const asList = (value) => (Array.isArray(value) ? value : []);
// how each field of the server's answer is read (the rest of DEFAULT_ACCESS is only `checked`)
const FIELD_READERS = {
    isPro: Boolean,
    isAdmin: Boolean,
    isTester: Boolean,
    // my own id (my profile picture, for one)
    userId: orDefault('userId'),
    adminPendingCount: orDefault('adminPendingCount'),
    betaRequest: orDefault('betaRequest'),
    allDayReminderTime: orDefault('allDayReminderTime'),
    tourSeen: (value) => value !== false,
    savedColors: asList,
    tipsSeen: asList,
    tipsOff: Boolean,
    pro: orDefault('pro'),
    max: orDefault('max'),
    proSales: Boolean,
    // chose "continue with the trial version": all features with the free plan's limits
    trial: Boolean,
    accessMode: (value) => (value === 'open' ? 'open' : 'beta'),
    limits: orDefault('limits'),
    usage: orDefault('usage'),
    hasPassword: (value) => value !== false,
    googleLinked: Boolean,
    usageConsent: orDefault('usageConsent'),
};

const readAccess = (me) => {
    const access = { checked: true };
    for (const [key, read] of Object.entries(FIELD_READERS)) access[key] = read(me[key]);
    return access;
};

const initialState = {
    token: null,
    user: {
        username: null,
        display_name: null,
        email: null,
        birth_date: null,
    },
    access: DEFAULT_ACCESS,
};

// the token is read when the store is made (not when this file loads): signed in or not is what is on the device then
const authReducer = (state = { ...initialState, token: session.token() || null }, action) => {
    switch (action.type) {
        case LOGIN_SUCCESS:
            return {
                ...state,
                token: action.payload.token,
                user: {
                    ...state.user,
                    username: action.payload.username,
                },
            };
        case LOGOUT:
            return {
                ...state,
                token: null,
                user: null,
                access: DEFAULT_ACCESS,
            };
        case SET_ACCESS:
            return { ...state, access: readAccess(action.payload) };
        case TOUR_SEEN:
            return { ...state, access: { ...state.access, tourSeen: true } };
        case TIPS_SET:
            return { ...state, access: { ...state.access, tipsSeen: action.payload.seen, tipsOff: action.payload.off } };
        case SAVED_COLORS_SET:
            return { ...state, access: { ...state.access, savedColors: action.payload } };
        case SET_USER:
            return {
                ...state,
                user: {
                    ...state.user,
                    username: action.payload[0].username,
                    display_name: action.payload[0].display_name,
                    email: action.payload[0].email,
                    email_verified: action.payload[0].email_verified,
                    birth_date: action.payload[0].birth_date,
                    created_at: action.payload[0].created_at,
                },
            };
        default:
            return state;
    }
};

export default authReducer;