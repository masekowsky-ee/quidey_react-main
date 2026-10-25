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

const rootReducer = combineReducers({
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
});

export default rootReducer;