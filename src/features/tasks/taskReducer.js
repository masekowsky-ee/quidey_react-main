import { ADD_TASK, DELETE_TASK, UPDATE_TASK_TITLE, UPDATE_TASK_DESCRIPTION, UPDATE_TASK_DUE, UPDATE_TASK_COMPLETED, UPDATE_TASK_PRIORITY, ADD_GROUP, DELETE_GROUP, ADD_GROUP_TASKS, DELETE_GROUP_TASKS, EDIT_DISPLAYGROUP, EDIT_GROUP_DESCRIPTION, CREATE_NOTE, DELETE_NOTE } from './taskActionTypes';

const initialState = {
    tasks: [
        { index: 0, name: 'test-task', due: '2026-06-25', description: 'test-description', groups: ['all', 'prio'], prio: 34, done: false, notes: [] },
        { index: 1, name: 'test-task1', due: '2026-06-28', description: '', groups: ['all'], prio: 27, done: false, notes: [] },
        { index: 2, name: 'test-task2', due: '2026-07-07', description: 'test-description', groups: ['all'], prio: 45, done: false, notes: [] },
        { index: 3, name: 'test-task3', due: '2026-09-12', description: '', groups: ['all'], prio: 23, done: true, notes: [] },
        { index: 4, name: 'test-task4', due: '2026-05-12', description: 'Overdue display test', groups: ['all'], prio: 73, done: false, notes: [] },
    ],
    taskIndexCounter: 5,
    groups: [
        { name: 'all', description: 'All tasks are in this group by default'},
        { name: 'prio', description: 'Priority tasks'},
        { name: 'test-group', description: 'Test group for demonstration'},
        { name: 'test-description', description: ''},
    ],
    groupToDisplayName: 'all',
};

const taskReducer = (state = initialState, action) => {
    switch (action.type) {
        case ADD_TASK: 
            return {
                ...state,
                tasks: [...state.tasks, action.payload],
                taskIndexCounter: state.taskIndexCounter + 1,
            };
        case DELETE_TASK: 
            return {
                ...state,
                tasks: state.tasks.filter(task => task.index !== action.payload),
            };
        case UPDATE_TASK_TITLE:
            return {
                ...state,
                tasks: state.tasks.map(task => task.index === action.payload.taskIndex ? {...task, name: action.payload.value} : task)
            }
        case UPDATE_TASK_DESCRIPTION:
            return {
                ...state,
                tasks: state.tasks.map(task => task.index === action.payload.taskIndex ? {...task, description: action.payload.value} : task)
            }
        case UPDATE_TASK_DUE:
            return {
                ...state,
                tasks: state.tasks.map(task => task.index === action.payload.taskIndex ? {...task, due: action.payload.value} : task)
            }
        case UPDATE_TASK_COMPLETED:
            return {
                ...state,
                tasks: state.tasks.map(task => task.index === action.payload ? {...task, done: !task.done} : task)
            }
        case UPDATE_TASK_PRIORITY:
            return {
                ...state,
                tasks: state.tasks.map(task => task.index === action.payload.taskIndex ? {...task, prio: action.payload.value} : task)
            }
        case ADD_GROUP:
            return {
                ...state,
                groups: [...state.groups, action.payload],
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
                groupToDisplayName: action.payload,
            }
        case ADD_GROUP_TASKS:
            return {
                ...state,
                tasks: state.tasks.map(task => task.index === action.payload.taskIndex ? {...task, groups: [...task.groups, action.payload.groupName]} : task)
            };
        case DELETE_GROUP_TASKS:
            return {
                ...state,
                tasks: state.tasks.map(task => task.index === action.payload.taskIndex ? 
                    {...task, groups: task.groups.filter(g => g !== action.payload.groupName)} 
                    : task),
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
                tasks: state.tasks.map(task => task.index === action.payload.taskIndex ?
                    {...task, notes: [...task.notes, action.payload.note]}
                    : task),
            }
        case DELETE_NOTE:
            return {
                ...state,
                tasks: state.tasks.map(task => task.index === action.payload.taskIndex ?
                    {...task, notes: task.notes.filter((note) => note.index !== action.payload.noteIndex)}
                    : task),
            }


        default:
            return state;
    }
}

export default taskReducer;