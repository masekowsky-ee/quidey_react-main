import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch, toInputDate } from '../features/helperFunction'
import { SET_ACCESS, LOGIN_SUCCESS } from '../features/auth/authActionTypes'
import { parseParts } from '../features/study/parseParts'
import StudyPage from '../components/study/StudyPage'
import TesterOnly from '../components/TesterOnly'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const BASE = '/api/tester/study'
const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return toInputDate(d) }
const calls = (path, method = 'GET') => apiFetch.mock.calls.filter(([url, options]) => url === path && (options?.method ?? 'GET') === method)
const bodyOf = (call) => JSON.parse(call[1].body)

let settings, subjects, replanAnswers, previews
const part = (id, name, extra = {}) => ({ id, name, position: id, estimateMinutes: 120, estimateSource: 'default', role: 'part', doneAt: null, credit: 0, remaining: 120, ...extra })
const newGoal = () => ({
    id: 20, subjectId: 1, kind: 'exam', name: 'Klausur Analysis', due: inDays(10), dueTime: null, planMode: 'days', status: 'active',
    parts: [part(200, 'Grenzwerte'), part(201, 'Ableitungen'), part(202, 'Wiederholung', { role: 'review', estimateMinutes: 60 })], sessions: [],
})
const previewOf = (extra = {}) => ({
    inputHash: 'a'.repeat(64),
    shortfall: { 20: 180, 11: 0 },
    goals: [
        { goalId: 20, name: 'Klausur Analysis', summary: { moved: 0, added: 2, dropped: 0, unchanged: 0 },
            changes: [
                { type: 'new', partName: 'Grenzwerte', to: { date: inDays(2), time: '15:00' }, minutes: 45 },
                { type: 'new', partName: 'Ableitungen', to: { date: inDays(3), time: null }, minutes: 45 },
            ] },
        { goalId: 11, name: 'Abgabe Übung', summary: { moved: 1, added: 0, dropped: 1, unchanged: 2 },
            changes: [
                { type: 'moved', partName: 'Aufgabe 1', from: { date: inDays(2), time: '16:00' }, to: { date: inDays(4), time: '17:00' }, minutes: 45 },
                { type: 'dropped', partName: 'Aufgabe 2', from: { date: inDays(5), time: null }, minutes: 45 },
            ] },
    ],
    ...extra,
})

beforeEach(() => {
    apiFetch.mockReset()
    settings = { windows: [{ weekday: 1, start: '16:00', end: '18:00' }], sessionMinutes: 45, dailyMaxMinutes: 180, aiAuto: false, aiAvailable: true }
    subjects = [
        { id: 1, name: 'Mathe', emoji: null, color: 'blue', archived: false, nextGoal: null },
        { id: 2, name: 'Physik', emoji: null, color: 'green', archived: false, nextGoal: null },
    ]
    previews = [previewOf()]
    replanAnswers = []
    apiFetch.mockImplementation(async (url, options = {}) => {
        const method = options.method ?? 'GET'
        const body = options.body ? JSON.parse(options.body) : undefined
        if (url === `${BASE}/subjects` && method === 'GET') return subjects
        if (url === `${BASE}/subjects` && method === 'POST') {
            if (body.name === 'Mathe') throw Object.assign(new Error('exists'), { status: 400, code: 'subject_exists' })
            const made = { id: 9, name: body.name, emoji: null, color: null, archived: false, nextGoal: null }
            subjects = [...subjects, made]
            return made
        }
        if (url === `${BASE}/settings`) return settings
        if (url === `${BASE}/estimate`) {
            return body.ai
                ? { estimates: body.parts.map(() => ({ minutes: 90, source: 'ai' })), aiUsed: true, aiFailed: false }
                : { estimates: body.parts.map(() => ({ minutes: 120, source: 'default' })), aiUsed: false, aiFailed: false }
        }
        if (url === `${BASE}/goals` && method === 'POST') return { ...newGoal(), planMode: body.planMode }
        if (url === `${BASE}/goals?subject=1`) return []
        if (url === `${BASE}/goals/20` && method === 'GET') return newGoal()
        if (url === `${BASE}/parts/202` && method === 'DELETE') return { ok: true, removedSessions: 0 }
        if (url === `${BASE}/plan`) return structuredClone(previews[0])
        if (url === `${BASE}/replan`) {
            const answer = replanAnswers.shift()
            if (answer) throw answer
            return { ok: true }
        }
        return []
    })
    window.matchMedia = vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
})
afterEach(cleanup)

