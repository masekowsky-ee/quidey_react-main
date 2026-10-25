import { ADD_TASK, DELETE_TASK, ADD_GROUP, DELETE_GROUP, ADD_GROUP_TASKS, DELETE_GROUP_TASKS, EDIT_DISPLAYGROUP, EDIT_GROUP, CREATE_NOTE, DELETE_NOTE, SET_TASK_STATE, UPDATE_TASK_PROPS, EDIT_NOTE, REFRESH_TASKS, TASK_REPLACED, SET_TASK_INVITES, TASK_INVITE_ACCEPTED, TASK_INVITE_REMOVED, TASK_SHARE_REMOVED, SET_EVENT_TYPES, EVENT_TYPE_SAVED, EVENT_TYPE_REMOVED } from './taskActionTypes';

// task.group_ids: the groups a task is in (for its labels)
const withGroupIds = (task, change) => ({ ...task, group_ids: change(task.group_ids ?? []) });

// The fields of an updated task the api sent back. null counts (a cleared description
// or date), a field that wasn't sent keeps its old value.
const UPDATABLE = [
    'name', 'due', 'description', 'prio', 'done',
    'due_time', 'duration_minutes', 'reminder_minutes', 'location', 'link', 'details',
    'repeat', 'repeat_left', 'repeat_skip', 'completed_at', 'color', 'reminder_email', 'kind', 'event_type_id', 'event_type',
    'group_ids', 'isOwner', 'owner', 'shareId', 'sharedWith',
];
const applyUpdate = (task, row) => {
    const changes = {};
    for (const key of UPDATABLE) if (row[key] !== undefined) changes[key] = row[key];
    return { ...task, ...changes };
};

// Changes one task (by id) in the list and in the shown group
const mapTask = (state, id, change) => ({
    ...state,
    tasks: state.tasks.map(task => task.id === id ? change(task) : task),
    groupToDisplay: {
        ...state.groupToDisplay,
        tasks: state.groupToDisplay.tasks.map(task => task.id === id ? change(task) : task),
    },
});

const showingAllTasks = (state) => !state.groupToDisplay.group?.id || state.groupToDisplay.group.name === 'all';

const initialState = {
    tasks: [],
    groups: [],
    notes: [],
    groupToDisplay: {group: {}, tasks: []},
    // tasks friends sent me, not answered yet: [{ id, createdAt, from, task }]
    invites: [],
    // whether the invites came from the server yet (see useLiveLists)
    invitesLoaded: false,
    // my event types in their order: [{ id, name, color, position }]
    eventTypes: [],
    // whether my tasks came from the server yet (until then Home shows their shapes, not "nothing open")
    loaded: false,
};

// A type's new name or colour also shows on the events that have it
const withEventType = (task, type) =>
    task.event_type_id === type.id ? { ...task, event_type: { id: type.id, name: type.name, color: type.color } } : task;

