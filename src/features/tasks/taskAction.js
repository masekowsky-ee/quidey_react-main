import { ADD_TASK, DELETE_TASK, UPDATE_TASK_TITLE, UPDATE_TASK_DESCRIPTION, UPDATE_TASK_DUE, UPDATE_TASK_COMPLETED, UPDATE_TASK_PRIORITY, INC_TASKCOUNTER, ADD_GROUP, DELETE_GROUP, EDIT_DISPLAYGROUP, ADD_GROUP_TASKS, DELETE_GROUP_TASKS, EDIT_GROUP_DESCRIPTION } from './taskActionTypes';

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

export const incTaskcounter = () => {
    return {
        type: INC_TASKCOUNTER,
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

export const editGroupDes = (groupName, description) => {
    return {
        type: EDIT_GROUP_DESCRIPTION,
        payload: {groupName, description},
    }
}