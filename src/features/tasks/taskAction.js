import { ADD_TASK, DELETE_TASK, UPDATE_TASK_TITLE, UPDATE_TASK_DESCRIPTION, UPDATE_TASK_DUE, UPDATE_TASK_COMPLETED, UPDATE_TASK_PRIORITY } from './taskActionTypes';

// Action creators for task management
export const addTask = (task) => {
    return {
        type: ADD_TASK,
        payload: task,
    };
}

export const deleteTask = (task) => {
    return {
        type: DELETE_TASK,
        payload: task,
    };
}

export const updateTaskTitle = (value) => {
    return {
        type: UPDATE_TASK_TITLE,
        payload: value,
    };
}

export const updateTaskDescription = (value) => {
    return {
        type: UPDATE_TASK_DESCRIPTION,
        payload: value,
    };
}

export const updateTaskDue = (task) => {
    return {
        type: UPDATE_TASK_DUE,
        payload: task,
    };
}

export const updateTaskCompleted = (task) => {
    return {
        type: UPDATE_TASK_COMPLETED,
        payload: task,
    };
}

export const updateTaskPriority = (task) => {
    return {
        type: UPDATE_TASK_PRIORITY,
        payload: task,
    };
}