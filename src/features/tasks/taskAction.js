import { ADD_TASK, DELETE_TASK, ADD_GROUP, DELETE_GROUP, EDIT_DISPLAYGROUP, ADD_GROUP_TASKS, DELETE_GROUP_TASKS, EDIT_GROUP, CREATE_NOTE, DELETE_NOTE, SET_TASK_STATE, UPDATE_TASK_PROPS, EDIT_NOTE, GET_NOTES, REFRESH_TASKS, TASK_REPLACED, SET_TASK_INVITES, TASK_INVITE_ACCEPTED, TASK_INVITE_REMOVED, TASK_SHARE_REMOVED, SET_EVENT_TYPES, EVENT_TYPE_SAVED, EVENT_TYPE_REMOVED } from './taskActionTypes';
import { apiFetch, toInputDate } from '../helperFunction';


// Action creators for task management
export const fetchTaskState = () => {
    return async (dispatch) => {
        const tasks = await apiFetch("/api/tasks");
        const groups = await apiFetch("/api/groups");
        const notes = await apiFetch("/api/notes");
        // the types are only extra: the list works without them
        const eventTypes = await apiFetch("/api/event-types").catch(() => undefined);
        dispatch({ type: SET_TASK_STATE, payload: {tasks, groups, notes, eventTypes} });
    }
}

// The optional task fields (see the api): time of day, duration (an event's length, a task's
// planned time) and reminder in minutes, location, link and extra details, colour, whether the
// reminder also comes by mail, and task or event (kind) with the event's type
export const TASK_EXTRA_FIELDS = ['due_time', 'duration_minutes', 'reminder_minutes', 'location', 'link', 'details', 'repeat', 'color', 'reminder_email', 'kind', 'event_type_id'];
const extrasOf = (source) => Object.fromEntries(TASK_EXTRA_FIELDS
    .filter(field => source?.[field] !== undefined)
    .map(field => [field, source[field] === '' ? null : source[field]]));

// extras: { due_time: "09:30", duration_minutes: 45, location, ... } (all optional);
// returns the new task
export const addTask = (name, due, description, prio, activeGroupId = null, userId, extras = {}) => {
    return async (dispatch) => {
        const data = await apiFetch(
            "/api/tasks", {
                method: "POST",
                body: JSON.stringify({name, due: toInputDate(due) || null, description, prio, userId, ...extrasOf(extras)})
            }
        );

        // an event entered afterwards is over at once; a repeating one comes with its next one
        const { nextTask, ...created } = data;
        const { id } = created;

        if (activeGroupId) {
            await apiFetch(`/api/tasks/${id}/groups/${activeGroupId}`, {method: "POST"}
            );
        }


        const task = { ...created, group_ids: activeGroupId ? [activeGroupId] : [] };
        dispatch({
            type: ADD_TASK,
            // the groups it's in, for its labels (it was created before it went into the group)
            payload: task,
        });
        if (nextTask) dispatch({ type: ADD_TASK, payload: { ...nextTask, group_ids: task.group_ids } });
        return task;
    };
}

export const deleteTask = (taskId) => {
    return async (dispatch) => {
        await apiFetch(`/api/tasks/${taskId}`, {method: "DELETE"});
        
        dispatch({
            type: DELETE_TASK,
            payload: taskId,
        });
    };
}

export const updateTaskProps = (taskPropObject, task) => {
    const defaults = task;
    const params = {...defaults, ...taskPropObject};
    const {name, description, prio, done, id} = params;
    // the day as YYYY-MM-DD: sending the api's own timestamp back (e.g. ...T22:00:00Z for the
    // next day) would store the day before
    const due = toInputDate(params.due) || null;

    return async (dispatch) => {
        const data = await apiFetch(`/api/tasks/${params.id}`, {
            method: "PUT",
            // the optional fields too; without a day there is no time of day
            body: JSON.stringify({name, due, description, prio, done, id, ...extrasOf(params), ...(due ? {} : { due_time: null, repeat: null })})
        });

        const { nextTask, ...task } = data;
        dispatch({
            type: UPDATE_TASK_PROPS,
            payload: task,
        })
        // a repeating task that was just done: the server made the next one
        if (nextTask) dispatch({ type: ADD_TASK, payload: nextTask });
    };
}

// The task list again, e.g. when the app gets focus: friends may have changed shared tasks
export const refreshTasks = () => {
    return async (dispatch) => {
        const [tasks, eventTypes] = await Promise.all([
            apiFetch("/api/tasks"),
            apiFetch("/api/event-types").catch(() => null),
        ]);
        dispatch({ type: REFRESH_TASKS, payload: tasks });
        if (eventTypes) dispatch({ type: SET_EVENT_TYPES, payload: eventTypes });
    };
}

// ---------- event types ----------

// { name, color? } -> the new type (at the end of my list)
export const addEventType = (name, color = null) => async (dispatch) => {
    const type = await apiFetch("/api/event-types", { method: "POST", body: JSON.stringify({ name, color }) });
    dispatch({ type: EVENT_TYPE_SAVED, payload: type });
    return type;
};

// changes: { name?, color?, position? }
export const updateEventType = (id, changes) => async (dispatch) => {
    const type = await apiFetch(`/api/event-types/${id}`, { method: "PUT", body: JSON.stringify(changes) });
    dispatch({ type: EVENT_TYPE_SAVED, payload: type });
    return type;
};

// The type goes, its events stay (without a type)
export const deleteEventType = (id) => async (dispatch) => {
    await apiFetch(`/api/event-types/${id}`, { method: "DELETE" });
    dispatch({ type: EVENT_TYPE_REMOVED, payload: id });
};

// ---------- tasks shared with friends ----------