const makeStore = () => {
    const store = configureStore({ reducer: rootReducer, middleware: (get) => get({ serializableCheck: false, immutableCheck: false }) })
    store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 'tok', username: 'lena' } })
    store.dispatch({ type: SET_ACCESS, payload: { isPro: true, isAdmin: false, isTester: true, adminPendingCount: 0, betaRequest: null } })
    return store
}

function Where() {
    const location = useLocation()
    return <div data-testid="where">{location.pathname + location.search}</div>
}

function open(path) {
    const page = <TesterOnly fallback={<Navigate to="/" replace />}><StudyPage /></TesterOnly>
    render(
        <Provider store={makeStore()}>
            <MemoryRouter initialEntries={[path]}>
                <Where />
                <Routes>
                    <Route path="/" element={<p>HOME</p>} />
                    <Route path="/study" element={page} />
                    <Route path="/study/goals/:id" element={page} />
                    <Route path="/study/:subjectId" element={page} />
                </Routes>
            </MemoryRouter>
        </Provider>,
    )
}

// step 1 filled and left; the parts typed
async function toStepTwo({ parts = 'Grenzwerte\nAbleitungen' } = {}) {
    open('/study/1?new=goal')
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Klausur' }))
    fireEvent.change(within(dialog).getByLabelText('Name des Ziels'), { target: { value: 'Klausur Analysis' } })
    fireEvent.change(within(dialog).getByLabelText('Datum'), { target: { value: inDays(10) } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Weiter' }))
    const area = await screen.findByLabelText('Themen, eins pro Zeile')
    fireEvent.change(area, { target: { value: parts } })
    return dialog
}

const defaults = (dialog, n) => waitFor(() => expect(within(dialog).getAllByText('Standardwert')).toHaveLength(n), { timeout: 2000 })

describe('parseParts', () => {
    it('strips bullets and numbers, drops blank lines and trims', () => {
        const text = '- Grenzwerte\n* Ableitungen\n• Integrale\n1. Reihen\n2) Folgen\n\n   \n  Stetigkeit  \n3.5 Seiten lesen'
        expect(parseParts(text)).toEqual(['Grenzwerte', 'Ableitungen', 'Integrale', 'Reihen', 'Folgen', 'Stetigkeit', '3.5 Seiten lesen'])
    })
    it('keeps at most 40 lines of at most 200 characters', () => {
        const lines = Array.from({ length: 45 }, (_, i) => `Thema ${i + 1}`)
        expect(parseParts(lines.join('\n'))).toHaveLength(40)
        expect(parseParts('x'.repeat(300))[0]).toHaveLength(200)
        expect(parseParts('')).toEqual([])
    })
})

describe('create sheet', () => {
    it('walks the three steps and creates the goal with parts and their sources', async () => {
        const dialog = await toStepTwo()
        await defaults(dialog, 2)
        const estimate = bodyOf(calls(`${BASE}/estimate`, 'POST')[0])
        expect(estimate).toMatchObject({ subjectId: 1, subjectName: 'Mathe', kind: 'exam', parts: ['Grenzwerte', 'Ableitungen'] })
        expect(estimate.ai).toBeUndefined()
        // a stepper change is manual
        fireEvent.click(within(dialog).getByRole('button', { name: 'Mehr Zeit: Grenzwerte' }))
        fireEvent.click(within(dialog).getByRole('button', { name: 'Plan ansehen' }))
        await screen.findByRole('button', { name: 'Übernehmen' })
        const body = bodyOf(calls(`${BASE}/goals`, 'POST')[0])
        expect(body).toMatchObject({ subjectId: 1, kind: 'exam', name: 'Klausur Analysis', due: inDays(10), planMode: 'days' })
        expect(body.parts).toEqual([
            { name: 'Grenzwerte', estimateMinutes: 135, estimateSource: 'manual' },
            { name: 'Ableitungen', estimateMinutes: 120, estimateSource: 'default' },
        ])
        expect(calls(`${BASE}/parts/202`, 'DELETE')).toHaveLength(0)
    })

    it('"Schätzen lassen" asks with ai: true and shows the AI source; manual values stay', async () => {
        const dialog = await toStepTwo()
        await defaults(dialog, 2)
        fireEvent.click(within(dialog).getByRole('button', { name: 'Mehr Zeit: Ableitungen' }))
        fireEvent.click(within(dialog).getByRole('button', { name: /Schätzen lassen/ }))
        await waitFor(() => expect(within(dialog).getAllByText('KI-Schätzung')).toHaveLength(1))
        const aiCall = calls(`${BASE}/estimate`, 'POST').map(bodyOf).find(b => b.ai)
        expect(aiCall).toMatchObject({ ai: true, parts: ['Grenzwerte', 'Ableitungen'] })
        expect(within(dialog).getByText('manuell')).toBeTruthy()
        fireEvent.click(within(dialog).getByRole('button', { name: 'Plan ansehen' }))
        await screen.findByRole('button', { name: 'Übernehmen' })
        expect(bodyOf(calls(`${BASE}/goals`, 'POST')[0]).parts).toEqual([
            { name: 'Grenzwerte', estimateMinutes: 90, estimateSource: 'ai' },
            { name: 'Ableitungen', estimateMinutes: 135, estimateSource: 'manual' },
        ])
    })

    it('has no AI button without aiAvailable', async () => {
        settings.aiAvailable = false
        const dialog = await toStepTwo()
        await defaults(dialog, 2)
        expect(within(dialog).queryByRole('button', { name: /Schätzen lassen/ })).toBeNull()
    })

    it('shows the notice when the estimate answered aiFailed', async () => {
        const base = apiFetch.getMockImplementation()
        apiFetch.mockImplementation(async (url, options = {}) => {
            if (url === `${BASE}/estimate`) {
                const body = JSON.parse(options.body)
                return { estimates: body.parts.map(() => ({ minutes: 120, source: 'default' })), aiUsed: false, aiFailed: true }
            }
            return base(url, options)
        })
        const dialog = await toStepTwo()
        await waitFor(() => expect(within(dialog).getByText('KI-Schätzung gerade nicht verfügbar')).toBeTruthy(), { timeout: 2000 })
    })

    it('removing the review row sends only the regular parts and deletes the created review part', async () => {
        const dialog = await toStepTwo()
        await defaults(dialog, 2)
        expect(within(dialog).getByText('Wiederholung')).toBeTruthy()
        fireEvent.click(within(dialog).getByRole('button', { name: 'Wiederholung entfernen' }))
        expect(within(dialog).queryByText('Wiederholung')).toBeNull()
        fireEvent.click(within(dialog).getByRole('button', { name: 'Plan ansehen' }))
        await screen.findByRole('button', { name: 'Übernehmen' })
        expect(bodyOf(calls(`${BASE}/goals`, 'POST')[0]).parts.map(p => p.name)).toEqual(['Grenzwerte', 'Ableitungen'])
        expect(calls(`${BASE}/parts/202`, 'DELETE')).toHaveLength(1)
    })

    it('shows subject_exists inline when the inline new subject already exists', async () => {
        open('/study?new=goal')
        const dialog = await screen.findByRole('dialog')
        await waitFor(() => expect(within(dialog).getByLabelText('Fach')).toBeTruthy())
        fireEvent.change(within(dialog).getByLabelText('Fach'), { target: { value: 'new' } })
        fireEvent.change(within(dialog).getByLabelText('Name des neuen Fachs'), { target: { value: 'Mathe' } })
        fireEvent.change(within(dialog).getByLabelText('Name des Ziels'), { target: { value: 'Test' } })
        fireEvent.change(within(dialog).getByLabelText('Datum'), { target: { value: inDays(10) } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Weiter' }))
        fireEvent.change(await screen.findByLabelText('Themen, eins pro Zeile'), { target: { value: 'Eins' } })
        await defaults(dialog, 1)
        fireEvent.click(within(dialog).getByRole('button', { name: 'Plan ansehen' }))
        await waitFor(() => expect(within(dialog).getByText('Dieses Fach gibt es schon.')).toBeTruthy())
        expect(calls(`${BASE}/goals`, 'POST')).toHaveLength(0)
    })

    it('a retry after a failed create reuses the new subject instead of creating it again', async () => {
        const base = apiFetch.getMockImplementation()
        let failOnce = true
        apiFetch.mockImplementation(async (url, options = {}) => {
            if (url === `${BASE}/goals` && options.method === 'POST' && failOnce) {
                failOnce = false
                throw Object.assign(new Error('boom'), { status: 500, code: 'server_error' })
            }
            return base(url, options)
        })
        open('/study?new=goal')
        const dialog = await screen.findByRole('dialog')
        await waitFor(() => expect(within(dialog).getByLabelText('Fach')).toBeTruthy())
        fireEvent.change(within(dialog).getByLabelText('Fach'), { target: { value: 'new' } })
        fireEvent.change(within(dialog).getByLabelText('Name des neuen Fachs'), { target: { value: 'Chemie' } })
        fireEvent.change(within(dialog).getByLabelText('Name des Ziels'), { target: { value: 'Test' } })
        fireEvent.change(within(dialog).getByLabelText('Datum'), { target: { value: inDays(10) } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Weiter' }))
        fireEvent.change(await screen.findByLabelText('Themen, eins pro Zeile'), { target: { value: 'Eins' } })
        await defaults(dialog, 1)
        fireEvent.click(within(dialog).getByRole('button', { name: 'Plan ansehen' }))
        await waitFor(() => expect(calls(`${BASE}/goals`, 'POST')).toHaveLength(1))
        await waitFor(() => expect(within(dialog).getByRole('alert')).toBeTruthy())
        fireEvent.click(within(dialog).getByRole('button', { name: 'Plan ansehen' }))
        await screen.findByRole('button', { name: 'Übernehmen' })
        expect(calls(`${BASE}/subjects`, 'POST')).toHaveLength(1)
        const goalCalls = calls(`${BASE}/goals`, 'POST')
        expect(goalCalls).toHaveLength(2)
        expect(bodyOf(goalCalls[1]).subjectId).toBe(9)
    })

    it('slots mode without study times links to the settings instead of a preview', async () => {
        settings.windows = []
        open('/study/1?new=goal')
        const dialog = await screen.findByRole('dialog')
        fireEvent.click(within(dialog).getByRole('radio', { name: 'In deinen Lernzeiten' }))
        fireEvent.change(within(dialog).getByLabelText('Name des Ziels'), { target: { value: 'Test' } })
        fireEvent.change(within(dialog).getByLabelText('Datum'), { target: { value: inDays(10) } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Weiter' }))
        fireEvent.change(await screen.findByLabelText('Themen, eins pro Zeile'), { target: { value: 'Eins' } })
        await defaults(dialog, 1)
        fireEvent.click(within(dialog).getByRole('button', { name: 'Plan ansehen' }))
        expect(await screen.findByText('Lege zuerst Lernzeiten fest')).toBeTruthy()
        expect(screen.getByRole('link', { name: 'Lernzeiten festlegen' }).getAttribute('href')).toBe('/settings#study')
        expect(calls(`${BASE}/goals`, 'POST')).toHaveLength(0)
    })

    it('applies the plan and opens the new goal', async () => {
        const dialog = await toStepTwo()
        await defaults(dialog, 2)
        fireEvent.click(within(dialog).getByRole('button', { name: 'Plan ansehen' }))
        fireEvent.click(await screen.findByRole('button', { name: 'Übernehmen' }))
        await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/study/goals/20'))
        expect(bodyOf(calls(`${BASE}/replan`, 'POST')[0])).toEqual({ inputHash: 'a'.repeat(64) })
    })
})

describe('plan preview', () => {
    it('opens with ?replan=1, groups by goal with summary, rows, shortfall; Übernehmen applies and closes', async () => {
        open('/study/goals/20?replan=1')
        const dialog = await screen.findByRole('dialog')
        await within(dialog).findByText('Abgabe Übung')
        const first = within(dialog).getByRole('group', { name: 'Klausur Analysis' })
        expect(within(first).getByText('2 neu')).toBeTruthy()
        expect(within(first).getByText(/Es fehlen 3 h bis zur Klausur: mehr Lernzeiten freigeben oder Themen kürzer schätzen\?/)).toBeTruthy()
        expect(within(first).getByText(/neu: .* 15:00/)).toBeTruthy()
        const second = within(dialog).getByRole('group', { name: 'Abgabe Übung' })
        expect(within(second).getByText('1 Sitzung verschoben · 1 entfällt')).toBeTruthy()
        expect(within(second).getByText(/16:00 → .* 17:00/)).toBeTruthy()
        expect(within(second).getByText('entfällt', { selector: 'span' })).toBeTruthy()
        expect(within(second).queryByText(/Es fehlen/)).toBeNull()
        fireEvent.click(within(dialog).getByRole('button', { name: 'Übernehmen' }))
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
        expect(bodyOf(calls(`${BASE}/replan`, 'POST')[0])).toEqual({ inputHash: 'a'.repeat(64) })
        expect(screen.getByTestId('where').textContent).toBe('/study/goals/20')
    })

    it('a 409 shows the changed-plan line and the fresh rows without closing', async () => {
        const fresh = previewOf({ inputHash: 'b'.repeat(64) })
        fresh.goals[0].changes = [{ type: 'new', partName: 'Neues Thema', to: { date: inDays(6), time: '09:00' }, minutes: 45 }]
        replanAnswers = [Object.assign(new Error('changed'), { status: 409, code: 'plan_changed', data: { code: 'plan_changed', preview: fresh } })]
        open('/study/goals/20?replan=1')
        const dialog = await screen.findByRole('dialog')
        fireEvent.click(await within(dialog).findByRole('button', { name: 'Übernehmen' }))
        expect(await within(dialog).findByText('Der Plan hat sich gerade geändert – hier ist der neue Vorschlag.')).toBeTruthy()
        expect(within(dialog).getByText('Neues Thema')).toBeTruthy()
        expect(screen.getByRole('dialog')).toBeTruthy()
        fireEvent.click(within(dialog).getByRole('button', { name: 'Übernehmen' }))
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
        expect(bodyOf(calls(`${BASE}/replan`, 'POST')[1])).toEqual({ inputHash: 'b'.repeat(64) })
    })

    it('Abbrechen closes without applying and removes the param', async () => {
        open('/study/goals/20?replan=1')
        const dialog = await screen.findByRole('dialog')
        fireEvent.click(await within(dialog).findByRole('button', { name: 'Abbrechen' }))
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
        expect(calls(`${BASE}/replan`, 'POST')).toHaveLength(0)
        expect(screen.getByTestId('where').textContent).toBe('/study/goals/20')
    })

    it('an empty plan says everything fits and only offers to close', async () => {
        previews = [{ inputHash: 'c'.repeat(64), shortfall: { 20: 0 }, goals: [{ goalId: 20, name: 'Klausur Analysis', summary: { moved: 0, added: 0, dropped: 0, unchanged: 3 }, changes: [] }] }]
        open('/study/goals/20?replan=1')
        const dialog = await screen.findByRole('dialog')
        expect(await within(dialog).findByText('Alles passt – nichts zu ändern.')).toBeTruthy()
        expect(within(dialog).queryByRole('button', { name: 'Übernehmen' })).toBeNull()
        fireEvent.click(within(dialog).getAllByRole('button', { name: 'Schließen' }).at(-1))
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    })
})
