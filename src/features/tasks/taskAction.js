import { ADD_TASK, DELETE_TASK, ADD_GROUP, DELETE_GROUP, EDIT_DISPLAYGROUP, DELETE_GROUP_TASKS, EDIT_GROUP, CREATE_NOTE, DELETE_NOTE, SET_TASK_STATE, UPDATE_TASK_PROPS } from './taskActionTypes';
import { apiFetch } from '../helperFunction';


// Action creators for task management
export const fetchTaskState = () => {
    return async (dispatch) => {
        const tasks = await apiFetch("http://localhost:3000/api/tasks");
        const groups = await apiFetch("http://localhost:3000/api/groups");
        dispatch({ type: SET_TASK_STATE, payload: {tasks, groups} });
    }
}

export const addTask = (name, due, description, prio, activeGroupId = null, userId) => {
    return async (dispatch) => {
        const data = await apiFetch(
            "http://localhost:3000/api/tasks", {
                method: "POST",
                body: JSON.stringify({name, due, description, prio, userId})
            }
        );

        const { id } = data;

        if (activeGroupId) {
            await apiFetch(`http://localhost:3000/api/tasks/${id}/groups/${activeGroupId}`, {method: "POST"}
            );
        }

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
    };
}

export const updateTaskProps = (taskPropObject, task) => {
    const defaults = task;
    const params = {...defaults, ...taskPropObject};
    const {name, due, description, prio, done, id} = params;
    return async (dispatch) => {
        const data = await apiFetch(`http://localhost:3000/api/tasks/${params.id}`, {
            method: "PUT", 
            body: JSON.stringify({name, due, description, prio, done, id})
        });

        console.log(`Task updated (id: ${id})`);
        dispatch({
            type: UPDATE_TASK_PROPS,
            payload: data,
        })
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
    };
}

export const deleteGroup = (groupId) => {
    return async (dispatch) => {
        await apiFetch(`http://localhost:3000/api/groups/${groupId}`, {method: "DELETE"});

        dispatch({
            type: DELETE_GROUP,
            payload: groupId,
        })
    };
}

export const editDisplaygroup = (group, groupToDisplayId) => {
    console.log(group);
    return async (dispatch) => {
        if(groupToDisplayId === group.id) {
            const tasks = await apiFetch(`http://localhost:3000/api/tasks`, {method: "GET",});
            console.log(tasks)
            dispatch({
                type: EDIT_DISPLAYGROUP,
                payload: {group: {}, tasks},
            });
        } else{
            const tasks = await apiFetch(`http://localhost:3000/api/groups/${group.id}/tasks`, {method: "GET",});
            console.log(tasks)
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

export const editGroup = (groupId, groupObj, group) => {
    const defaultObj = group;
    const updatedObj = groupObj;

    const fetchObj = {...defaultObj, ...groupObj};

    return async (dispatch) => {
        const data = await apiFetch(`http://localhost:3000/api/groups/${groupId}`, 
            {method: "PUT", body: JSON.stringify(fetchObj)}
        );

        dispatch({
            type: EDIT_GROUP,
            payload: data,
        });
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
