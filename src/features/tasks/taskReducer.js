import { ADD_TASK, DELETE_TASK, UPDATE_TASK_TITLE, UPDATE_TASK_DESCRIPTION, UPDATE_TASK_DUE, UPDATE_TASK_COMPLETED, UPDATE_TASK_PRIORITY } from './taskActionTypes';

const initialState = {
    tasks: [],
};

const taskReducer = (state = initialState, action) => {
    switch (action.type) {
        case ADD_TASK: 
            return {
                ...state,
                tasks: [...state.tasks, action.payload],
            };
        case DELETE_TASK: 
            return {
                ...state,
                tasks: state.tasks.filter(task => task !== action.payload),
            };


        default:
            return state;
    }
}

export default taskReducer;