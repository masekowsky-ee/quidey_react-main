import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../../features/rootReducer'

export const makeStore = ({ relaxedChecks = false } = {}) => configureStore({
    reducer: rootReducer,
    ...(relaxedChecks && { middleware: (get) => get({ serializableCheck: false, immutableCheck: false }) }),
})
