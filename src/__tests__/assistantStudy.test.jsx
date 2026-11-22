import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { makeStore } from './helpers/store'
import { SET_ACCESS, LOGIN_SUCCESS } from '../features/auth/authActionTypes'
import { setLanguage } from '../features/settings/settingsAction'
import { forgetAiQuota } from '../features/ai/ai'
import { resetAssistantChat } from '../features/assistant/assistantApi'
import AssistantFab from '../components/assistant/AssistantFab'
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
        if (url === `${BASE}/goals` && method === 'GET') return [GOAL]
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

describe('from a cold store', () => {
    const cold = async (actions) => {
        store = makeStore()
        apiFetch.mockClear()
        await loadStudyContext(actions, store.dispatch, store.getState)
        return actions.map(a => describeStudy(a, store.getState().study))
    }

    it('a part update and a part delete resolve without a visited goal', async () => {
        const [update, del] = await cold([
            { type: 'study_update', target: 'part', id: 100, changes: { name: 'Neu' } },
            { type: 'study_delete', target: 'part', id: 100 },
        ])
        expect(update).toMatchObject({ kind: 'update', rows: [{ field: 'name', from: 'Zellen', to: 'Neu' }] })
        expect(del).toMatchObject({ kind: 'delete', title: 'Zellen' })
        expect(calls(`${BASE}/goals`, 'GET')).toHaveLength(1)
    })

    it('a subject delete counts the sessions of its goals', async () => {
        const [del] = await cold([{ type: 'study_delete', target: 'subject', id: 3 }])
        expect(del).toMatchObject({ kind: 'delete', title: 'Biologie', sessions: 2 })
    })

    it('does not read the subjects again when the store has them', async () => {
        await loadStudyContext([{ type: 'study_create', target: 'subject', name: 'x' }], store.dispatch, store.getState)
        expect(calls(`${BASE}/subjects`, 'GET')).toHaveLength(0)
    })
})

describe('two goals sharing one new subject', () => {
    it('makes the subject once', async () => {
        const goal = { type: 'study_create', target: 'goal', subjectName: 'Physik', name: 'A', kind: 'exam', due: '2026-12-01', parts: [] }
        await applyAction(goal, deps())
        await applyAction({ ...goal, name: 'B' }, deps())
        expect(calls(`${BASE}/subjects`, 'POST')).toHaveLength(1)
        expect(calls(`${BASE}/goals`, 'POST').map(c => body(c).subjectId)).toEqual([30, 30])
    })
})

describe('preparing study actions', () => {
    it('drops no-ops, a settings delete and a move to an unknown subject', () => {
        const { cards, missing } = prepareActions([
            { type: 'study_update', target: 'subject', id: 3, changes: { archived: false } },
            { type: 'study_delete', target: 'settings' },
            { type: 'study_update', target: 'goal', id: 10, changes: { subjectId: 99 } },
        ], [], store.getState().study)
        expect(cards).toEqual([])
        expect(missing).toBe(1)
    })

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

describe('counting the sessions a delete removes', () => {
    afterEach(() => vi.useRealTimers())

    it('counts what the backend calls pending: not done, no focus, today or later, today only while ahead', () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date(2026, 10, 22, 12, 0))
        const sessions = [
            { taskId: 1, due: '2026-11-21', dueTime: '09:00' },
            { taskId: 2, due: '2026-11-22', dueTime: '09:00' },
            { taskId: 3, due: '2026-11-22', dueTime: '12:00' },
            { taskId: 4, due: '2026-11-22', dueTime: '15:00' },
            { taskId: 5, due: '2026-11-22', dueTime: null },
            { taskId: 6, due: '2026-11-23', dueTime: '08:00' },
            { taskId: 7, due: '2026-11-24', dueTime: null, done: true },
            { taskId: 8, due: '2026-11-24', dueTime: null, focusMs: 60000 },
        ]
        const study = { subjects: [{ id: 3, name: 'Biologie' }], goals: { 10: { id: 10, subjectId: 3, name: 'Klausur', sessions } } }
        expect(describeStudy({ type: 'study_delete', target: 'goal', id: 10 }, study).sessions).toBe(3)
        expect(describeStudy({ type: 'study_delete', target: 'subject', id: 3 }, study).sessions).toBe(3)
    })
})

