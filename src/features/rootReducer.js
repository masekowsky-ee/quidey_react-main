import { combineReducers } from "redux";
import taskReducer from "./tasks/taskReducer";
import sessionReducer from "./session/sessionReducer";
import authReducer from "./auth/authReducer";
import settingsReducer from "./settings/settingsReducer";
import friendsReducer from "./friends/friendsReducer";
import togetherReducer from "./together/togetherReducer";
import toastReducer from "./toast/toast";
import inboxReducer from "./inbox/inbox";
import newsReducer from "./realtime/news";
import familyReducer from "./family/family";
import feedReducer from "./feed/feed";
import progressReducer from "./progress/progress";
import presenceReducer from "./presence/presence";
import routinesReducer from "./routines/routines";
import collectionsReducer from "./collections/collections";
import studyReducer from "./study/study";
import remindersReducer from "./reminders/reminders";
import { LOGOUT } from "./auth/authActionTypes";

const appReducer = combineReducers({
    task: taskReducer,
    session: sessionReducer,
    auth: authReducer,
    settings: settingsReducer,
    friends: friendsReducer,
    together: togetherReducer,
    toast: toastReducer,
    inbox: inboxReducer,
    news: newsReducer,
    family: familyReducer,
    feed: feedReducer,
    progress: progressReducer,
    presence: presenceReducer,
    routines: routinesReducer,
    collections: collectionsReducer,
    reminders: remindersReducer,
    study: studyReducer,
});

// Signing out starts every account's state again. Not reset, on purpose:
//  - auth: handles LOGOUT itself (and keeps its token field in step with the device)
//  - settings: language, theme, palette, accent, sound, motion, uiVariant, uiColors and the other
//    preferences belong to the device, not to the account
//  - toast: the "signed out" notice and any error toast must outlive the sign-out
//  - session: the focus timer; sign-out resets it with resetFocus() (and its stored run)
//  - task, collections, progress: the guest App marks them loaded-and-empty itself (App.jsx), a reset
//    here would flash their skeletons first
// friends, together, family, presence and reminders handle LOGOUT in their own reducers.
const KEPT_ON_LOGOUT = ['auth', 'settings', 'toast', 'session', 'task', 'collections', 'progress',
    'friends', 'together', 'family', 'presence', 'reminders'];

const rootReducer = (state, action) => {
    if (action.type === LOGOUT && state) {
        const next = { ...state };
        for (const key of Object.keys(next)) if (!KEPT_ON_LOGOUT.includes(key)) next[key] = undefined;
        return appReducer(next, action);
    }
    return appReducer(state, action);
};

export default rootReducer;
