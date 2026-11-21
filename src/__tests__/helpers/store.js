import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../../features/rootReducer'

// A fresh store with the app's real reducers; options only for the few setups that need them
export const makeStore = ({ relaxedChecks = false } = {}) => configureStore({
    reducer: rootReducer,
    ...(relaxedChecks && { middleware: (get) => get({ serializableCheck: false, immutableCheck: false }) }),
})