describe('the cards in the chat', () => {
    const QUOTA = { available: true, scan: { used: 0, max: 1 }, aiLine: { used: 0, max: 5 }, assistant: { used: 3, max: 20 }, resetsAt: '2026-11-15T23:00:00.000Z' }
    const MAX_ON = { isPro: true, max: { active: true, gift: false, until: '2027-01-01T00:00:00Z' } }
    const LATER = (n) => Array.from({ length: n }, (_, i) => ({ taskId: 900 + i, due: '2999-01-01', dueTime: null, done: false, focusMs: 0 }))
    let reply, fail, sessions

    function Where() {
        const location = useLocation()
        return <output data-testid="where">{location.pathname + location.search}</output>
    }

    function open() {
        const chat = makeStore()
        chat.dispatch(setLanguage('de'))
        chat.dispatch({ type: LOGIN_SUCCESS, payload: { token: 'tok', username: 'lena' } })
        chat.dispatch({ type: SET_ACCESS, payload: MAX_ON })
        render(<Provider store={chat}><MemoryRouter initialEntries={['/']}><AssistantFab /><Where /></MemoryRouter></Provider>)
        fireEvent.click(screen.getByRole('button', { name: 'KI-Assistent' }))
    }

    async function say(actions) {
        reply = async () => ({ message: 'Das Modell sagt etwas Falsches.', actions, quota: QUOTA })
        fireEvent.change(screen.getByRole('textbox', { name: 'Nachricht an den Assistenten' }), { target: { value: 'tu was' } })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Senden' })) })
    }

    beforeEach(() => {
        resetAssistantChat()
        forgetAiQuota()
        reply = null
        fail = null
        sessions = GOAL.sessions
        const base = apiFetch.getMockImplementation()
        apiFetch.mockImplementation(async (url, options = {}) => {
            const method = options.method ?? 'GET'
            if (url === '/api/ai/quota') return structuredClone(QUOTA)
            if (url === '/api/ai/assistant') return reply()
            const err = fail?.(url.split('?')[0], method)
            if (err) throw err
            if (url === `${BASE}/goals/999`) throw Object.assign(new Error('Not found'), { status: 404, code: 'NOT_FOUND' })
            if (url === `${BASE}/goals/10` && method === 'GET') return { ...GOAL, sessions }
            return base(url, options)
        })
    })

    it('a new subject is made at once, with Undo; Undo deletes it', async () => {
        open()
        await say([{ type: 'study_create', target: 'subject', name: 'Chemie' }])
        expect(calls(`${BASE}/subjects`, 'POST')).toHaveLength(1)
        const card = screen.getByRole('group', { name: /Chemie/ })
        expect(within(card).getByText('Angelegt')).toBeInTheDocument()
        await act(async () => { fireEvent.click(within(card).getByRole('button', { name: 'Rückgängig' })) })
        expect(calls(`${BASE}/subjects/30`, 'DELETE')).toHaveLength(1)
        expect(within(card).getByText('Rückgängig gemacht')).toBeInTheDocument()
    })

    it('a goal date change shows from and to from the stored copy and applies only after Bestätigen', async () => {
        open()
        await say([{ type: 'study_update', target: 'goal', id: 10, changes: { due: '2026-12-20' }, summary: 'lies' }])
        const card = screen.getByRole('group', { name: /Klausur/ })
        expect(within(card).getByText('Sa 12.12.')).toBeInTheDocument()
        expect(within(card).getByText('So 20.12.')).toBeInTheDocument()
        expect(calls(`${BASE}/goals/10`, 'PATCH')).toHaveLength(0)
        await act(async () => { fireEvent.click(within(card).getByRole('button', { name: 'Bestätigen' })) })
        expect(body(calls(`${BASE}/goals/10`, 'PATCH')[0])).toMatchObject({ due: '2026-12-20' })
        expect(within(card).getByText('Geändert')).toBeInTheDocument()
    })

    it('cancelling leaves everything as it is', async () => {
        open()
        await say([{ type: 'study_update', target: 'goal', id: 10, changes: { due: '2026-12-20' } }])
        fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
        expect(calls(`${BASE}/goals/10`, 'PATCH')).toHaveLength(0)
        expect(screen.getByText('Abgebrochen')).toBeInTheDocument()
    })

    it('deleting a goal with planned sessions asks to keep or remove them', async () => {
        sessions = LATER(3)
        open()
        await say([{ type: 'study_delete', target: 'goal', id: 10 }])
        const card = screen.getByRole('group', { name: /Klausur/ })
        expect(within(card).getByText(/3 geplante Einheiten/)).toBeInTheDocument()
        expect(within(card).getByRole('button', { name: 'Einheiten behalten' })).toBeInTheDocument()
        expect(within(card).queryByRole('button', { name: 'Bestätigen' })).toBeNull()
        await act(async () => { fireEvent.click(within(card).getByRole('button', { name: 'Einheiten entfernen' })) })
        expect(apiFetch.mock.calls.some(([url, o]) => url === `${BASE}/goals/10?sessions=delete` && o.method === 'DELETE')).toBe(true)
        expect(within(card).getByText('Gelöscht')).toBeInTheDocument()
    })

    it('deleting a goal without planned sessions is one Bestätigen', async () => {
        sessions = []
        open()
        await say([{ type: 'study_delete', target: 'goal', id: 10 }])
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Bestätigen' })) })
        expect(apiFetch.mock.calls.some(([url]) => url === `${BASE}/goals/10?sessions=keep`)).toBe(true)
    })

    it('deleting a subject says how many planned sessions go and has one button', async () => {
        sessions = LATER(2)
        open()
        await say([{ type: 'study_delete', target: 'subject', id: 3 }])
        const card = screen.getByRole('group', { name: /Biologie/ })
        expect(within(card).getByText(/2 geplante Einheiten werden entfernt/)).toBeInTheDocument()
        expect(within(card).queryByRole('button', { name: 'Einheiten behalten' })).toBeNull()
        await act(async () => { fireEvent.click(within(card).getByRole('button', { name: 'Bestätigen' })) })
        expect(calls(`${BASE}/subjects/3`, 'DELETE')).toHaveLength(1)
    })

    const ERRORS = [
        ['due_in_past', 'Das Datum liegt in der Vergangenheit', { type: 'study_create', target: 'goal', subjectId: 3, name: 'Test', kind: 'exam', due: '2020-01-01', parts: [] }, `${BASE}/goals`],
        ['subject_exists', 'Das Fach gibt es schon', { type: 'study_create', target: 'subject', name: 'Biologie' }, `${BASE}/subjects`],
        ['LIMIT_REACHED', 'Mit dem Gratis-Plan sind 3 Fächer möglich', { type: 'study_create', target: 'subject', name: 'Chemie' }, `${BASE}/subjects`],
    ]
    it.each(ERRORS)('the %s error shows on the card, which can be tried again', async (code, message, action, path) => {
        fail = (url, method) => (url === path && method === 'POST' ? Object.assign(new Error(message), { code, status: 400 }) : null)
        open()
        await say([action])
        const card = screen.getByRole('group', { name: new RegExp(action.name) })
        expect(within(card).getByText(`Das hat nicht geklappt: ${message}`)).toBeInTheDocument()
        expect(within(card).queryByRole('button', { name: 'Rückgängig' })).toBeNull()
        fail = null
        await act(async () => { fireEvent.click(within(card).getByRole('button', { name: 'Nochmal versuchen' })) })
        expect(within(card).getByText('Angelegt')).toBeInTheDocument()
        expect(within(card).getByRole('button', { name: 'Rückgängig' })).toBeInTheDocument()
    })

    it('a failed confirm shows the server message and can be confirmed again', async () => {
        fail = (url, method) => (url === `${BASE}/goals/10` && method === 'PATCH' ? Object.assign(new Error('Das Datum liegt in der Vergangenheit'), { code: 'due_in_past' }) : null)
        open()
        await say([{ type: 'study_update', target: 'goal', id: 10, changes: { due: '2020-01-01' } }])
        const card = screen.getByRole('group', { name: /Klausur/ })
        await act(async () => { fireEvent.click(within(card).getByRole('button', { name: 'Bestätigen' })) })
        expect(within(card).getByText(/Das Datum liegt in der Vergangenheit/)).toBeInTheDocument()
        fail = null
        await act(async () => { fireEvent.click(within(card).getByRole('button', { name: 'Bestätigen' })) })
        expect(within(card).getByText('Geändert')).toBeInTheDocument()
    })

    it('a re-plan opens the preview and closes the sheet', async () => {
        open()
        await say([{ type: 'study_replan' }])
        const card = screen.getByRole('group', { name: /neu planen/i })
        await act(async () => { fireEvent.click(within(card).getByRole('button', { name: 'Plan ansehen' })) })
        expect(calls(`${BASE}/plan`, 'GET')).toHaveLength(1)
        expect(screen.getByTestId('where')).toHaveTextContent('/study?replan=1')
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    })

    it('an id the app does not have is the usual "not found" line', async () => {
        open()
        await say([{ type: 'study_update', target: 'goal', id: 999, changes: { name: 'x' } }])
        expect(screen.getByText(/nicht gefunden/)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Bestätigen' })).toBeNull()
    })
})