const taskReducer = (state = initialState, action) => {
    switch (action.type) {
        case SET_EVENT_TYPES:
            return { ...state, eventTypes: action.payload };
        case EVENT_TYPE_SAVED: {
            const type = action.payload;
            const known = state.eventTypes.some(t => t.id === type.id);
            return {
                ...state,
                eventTypes: known ? state.eventTypes.map(t => (t.id === type.id ? type : t)) : [...state.eventTypes, type],
                tasks: state.tasks.map(task => withEventType(task, type)),
                groupToDisplay: { ...state.groupToDisplay, tasks: state.groupToDisplay.tasks.map(task => withEventType(task, type)) },
            };
        }
        case EVENT_TYPE_REMOVED: {
            // its events stay, without a type
            const untyped = (task) => (task.event_type_id === action.payload ? { ...task, event_type_id: null, event_type: null } : task);
            return {
                ...state,
                eventTypes: state.eventTypes.filter(t => t.id !== action.payload),
                tasks: state.tasks.map(untyped),
                groupToDisplay: { ...state.groupToDisplay, tasks: state.groupToDisplay.tasks.map(untyped) },
            };
        }
        case REFRESH_TASKS: {
            const fresh = new Map(action.payload.map(task => [task.id, task]));
            return {
                ...state,
                tasks: action.payload,
                groupToDisplay: {
                    ...state.groupToDisplay,
                    // a group keeps showing its tasks, with their new values; gone ones drop out
                    tasks: showingAllTasks(state)
                        ? action.payload
                        : state.groupToDisplay.tasks.filter(task => fresh.has(task.id)).map(task => fresh.get(task.id)),
                },
            };
        }
        case TASK_REPLACED:
            return mapTask(state, action.payload.id, task => applyUpdate(task, action.payload));
        case SET_TASK_INVITES:
            return { ...state, invites: action.payload, invitesLoaded: true };
        case TASK_INVITE_REMOVED:
            return { ...state, invites: state.invites.filter(invite => invite.id !== action.payload) };
        case TASK_INVITE_ACCEPTED: {
            const { inviteId, task } = action.payload;
            const known = state.tasks.some(t => t.id === task.id);
            return {
                ...state,
                invites: state.invites.filter(invite => invite.id !== inviteId),
                tasks: known ? state.tasks : [...state.tasks, task],
                groupToDisplay: !known && showingAllTasks(state)
                    ? { ...state.groupToDisplay, tasks: [...state.groupToDisplay.tasks, task] }
                    : state.groupToDisplay,
            };
        }
        case TASK_SHARE_REMOVED: {
            const { taskId, shareId } = action.payload;
            return mapTask(state, taskId, task => ({
                ...task,
                sharedWith: (task.sharedWith ?? []).filter(share => share.shareId !== shareId),
            }));
        }
        case SET_TASK_STATE: 
            return {
                ...state,
                ...(action.payload.eventTypes ? { eventTypes: action.payload.eventTypes } : {}),
                tasks: action.payload.tasks,
                groups:  action.payload.groups,
                groupToDisplay: {...state.groupToDisplay, tasks: action.payload.tasks},
                notes: action.payload.notes,
                loaded: true,
            }
        case ADD_TASK: 
            return {
                ...state,
                tasks: [...state.tasks, action.payload],
                groupToDisplay: {...state.groupToDisplay, tasks: [...state.groupToDisplay.tasks, action.payload]}
            };
        case DELETE_TASK: 
            return {
                ...state,
                tasks: state.tasks.filter(task => task.id !== action.payload),
                groupToDisplay: {...state.groupToDisplay, tasks: state.groupToDisplay.tasks.filter(task => task.id !== action.payload)}
            };
        case UPDATE_TASK_PROPS:
            return {
                ...state,
                tasks: state.tasks.map(task => task.id === action.payload.id ? applyUpdate(task, action.payload) : task),
                groupToDisplay: {
                    ...state.groupToDisplay,
                    tasks: state.groupToDisplay.tasks.map(task =>
                        task.id === action.payload.id ? applyUpdate(task, action.payload) : task),
                }
            }
        case ADD_GROUP:
            return {
                ...state,
                groups: [...state.groups, {id: action.payload.id, name: action.payload.name, description: action.payload.description, color: action.payload.color ?? null}],
            }
        case DELETE_GROUP:
            return {
                ...state,
                tasks: state.tasks.map(task => task.group_ids?.includes(action.payload)
                    ? withGroupIds(task, ids => ids.filter(id => id !== action.payload))
                    : task),
                groups: state.groups.filter(group => group.id !== action.payload),
                groupToDisplay: ({...state.groupToDisplay.group.id === action.payload ? {group: {}, tasks: state.tasks} : state.groupToDisplay})
            }
        case EDIT_DISPLAYGROUP:
            return {
                ...state,
                groupToDisplay: {group: action.payload.group, tasks: action.payload.tasks},
            }

        case ADD_GROUP_TASKS: {
            const { taskId, groupId } = action.payload;
            const showing = state.groupToDisplay.group?.id === groupId;
            // the label (and its colour dot) shows at once, also in the list on screen
            const next = mapTask(state, taskId, t => withGroupIds(t, ids => (ids.includes(groupId) ? ids : [...ids, groupId])));
            const task = next.tasks.find(t => t.id === taskId);
            return showing && task && !next.groupToDisplay.tasks.some(t => t.id === taskId)
                ? { ...next, groupToDisplay: { ...next.groupToDisplay, tasks: [...next.groupToDisplay.tasks, task] } }
                : next;
        }
        case DELETE_GROUP_TASKS: {
            // payload: { taskId, groupId }, or just the task id for the group that is shown
            const { taskId, groupId } = typeof action.payload === 'object'
                ? action.payload
                : { taskId: action.payload, groupId: state.groupToDisplay.group?.id };
            const showing = state.groupToDisplay.group?.id === groupId;
            const next = mapTask(state, taskId, t => withGroupIds(t, ids => ids.filter(id => id !== groupId)));
            return showing
                ? { ...next, groupToDisplay: { ...next.groupToDisplay, tasks: next.groupToDisplay.tasks.filter(t => t.id !== taskId) } }
                : next;
        }
        case EDIT_GROUP:
            return {
                ...state,
                groups: state.groups.map(group => group.id === action.payload.id ?
                    action.payload
                    : group),
                groupToDisplay: {group: action.payload, tasks: state.groupToDisplay.tasks}
            };
        case CREATE_NOTE:
            return {
                ...state,
                notes: [...state.notes, action.payload],
            }
        case DELETE_NOTE:
            return {
                ...state,
                notes: state.notes.filter(note => note.id !== action.payload.noteId),
            }
        case EDIT_NOTE:
            return {
                ...state,
                // Replace the matching note with the row returned by the API
                notes: state.notes.map(note => note.id === action.payload.id ? action.payload : note),
            }

        default:
            return state;
    }
}

export default taskReducer;