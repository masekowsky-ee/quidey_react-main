// A solo session as GET /api/sessions returns it, with an own task and one from a shared session
export const WORKED_SESSIONS_FIXTURE = [
    {
        id: 1,
        totalTime: 1800,
        group: 'all',
        date: '2026-10-18T14:00:00Z',
        workedTasks: [
            { id: 10, name: 'Own task', time: 600 },
            { id: 'shared-12', name: 'Slides', time: 1200, shared: { sessionId: 5, sessionName: 'Lerngruppe' } },
        ],
    },
]