// Sends my task to friends (they get an invite); the task comes back with its sharedWith
export const shareTask = (taskId, userIds) => {
    return async (dispatch) => {
        const task = await apiFetch(`/api/tasks/${taskId}/shares`, {
            method: "POST",
            body: JSON.stringify({ userIds }),
        });
        dispatch({ type: TASK_REPLACED, payload: task });
        return task;
    };
}

// Tasks friends sent me that I haven't answered
export const fetchTaskInvites = () => {
    return async (dispatch) => {
        const invites = await apiFetch("/api/task-shares");
        dispatch({ type: SET_TASK_INVITES, payload: invites });
    };
}

// Accept: the task joins my list
export const acceptTaskInvite = (inviteId) => {
    return async (dispatch) => {
        const task = await apiFetch(`/api/task-shares/${inviteId}/accept`, { method: "POST" });
        dispatch({ type: TASK_INVITE_ACCEPTED, payload: { inviteId, task } });
        return task;
    };
}

export const declineTaskInvite = (inviteId) => {
    return async (dispatch) => {
        await apiFetch(`/api/task-shares/${inviteId}`, { method: "DELETE" });
        dispatch({ type: TASK_INVITE_REMOVED, payload: inviteId });
    };
}

// A task a friend shared with me: take it out of my list (it stays theirs)
export const leaveTask = (task) => {
    return async (dispatch) => {
        await apiFetch(`/api/task-shares/${task.shareId}`, { method: "DELETE" });
        dispatch({ type: DELETE_TASK, payload: task.id });
    };
}

// My task: take it back from one friend (also a pending invite)
export const unshareTask = (taskId, shareId) => {
    return async (dispatch) => {
        await apiFetch(`/api/task-shares/${shareId}`, { method: "DELETE" });
        dispatch({ type: TASK_SHARE_REMOVED, payload: { taskId, shareId } });
    };
}

export const selectTaskInviteCount = (state) => state.task.invites.length;

// Someone else's task shared with me (as opposed to my own)
export const isSharedWithMe = (task) => Boolean(task?.owner);

// color: one of TASK_COLORS or null
export const addGroup = (name, description, color = null) => {
    return async (dispatch) => {
        const data = await apiFetch("/api/groups", {
            method: "POST", body: JSON.stringify({name, description, color})
        });

    
        dispatch({
            type: ADD_GROUP,
            payload: data,
        });
        return data;
    };
}

export const deleteGroup = (groupId) => {
    return async (dispatch) => {
        await apiFetch(`/api/groups/${groupId}`, {method: "DELETE"});

        dispatch({
            type: DELETE_GROUP,
            payload: groupId,
        })
    };
}

export const editDisplaygroup = (group, groupToDisplayId) => {
    return async (dispatch) => {
        // a shared session's group: its tasks come from the session (TaskContainer reads them live)
        if (group.shared && groupToDisplayId !== group.id) {
            dispatch({ type: EDIT_DISPLAYGROUP, payload: { group, tasks: [] } });
            return;
        }
        if(groupToDisplayId === group.id) {
            const tasks = await apiFetch(`/api/tasks`, {method: "GET",});
            dispatch({
                type: EDIT_DISPLAYGROUP,
                payload: {group: {}, tasks},
            });
        } else{
            const tasks = await apiFetch(`/api/groups/${group.id}/tasks`, {method: "GET",});
            dispatch({
                type: EDIT_DISPLAYGROUP,
                payload: {group, tasks},
            });
        }
    };
}

export const addGroupTasks = (groupId, taskId) => {
    return async (dispatch) => {
        await apiFetch(`/api/tasks/${taskId}/groups/${groupId}`, {method: "POST"});
        dispatch({
            type: ADD_GROUP_TASKS,
            payload: { taskId, groupId },
        });
    };
}

export const deleteGroupTasks = (taskId, groupId) => {
    return async (dispatch) => {
        await apiFetch(`/api/task-groups/${taskId}/${groupId}`, {method: "DELETE"});
        dispatch({
            type: DELETE_GROUP_TASKS,
            payload: { taskId, groupId },
        });
    };
}

export const editGroup = (groupId, groupObj, group) => {
    const defaultObj = group;

    const fetchObj = {...defaultObj, ...groupObj};

    return async (dispatch) => {
        const data = await apiFetch(`/api/groups/${groupId}`, 
            {method: "PUT", body: JSON.stringify(fetchObj)}
        );

        dispatch({
            type: EDIT_GROUP,
            payload: data,
        });
    }
}

export const createNote = (taskId, note) => {
    return async (dispatch) => {
        const data = await apiFetch(`/api/tasks/${taskId}/notes`, {
            method: "POST",
            body: JSON.stringify({ content: note })
        });


        dispatch({
            type: CREATE_NOTE,
            payload: data ,
        });
    };
};

export const deleteNote = (taskId, noteId) => {
    return async (dispatch) => {
        await apiFetch(`/api/notes/${noteId}`, {method: "DELETE"});

        dispatch({
            type: DELETE_NOTE,
            payload: { taskId, noteId },
        });
    };
};

export const editNote = (taskId, noteId, noteContent) => {
    return async (dispatch) => {
        const data = await apiFetch(`/api/notes/${noteId}`, {
            method: "PUT",
            body: JSON.stringify({ taskId, content: noteContent })
        });


        dispatch({
            type: EDIT_NOTE,
            payload: data,
        });
    };
};

export const getNotes = (taskId) => {
    return async (dispatch) => {
        const notes = await apiFetch(`/api/notes?taskId=${taskId}`, {method: "GET"});

        dispatch({
            type: GET_NOTES,
            payload: { taskId, notes },
        });
    };
};

