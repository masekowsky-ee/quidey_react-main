import { ADD_TASK, DELETE_TASK, UPDATE_TASK_TITLE, UPDATE_TASK_DESCRIPTION, UPDATE_TASK_DUE, UPDATE_TASK_COMPLETED, UPDATE_TASK_PRIORITY, ADD_GROUP, DELETE_GROUP, EDIT_DISPLAYGROUP, ADD_GROUP_TASKS, DELETE_GROUP_TASKS, EDIT_GROUP_DESCRIPTION, CREATE_NOTE, DELETE_NOTE, SET_TASK_STATE } from './taskActionTypes';
import { apiFetch } from '../helperFunction';


// Action creators for task management
export const fetchTaskState = () => {
    return async (dispatch) => {
        const tasks = await apiFetch("http://localhost:3000/api/tasks");
        const groups = await apiFetch("http://localhost:3000/api/groups");
        dispatch({ type: SET_TASK_STATE, payload: {tasks, groups} });
    }
}

export const addTask = (name, due, description, prio, userId) => {
    return async (dispatch) => {
        const data = await apiFetch(
            "http://localhost:3000/api/tasks", {
                method: "POST",
                body: JSON.stringify({name, due, description, prio, userId})
            }
        );

        console.log("Task created successfully:", data);

        dispatch({
            type: ADD_TASK,
            payload: data,
        });
    };
}

export const deleteTask = (taskId) => {
    return async (dispatch) => {
        await apiFetch(`http://localhost:3000/api/tasks/${taskId}`, {method: "DELETE"});
        dispatch({
            type: DELETE_TASK,
            payload: taskId,
        });
}
}

export const updateTaskTitle = (taskId, value) => {
    return {
        type: UPDATE_TASK_TITLE,
        payload: {taskId, value},
    };
}

export const updateTaskDescription = (taskId, value) => {
    return {
        type: UPDATE_TASK_DESCRIPTION,
        payload: {taskId, value},
    };
}

export const updateTaskDue = (taskId, value) => {
    return {
        type: UPDATE_TASK_DUE,
        payload: {taskId, value},
    };
}

export const updateTaskCompleted = (taskId) => {
    return {
        type: UPDATE_TASK_COMPLETED,
        payload: taskId,
    };
}

export const updateTaskPriority = (taskId, value) => {
    return {
        type: UPDATE_TASK_PRIORITY,
        payload: {taskId, value},
    };
}

export const addGroup = (name, description) => {
    return async (dispatch) => {
        const data = await apiFetch("http://localhost:3000/api/groups", {
            method: "POST", body: JSON.stringify({name, description})
        });

        console.log("Group created successfully:", data);
    
        dispatch({
            type: ADD_GROUP,
            payload: data,
        });
    }
}

export const deleteGroup = (groupName) => {
    return {
        type: DELETE_GROUP,
        payload: groupName,
    };
}

export const editDisplaygroup = (group, groupToDisplayId) => {
    console.log(group);
    return async (dispatch) => {
        if(groupToDisplayId === group.id) {
            const tasks = await apiFetch(`http://localhost:3000/api/tasks`, {method: "GET",});
            dispatch({
                type: EDIT_DISPLAYGROUP,
                payload: {group: {}, tasks},
            });
        } else{
            const tasks = await apiFetch(`http://localhost:3000/api/groups/${group.id}/tasks`, {method: "GET",});
            dispatch({
                type: EDIT_DISPLAYGROUP,
                payload: {group, tasks},
            });
        }
    };
}

export const addGroupTasks = (groupId, taskId) => {
    return async () => {
        await apiFetch(`http://localhost:3000/api/tasks/${taskId}/groups/${groupId}`, {method: "POST"});
    };
}

export const deleteGroupTasks = (taskId, groupId) => {
    return async (dispatch) => {
        await apiFetch(`http://localhost:3000/api/task-groups/${taskId}/${groupId}`, {method: "DELETE"});
        dispatch({
            type: DELETE_GROUP_TASKS,
            payload: taskId,
        });
    };
}

export const editGroupDes = (groupName, value) => {
    return {
        type: EDIT_GROUP_DESCRIPTION,
        payload: {groupName, value},
    }
}

export const createNote = (taskId, note) => {
    return {
        type: CREATE_NOTE,
        payload: { taskId, note },
    }
}

export const deleteNote = (taskId, noteId) => {
    return {
        type: DELETE_NOTE,
        payload: { taskId, noteId },
    }
}
