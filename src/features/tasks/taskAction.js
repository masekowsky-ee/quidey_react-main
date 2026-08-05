import { ADD_TASK, DELETE_TASK, UPDATE_TASK_TITLE, UPDATE_TASK_DESCRIPTION, UPDATE_TASK_DUE, UPDATE_TASK_COMPLETED, UPDATE_TASK_PRIORITY, ADD_GROUP, DELETE_GROUP, EDIT_DISPLAYGROUP, ADD_GROUP_TASKS, DELETE_GROUP_TASKS, EDIT_GROUP_DESCRIPTION, CREATE_NOTE, DELETE_NOTE } from './taskActionTypes';

// Action creators for task management
export const addTask = (task) => {
    return {
        type: ADD_TASK,
        payload: task,
    };
}

export const deleteTask = (taskIndex) => {
    return {
        type: DELETE_TASK,
        payload: taskIndex,
    };
}

export const updateTaskTitle = (taskIndex, value) => {
    return {
        type: UPDATE_TASK_TITLE,
        payload: {taskIndex, value},
    };
}

export const updateTaskDescription = (taskIndex, value) => {
    return {
        type: UPDATE_TASK_DESCRIPTION,
        payload: {taskIndex, value},
    };
}

export const updateTaskDue = (taskIndex, value) => {
    return {
        type: UPDATE_TASK_DUE,
        payload: {taskIndex, value},
    };
}

export const updateTaskCompleted = (taskIndex) => {
    return {
        type: UPDATE_TASK_COMPLETED,
        payload: taskIndex,
    };
}

export const updateTaskPriority = (taskIndex, value) => {
    return {
        type: UPDATE_TASK_PRIORITY,
        payload: {taskIndex, value},
    };
}

export const addGroup = (group) => {
    return {
        type: ADD_GROUP,
        payload: group,
    };
}

export const deleteGroup = (groupName) => {
    return {
        type: DELETE_GROUP,
        payload: groupName,
    };
}

export const editDisplaygroup = (group) => {
    return {
        type: EDIT_DISPLAYGROUP,
        payload: group,
    };
}

export const addGroupTasks = (groupName, taskIndex) => {
    return {
        type: ADD_GROUP_TASKS,
        payload: {groupName, taskIndex},
    };
}

export const deleteGroupTasks = (taskIndex, groupName) => {
    return {
        type: DELETE_GROUP_TASKS,
        payload: {taskIndex, groupName},
    };
}

export const editGroupDes = (groupName, value) => {
    return {
        type: EDIT_GROUP_DESCRIPTION,
        payload: {groupName, value},
    }
}

export const createNote = (note) => {
    return {
        type: CREATE_NOTE,
        payload: note,
    }
}

export const deleteNote = (noteId) => {
    return {
        type: DELETE_NOTE,
        payload: noteId,
    }
}
