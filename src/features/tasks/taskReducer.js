import { ADD_TASK, DELETE_TASK, UPDATE_TASK_TITLE, UPDATE_TASK_DESCRIPTION, UPDATE_TASK_DUE, UPDATE_TASK_COMPLETED, UPDATE_TASK_PRIORITY, ADD_GROUP, DELETE_GROUP, DELETE_GROUP_TASKS, EDIT_DISPLAYGROUP, EDIT_GROUP_DESCRIPTION, CREATE_NOTE, DELETE_NOTE, SET_TASK_STATE } from './taskActionTypes';

const initialState = {
    tasks: [],
    groups: [],
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
            }
        case ADD_TASK: 
            return {
                ...state,
                tasks: [...state.tasks, ({id: action.payload.id, name: action.payload.name, due: action.payload.due, description: action.payload.description, prio: action.payload.prio, })],
            };
        case DELETE_TASK: 
            return {
                ...state,
                tasks: state.tasks.filter(task => task.id !== action.payload),
                groupToDisplay: {...state.groupToDisplay, tasks: state.groupToDisplay.tasks.filter(task => task.id !== action.payload)}
            };
        case UPDATE_TASK_TITLE:
            return {
                ...state,
                tasks: state.tasks.map(task => task.id === action.payload.taskId ? {...task, name: action.payload.value} : task)
            }
        case UPDATE_TASK_DESCRIPTION:
            return {
                ...state,
                tasks: state.tasks.map(task => task.id === action.payload.taskId ? {...task, description: action.payload.value} : task)
            }
        case UPDATE_TASK_DUE:
            return {
                ...state,
                tasks: state.tasks.map(task => task.id === action.payload.taskId ? {...task, due: action.payload.value} : task)
            }
        case UPDATE_TASK_COMPLETED:
            return {
                ...state,
                tasks: state.tasks.map(task => task.id === action.payload ? {...task, done: !task.done} : task)
            }
        case UPDATE_TASK_PRIORITY:
            return {
                ...state,
                tasks: state.tasks.map(task => task.id === action.payload.taskId ? {...task, prio: action.payload.value} : task)
            }
        case ADD_GROUP:
            return {
                ...state,
                groups: [...state.groups, {id: action.payload.id, name: action.payload.name, description: action.payload.description}],
            }
        case DELETE_GROUP:
            return {
                ...state,
                groups: state.groups.filter(group => group.name !== action.payload),
                tasks: state.tasks.map(task => ({
                    ...task,
                    groups: task.groups.filter(groupName => groupName !== action.payload)
                }))
            }
        case EDIT_DISPLAYGROUP:
            return {
                ...state,
                groupToDisplay: action.payload,
            }

        case DELETE_GROUP_TASKS:
            return {
                ...state,
                groupToDisplay: {...state.groupToDisplay, tasks: state.groupToDisplay.tasks.filter(task => task.id !== action.payload)}
            };
        case EDIT_GROUP_DESCRIPTION:
            return {
                ...state,
                groups: state.groups.map(group => group.name === action.payload.groupName ?
                    {...group, description: action.payload.value}
                    : group),
            };
        case CREATE_NOTE:
            return {
                ...state,
                tasks: state.tasks.map(task => task.id === action.payload.taskId ?
                    {...task, notes: [...task.notes, action.payload.note]}
                    : task),
            }
        case DELETE_NOTE:
            return {
                ...state,
                tasks: state.tasks.map(task => task.id === action.payload.taskId ?
                    {...task, notes: task.notes.filter((note) => note.id !== action.payload.noteId)}
                    : task),
            }


        default:
            return state;
    }
}

export default taskReducer;