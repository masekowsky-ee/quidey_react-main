import { describe, it, expect } from 'vitest'
import { groupSittings, sittingGapMs } from '../features/stats/sittings'

// a saved session as GET /api/sessions returns it: started at `start` (local time), `minutes` long
const session = (id, start, minutes, tasks = []) => ({
    id, date: new Date(start).toISOString(), totalTime: minutes * 60, group: 'all',
    workedTasks: tasks.map(([taskId, name, taskMinutes]) => ({ id: taskId, name, time: taskMinutes * 60 })),
})
const GAP = 20 * 60 * 1000

describe('sittings: Pomodoro rounds of one run as one row', () => {
    it('rounds with breaks between them make one sitting, newest first, with the tasks added up', () => {
        const rows = groupSittings([
            session(3, '2026-11-09T10:00:00', 25, [[1, 'Essay', 25]]),
            session(2, '2026-11-09T09:30:00', 25, [[1, 'Essay', 15], [2, 'Vokabeln', 10]]),
            session(1, '2026-11-09T08:00:00', 25, [[2, 'Vokabeln', 25]]),
        ], GAP)
        expect(rows.map(r => r.sessions.map(s => s.id))).toEqual([[2, 3], [1]])
        const [sitting] = rows
        expect(sitting.rounds).toBe(2)
        expect(sitting.totalTime).toBe(50 * 60)
        expect(sitting.date).toEqual(new Date('2026-11-09T09:30:00'))
        expect(sitting.workedTasks).toEqual([
            { id: 1, name: 'Essay', time: 40 * 60 },
            { id: 2, name: 'Vokabeln', time: 10 * 60 },
        ])
    })

    it('a longer pause starts a new sitting, and so does a new day', () => {
        const rows = groupSittings([
            session(3, '2026-11-10T00:05:00', 25),
            session(2, '2026-11-09T23:30:00', 25),
            session(1, '2026-11-09T22:00:00', 25),
        ], GAP)
        expect(rows.map(r => r.sessions.map(s => s.id))).toEqual([[3], [2], [1]])
    })

    it('runs under a minute are left out', () => {
        const rows = groupSittings([session(2, '2026-11-09T09:00:00', 0.5), session(1, '2026-11-09T08:00:00', 30)], GAP)
        expect(rows.map(r => r.sessions.map(s => s.id))).toEqual([[1]])
    })

    it('the pause allowed is the longest break plus five minutes', () => {
        expect(sittingGapMs({ focus: 25, short: 5, long: 15, every: 4 })).toBe(20 * 60 * 1000)
    })
})
