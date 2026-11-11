import { LOGIN_SUCCESS, LOGOUT, SET_USER, SET_ACCESS, TOUR_SEEN, SAVED_COLORS_SET, TIPS_SET } from "./authActionTypes";

const initialState = {
    token: localStorage.getItem('token') || null,
    user: {
        username: null,
        display_name: null,
        email: null,
        birth_date: null,
    },
    // closed beta: may I use the app? checked = the server answered (until then nothing is shown)
    // betaRequest: my request for access, { status: 'pending' | 'approved' | 'declined', reason, createdAt } or null
    // isAdmin: sees the admin panel; adminPendingCount: open beta requests (admins only)
    // isTester: sees features not released to everyone yet (see features/auth/tester.js)
    // allDayReminderTime: "HH:MM", where tasks without a time count their reminders from (tasks/reminders.js)
    // tourSeen: false only for a new account that hasn't closed the intro tour yet (it opens by itself then)
    // savedColors: my own colours ("#rrggbb", newest first) every colour picker offers (tasks/savedColors.js)
    // tipsSeen / tipsOff: the feature tips I have seen / hid (features/tips/tips.js)
    // isPro: may use the app (the name is older than Quidey Pro). pro: Quidey Pro { active, gift,
    // until }; accessMode: 'beta' | 'open'; limits / usage: the free plan's (null without limits),
    // see features/pro/pro.js; proSales: whether Pro is on sale (features/pro/flag.js). hasPassword: false for an account made with Google without one.
    access: {
        checked: false, isPro: false, isAdmin: false, isTester: false, adminPendingCount: 0, betaRequest: null, allDayReminderTime: '12:00', tourSeen: true, userId: null, savedColors: [], tipsSeen: [], tipsOff: false,
        pro: { active: false, gift: false, until: null }, proSales: false, trial: false, accessMode: 'beta', limits: null, usage: null, hasPassword: true, googleLinked: false,
        // anonymous usage statistics: my answer (choice 'granted' | 'denied' | null = not asked), when, which version of the question
        usageConsent: { choice: null, at: null, version: null },
    },
};

const authReducer = (state = initialState, action) => {
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
                access: initialState.access,
            };
        case SET_ACCESS:
            return {
                ...state,
                access: {
                    checked: true,
                    isPro: Boolean(action.payload.isPro),
                    isAdmin: Boolean(action.payload.isAdmin),
                    isTester: Boolean(action.payload.isTester),
                    // my own id (my profile picture, for one)
                    userId: action.payload.userId ?? null,
                    adminPendingCount: action.payload.adminPendingCount ?? 0,
                    betaRequest: action.payload.betaRequest ?? null,
                    allDayReminderTime: action.payload.allDayReminderTime ?? initialState.access.allDayReminderTime,
                    tourSeen: action.payload.tourSeen !== false,
                    savedColors: Array.isArray(action.payload.savedColors) ? action.payload.savedColors : [],
                    tipsSeen: Array.isArray(action.payload.tipsSeen) ? action.payload.tipsSeen : [],
                    tipsOff: Boolean(action.payload.tipsOff),
                    pro: action.payload.pro ?? initialState.access.pro,
                    proSales: Boolean(action.payload.proSales),
                    // chose "continue with the trial version": all features with the free plan's limits
                    trial: Boolean(action.payload.trial),
                    accessMode: action.payload.accessMode === 'open' ? 'open' : 'beta',
                    limits: action.payload.limits ?? null,
                    usage: action.payload.usage ?? null,
                    hasPassword: action.payload.hasPassword !== false,
                    googleLinked: Boolean(action.payload.googleLinked),
                    usageConsent: action.payload.usageConsent ?? initialState.access.usageConsent,
                },
            };
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