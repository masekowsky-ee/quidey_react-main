import { ADD_TASK, DELETE_TASK, ADD_GROUP, DELETE_GROUP, DELETE_GROUP_TASKS, EDIT_DISPLAYGROUP, EDIT_GROUP, CREATE_NOTE, DELETE_NOTE, SET_TASK_STATE, UPDATE_TASK_PROPS } from './taskActionTypes';

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
                groups: state.groups.filter(group => group.id !== action.payload),
                groupToDisplay: ({...state.groupToDisplay.group.id === action.payload ? {group: {}, tasks: state.tasks} : state.groupToDisplay})
            }
        case EDIT_DISPLAYGROUP:
            return {
                ...state,
                groupToDisplay: {group: action.payload.group, tasks: action.payload.tasks},
            }

        case DELETE_GROUP_TASKS:
            return {
                ...state,
                groupToDisplay: {...state.groupToDisplay, tasks: state.groupToDisplay.tasks.filter(task => task.id !== action.payload)}
            };
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