import { configureStore } from "@reduxjs/toolkit";
import rootReducer from "./rootReducer";
import { persistFocusRun } from "./session/focusRun";

const store = configureStore({ reducer: rootReducer });

// a running focus session survives the app being frozen or closed (see focusRun.js)
persistFocusRun(store);

export default store;
