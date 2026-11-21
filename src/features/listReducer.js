// The reducer of a list the server owns, shared by routines and the tester's reminders:
// { list, loaded }, set as a whole, one item saved (added or replaced by id) or removed.
// resetOn: action types that empty it again (sign-out).
export function listReducer({ set, saved, removed, resetOn = [] }) {
    return (state = { list: [], loaded: false }, action) => {
        switch (action.type) {
            case set:
                return { list: action.payload, loaded: true };
            case saved: {
                const exists = state.list.some(item => item.id === action.payload.id);
                return {
                    ...state,
                    list: exists ? state.list.map(item => item.id === action.payload.id ? action.payload : item) : [...state.list, action.payload],
                };
            }
            case removed:
                return { ...state, list: state.list.filter(item => item.id !== action.payload) };
            default:
                return resetOn.includes(action.type) ? { list: [], loaded: false } : state;
        }
    };
}
