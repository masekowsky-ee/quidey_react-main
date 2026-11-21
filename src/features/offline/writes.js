// The writes that work offline: what offline.js may keep in the outbox, and what the app is told
// meanwhile. They belong to the task and focus-session API (features/tasks, features/session).
//
// What must change together when one is added or one's route changes:
//  - the entry here (pattern, creates, localAnswer, list + applyToList),
//  - a test in __tests__/offline.test.js,
//  - the backend: the route must be idempotent (POST routes get the middleware by being under
//    /api/tasks or /api/sessions in the backend's app.use).
//
// An entry: { name, method, pattern, creates? (a new thing: gets a temporary id and an
// Idempotency-Key from the first try), localAnswer({ url, body, id, now, pattern }) = what the
// server would answer, as far as the app uses it, list = the saved read that changes with the
// write, applyToList(data, answer) = that list's new content }.
const ID = '([^/?]+)';
const idOf = (task) => String(task.id);

const WRITES = [
    {
        name: 'task:add', method: 'POST', pattern: /^\/api\/tasks$/, creates: true,
        localAnswer: ({ body, id, now }) => ({ done: false, completed_at: null, created_at: now, isOwner: true, group_ids: [], ...body, id, pending: true }),
        list: '/api/tasks',
        applyToList: (data, answer) => [...data, answer],
    },
    {
        name: 'task:edit', method: 'PUT', pattern: new RegExp(`^/api/tasks/${ID}$`),
        localAnswer: ({ url, body, now, pattern }) => {
            const done = body.done === true;
            return { ...body, id: body.id ?? url.match(pattern)[1], ...(done ? { completed_at: now } : {}), pending: true };
        },
        list: '/api/tasks',
        applyToList: (data, answer) => data.map((task) => (idOf(task) === String(answer.id) ? { ...task, ...answer } : task)),
    },
    {
        name: 'task:delete', method: 'DELETE', pattern: new RegExp(`^/api/tasks/${ID}(\\?.*)?$`),
        localAnswer: ({ url, pattern }) => ({ deletedIds: [url.match(pattern)[1]] }),
        list: '/api/tasks',
        applyToList: (data, answer) => data.filter((task) => !answer.deletedIds.map(String).includes(idOf(task))),
    },
    { name: 'task:group-add', method: 'POST', pattern: new RegExp(`^/api/tasks/${ID}/groups/${ID}$`), localAnswer: () => ({}) },
    { name: 'task:group-remove', method: 'DELETE', pattern: new RegExp(`^/api/tasks/${ID}/groups/${ID}$`), localAnswer: () => ({}) },
    {
        name: 'session:save', method: 'POST', pattern: /^\/api\/sessions$/, creates: true,
        localAnswer: ({ body, id }) => ({ ...body, id, pending: true }),
        list: '/api/sessions',
        applyToList: (data, answer) => [answer, ...data],
    },
];

export function matchWrite(url, method = 'GET') {
    const m = method.toUpperCase();
    return WRITES.find((write) => write.method === m && write.pattern.test(url));
}
