import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeStore } from './helpers/store'
import { apiFetch } from '../features/api/api'
import { fetchSubjects, fetchGoal } from '../features/study/study'
import { applyAction, prepareActions } from '../features/assistant/applyAction'
import { describeStudy, loadStudyContext } from '../features/assistant/studyActions'

vi.mock('../features/api/api', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const BASE = '/api/tester/study'
const GOAL = { id: 10, subjectId: 3, kind: 'exam', name: 'Klausur', due: '2026-12-12', dueTime: null, planMode: 'slots', status: 'active', grade: null, parts: [{ id: 100, name: 'Zellen', estimateMinutes: 60, doneAt: null }], sessions: [{ taskId: 900 }, { taskId: 901 }] }
const calls = (path, method) => apiFetch.mock.calls.filter(([url, o]) => url.split('?')[0] === path && (o?.method ?? 'GET') === method)
const body = (call) => JSON.parse(call[1].body)

let store, navigate, windows
const deps = (extra = {}) => ({ dispatch: store.dispatch, getState: store.getState, navigate, ...extra })

beforeEach(async () => {
    windows = [{ weekday: 1, start: '16:00', end: '18:00' }]
    apiFetch.mockReset()
    apiFetch.mockImplementation(async (url, options = {}) => {
        const method = options.method ?? 'GET'
        const data = options.body ? JSON.parse(options.body) : null
        if (url === `${BASE}/subjects` && method === 'GET') return [{ id: 3, name: 'Biologie', color: 'green' }, { id: 4, name: 'Alt', archived: true }]
        if (url === `${BASE}/subjects` && method === 'POST') return { id: 30, ...data }
        if (url.startsWith(`${BASE}/subjects/`)) return { id: 3, ...data }
        if (url === `${BASE}/goals` && method === 'POST') return { ...GOAL, id: 50, ...data }
        if (url.startsWith(`${BASE}/goals/`) && url.endsWith('/parts')) return { id: 120, ...data }
        if (url.startsWith(`${BASE}/goals/`) && method === 'GET') return GOAL
        if (url.startsWith(`${BASE}/goals/`)) return { ...GOAL, ...(data ?? {}) }
        if (url.startsWith(`${BASE}/parts/`)) return { id: 100, ...(data ?? {}) }
        if (url === `${BASE}/settings`) return { windows, sessionMinutes: 45, ...(data ?? {}) }
        if (url === `${BASE}/plan`) return { goals: [] }
        return {}
    })
    store = makeStore()
    navigate = vi.fn()
    await store.dispatch(fetchSubjects())
    await store.dispatch(fetchGoal(10))
    apiFetch.mockClear()
})

describe('applying study actions', () => {
    it('creates a subject and undoes it', async () => {
        const { undo } = await applyAction({ type: 'study_create', target: 'subject', name: 'Chemie', emoji: 'C' }, deps())
        expect(body(calls(`${BASE}/subjects`, 'POST')[0])).toEqual({ name: 'Chemie', emoji: 'C' })
        await undo()
        expect(calls(`${BASE}/subjects/30`, 'DELETE')).toHaveLength(1)
    })

    it('a goal reuses an existing subject by name, else makes it first; no parts means "none"', async () => {
        const goal = { type: 'study_create', target: 'goal', name: 'Test', kind: 'exam', due: '2026-12-01', parts: [{ name: 'A', estimateMinutes: 30 }] }
        await applyAction({ ...goal, subjectName: 'biologie' }, deps())
        expect(calls(`${BASE}/subjects`, 'POST')).toHaveLength(0)
        expect(body(calls(`${BASE}/goals`, 'POST')[0])).toMatchObject({ subjectId: 3, planMode: 'slots', parts: [{ name: 'A', estimateMinutes: 30 }] })

        apiFetch.mockClear()
        const { undo } = await applyAction({ ...goal, subjectName: 'Physik', parts: [] }, deps())
        expect(body(calls(`${BASE}/subjects`, 'POST')[0])).toEqual({ name: 'Physik' })
        expect(body(calls(`${BASE}/goals`, 'POST')[0])).toMatchObject({ subjectId: 30, planMode: 'none', parts: [] })
        await undo()
        expect(calls(`${BASE}/goals/50`, 'DELETE')).toHaveLength(1)
        expect(calls(`${BASE}/subjects/30`, 'DELETE')).toHaveLength(1)
    })

    it('a goal with topics plans in days without study windows', async () => {
        windows = []
        await applyAction({ type: 'study_create', target: 'goal', subjectId: 3, name: 'T', kind: 'exam', due: '2026-12-01', parts: [{ name: 'A', estimateMinutes: 30 }] }, deps())
        expect(body(calls(`${BASE}/goals`, 'POST')[0]).planMode).toBe('days')
    })

    it('creates a part', async () => {
        const { undo } = await applyAction({ type: 'study_create', target: 'part', goalId: 10, name: 'Genetik', estimateMinutes: 45 }, deps())
        expect(body(calls(`${BASE}/goals/10/parts`, 'POST')[0])).toEqual({ name: 'Genetik', estimateMinutes: 45 })
        await undo()
        expect(calls(`${BASE}/parts/120`, 'DELETE')).toHaveLength(1)
    })

    it('a goal done with a grade is one PATCH', async () => {
        await applyAction({ type: 'study_update', target: 'goal', id: 10, changes: { status: 'done', grade: 2 } }, deps())
        const patches = calls(`${BASE}/goals/10`, 'PATCH')
        expect(patches).toHaveLength(1)
        expect(body(patches[0])).toEqual({ status: 'done', grade: 2 })
    })

    it('a part done sends doneAt, reopened sends null', async () => {
        await applyAction({ type: 'study_update', target: 'part', id: 100, changes: { done: true } }, deps())
        await applyAction({ type: 'study_update', target: 'part', id: 100, changes: { done: false, name: 'Neu' } }, deps())
        const [first, second] = calls(`${BASE}/parts/100`, 'PATCH').map(body)
        expect(first.doneAt).toBeTruthy()
        expect(first.done).toBeUndefined()
        expect(second).toEqual({ doneAt: null, name: 'Neu' })
    })

    it('updates a subject and the settings in one request each', async () => {
        await applyAction({ type: 'study_update', target: 'subject', id: 3, changes: { name: 'Bio' } }, deps())
        await applyAction({ type: 'study_update', target: 'settings', changes: { sessionMinutes: 30, dailyMaxMinutes: 120 } }, deps())
        expect(body(calls(`${BASE}/subjects/3`, 'PATCH')[0])).toEqual({ name: 'Bio' })
        const puts = calls(`${BASE}/settings`, 'PUT')
        expect(puts).toHaveLength(1)
        expect(body(puts[0])).toEqual({ sessionMinutes: 30, dailyMaxMinutes: 120 })
    })

    it('deletes a goal with the chosen sessions mode, a part and a subject', async () => {
        await applyAction({ type: 'study_delete', target: 'goal', id: 10 }, deps({ sessions: 'delete' }))
        expect(apiFetch.mock.calls.some(([url, o]) => url === `${BASE}/goals/10?sessions=delete` && o.method === 'DELETE')).toBe(true)
        await applyAction({ type: 'study_delete', target: 'goal', id: 11 }, deps())
        expect(apiFetch.mock.calls.some(([url]) => url === `${BASE}/goals/11?sessions=keep`)).toBe(true)
        await applyAction({ type: 'study_delete', target: 'part', id: 100 }, deps())
        await applyAction({ type: 'study_delete', target: 'subject', id: 3 }, deps())
        expect(calls(`${BASE}/parts/100`, 'DELETE')).toHaveLength(1)
        expect(calls(`${BASE}/subjects/3`, 'DELETE')).toHaveLength(1)
    })

    it('re-plan reads the plan and opens the preview', async () => {
        await applyAction({ type: 'study_replan' }, deps())
        expect(calls(`${BASE}/plan`, 'GET')).toHaveLength(1)
        expect(navigate).toHaveBeenCalledWith('/study?replan=1')
    })

    it('a route error comes through as the thrown error', async () => {
        apiFetch.mockImplementation(async () => { throw Object.assign(new Error('limit'), { code: 'LIMIT_REACHED' }) })
        await expect(applyAction({ type: 'study_create', target: 'subject', name: 'X' }, deps())).rejects.toMatchObject({ code: 'LIMIT_REACHED' })
    })

    it('loadStudyContext reads the subjects and each referenced goal', async () => {
        await loadStudyContext([
            { type: 'study_update', target: 'goal', id: 10, changes: {} },
            { type: 'study_create', target: 'part', goalId: 10, name: 'x', estimateMinutes: 5 },
            { type: 'study_create', target: 'subject', name: 'y' },
        ], store.dispatch)
        expect(calls(`${BASE}/subjects`, 'GET')).toHaveLength(1)
        expect(calls(`${BASE}/goals/10`, 'GET')).toHaveLength(1)
    })
})

describe('preparing study actions', () => {
    const study = () => store.getState().study
    const prepare = (actions) => prepareActions(actions, [], study())

    it('merges two part updates, counts an unknown id as missing, and lets a delete win', () => {
        const { cards, missing } = prepare([
            { type: 'study_update', target: 'part', id: 100, changes: { name: 'Zellen 2' } },
            { type: 'study_update', target: 'part', id: 100, changes: { estimateMinutes: 90 } },
            { type: 'study_update', target: 'goal', id: 999, changes: { name: 'x' } },
            { type: 'study_update', target: 'goal', id: 10, changes: { name: 'y' } },
            { type: 'study_delete', target: 'goal', id: 10 },
        ])
        expect(missing).toBe(1)
        expect(cards.map(c => c.type)).toEqual(['study_update', 'study_delete'])
        expect(cards[0].action.changes).toEqual({ name: 'Zellen 2', estimateMinutes: 90 })
        expect(cards[0].study.rows.map(r => r.field)).toEqual(['name', 'estimateMinutes'])
        expect(cards[1].study).toMatchObject({ kind: 'delete', sessions: 2 })
    })

    it('describes from the stored copy, not from the model', () => {
        const card = describeStudy({ type: 'study_update', target: 'goal', id: 10, changes: { name: 'Klausur', due: '2026-12-20', subjectId: 3 }, summary: 'lies' }, study())
        expect(card).toMatchObject({ kind: 'update', rows: [{ field: 'due', from: '2026-12-12', to: '2026-12-20' }] })
        expect(describeStudy({ type: 'study_delete', target: 'goal', id: 7 }, study())).toBeNull()
    })

    it('creates need no stored copy, but a part under an unknown goal is missing', () => {
        const { cards, missing } = prepare([
            { type: 'study_create', target: 'subject', name: 'Chemie' },
            { type: 'study_create', target: 'part', goalId: 555, name: 'x', estimateMinutes: 5 },
            { type: 'study_create', target: 'goal', subjectId: 3, name: 'G', kind: 'exam', due: '2026-12-01', parts: [] },
            { type: 'study_replan' },
        ])
        expect(missing).toBe(1)
        expect(cards.map(c => c.study.kind)).toEqual(['create', 'create', 'replan'])
    })

    it('works without a study slice', () => {
        expect(prepareActions([{ type: 'study_delete', target: 'goal', id: 1 }], [])).toEqual({ cards: [], missing: 1 })
    })
})
