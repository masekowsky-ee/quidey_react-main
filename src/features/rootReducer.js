import { combineReducers } from "redux";
import taskReducer from "./tasks/taskReducer";
import sessionReducer from "./session/sessionReducer";
import authReducer from "./auth/authReducer";
import settingsReducer from "./settings/settingsReducer";

const rootReducer = combineReducers({
    task: taskReducer,
    session: sessionReducer,
    auth: authReducer,
    settings: settingsReducer,
});

export default rootReducer;