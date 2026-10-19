import { ADD_TASK, DELETE_TASK, ADD_GROUP, DELETE_GROUP, ADD_GROUP_TASKS, DELETE_GROUP_TASKS, EDIT_DISPLAYGROUP, EDIT_GROUP, CREATE_NOTE, DELETE_NOTE, SET_TASK_STATE, UPDATE_TASK_PROPS, EDIT_NOTE } from './taskActionTypes';

// task.group_ids: the groups a task is in (for its labels)
const withGroupIds = (task, change) => ({ ...task, group_ids: change(task.group_ids ?? []) });

const initialState = {
    tasks: [],
    groups: [],
    notes: [],
    groupToDisplay: {group: {}, tasks: []},
};

const taskReducer = (state = initialState, action) => {
    switch (action.type) {
        case SET_TASK_STATE: 
            return {
                ...state,
                tasks: action.payload.tasks,
                groups:  action.payload.groups,
                groupToDisplay: {...state.groupToDisplay, tasks: action.payload.tasks},
                notes: action.payload.notes,
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
                tasks: state.tasks.map(
                    task => task.id === action.payload.id ? 
                    {...task,
                        name: action.payload.name ?? task.name,
                        due: action.payload.due ?? task.due,
                        description: action.payload.description ?? task.description, 
                        prio: action.payload.prio ?? task.prio, 
                        done: action.payload.done ?? task.done
                    } : task),
                groupToDisplay: {
                    ...state.groupToDisplay, 
                    tasks: state.groupToDisplay.tasks.map(task =>
                        task.id === action.payload.id ? {...task,
                            name: action.payload.name ?? task.name,
                            due: action.payload.due ?? task.due,
                            description: action.payload.description ?? task.description, 
                            prio: action.payload.prio ?? task.prio, 
                            done: action.payload.done ?? task.done
                        } : task
                )}
            }
        case ADD_GROUP:
            return {
                ...state,
                groups: [...state.groups, {id: action.payload.id, name: action.payload.name, description: action.payload.description}],
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
            const task = state.tasks.find(t => t.id === taskId);
            const showing = state.groupToDisplay.group?.id === groupId;
            return {
                ...state,
                tasks: state.tasks.map(t => t.id === taskId
                    ? withGroupIds(t, ids => (ids.includes(groupId) ? ids : [...ids, groupId]))
                    : t),
                groupToDisplay: showing && task && !state.groupToDisplay.tasks.some(t => t.id === taskId)
                    ? { ...state.groupToDisplay, tasks: [...state.groupToDisplay.tasks, task] }
                    : state.groupToDisplay,
            };
        }
        case DELETE_GROUP_TASKS: {
            // payload: { taskId, groupId }, or just the task id for the group that is shown
            const { taskId, groupId } = typeof action.payload === 'object'
                ? action.payload
                : { taskId: action.payload, groupId: state.groupToDisplay.group?.id };
            const showing = state.groupToDisplay.group?.id === groupId;
            return {
                ...state,
                tasks: state.tasks.map(t => t.id === taskId ? withGroupIds(t, ids => ids.filter(id => id !== groupId)) : t),
                groupToDisplay: showing
                    ? { ...state.groupToDisplay, tasks: state.groupToDisplay.tasks.filter(t => t.id !== taskId) }
                    : state.groupToDisplay,
            };
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