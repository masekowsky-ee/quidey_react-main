// The colours a task can have (the api knows the same list). The colour values live in
// index.css ([data-task-color], one tone per theme); components only set the attribute.
export const TASK_COLORS = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'violet', 'pink'];

// The data-task-color attribute of a task's row or chip: its colour while it's open, nothing
// when it has none or is done (done tasks are greyed out like before)
export const taskColorAttr = (task) =>
    !task?.done && TASK_COLORS.includes(task?.color) ? task.color : undefined;
