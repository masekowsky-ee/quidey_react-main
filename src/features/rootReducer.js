import { combineReducers } from "redux";
import taskReducer from "./tasks/taskReducer";
import sessionReducer from "./session/sessionReducer";
import authReducer from "./auth/authReducer";

const rootReducer = combineReducers({
    task: taskReducer,
    session: sessionReducer,
    auth: authReducer,
});

export default rootReducer;