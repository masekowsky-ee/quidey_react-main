import { combineReducers } from "redux";
import taskReducer from "./tasks/taskReducer";
import sessionReducer from "./session/sessionReducer";

const rootReducer = combineReducers({
    task: taskReducer,
    session: sessionReducer,
});

export default rootReducer;