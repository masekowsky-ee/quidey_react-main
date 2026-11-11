import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
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

let settings, subjects, replanAnswers, previews, goalSessions
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
            ],
            sessions: [
                { key: 0, partId: 200, partName: 'Grenzwerte', date: inDays(2), time: '15:00', minutes: 45, change: 'new' },
                { key: 1, partId: 201, partName: 'Ableitungen', date: inDays(3), time: null, minutes: 45, change: 'new' },
            ] },
        { goalId: 11, name: 'Abgabe Übung', summary: { moved: 1, added: 0, dropped: 1, unchanged: 2 },
            changes: [
                { type: 'moved', partName: 'Aufgabe 1', from: { date: inDays(2), time: '16:00' }, to: { date: inDays(4), time: '17:00' }, minutes: 45 },
                { type: 'dropped', partName: 'Aufgabe 2', from: { date: inDays(5), time: null }, minutes: 45 },
            ],
            sessions: [
                { key: 2, partId: 110, partName: 'Aufgabe 1', date: inDays(4), time: '17:00', minutes: 45, change: 'moved', from: { date: inDays(2), time: '16:00' } },
                { key: 3, partId: 112, partName: 'Aufgabe 3', date: inDays(6), time: null, minutes: 45, change: 'same' },
            ] },
    ],
    ...extra,
})

beforeEach(() => {
    sessionStorage.clear()
    apiFetch.mockReset()
    settings = { windows: [{ weekday: 1, start: '16:00', end: '18:00' }], sessionMinutes: 45, dailyMaxMinutes: 180, aiAuto: false, aiAvailable: true }
    subjects = [
        { id: 1, name: 'Mathe', emoji: null, color: 'blue', archived: false, nextGoal: null },
        { id: 2, name: 'Physik', emoji: null, color: 'green', archived: false, nextGoal: null },
    ]
    previews = [previewOf()]
    replanAnswers = []
    goalSessions = []
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
        if (url === `${BASE}/goals/20` && method === 'GET') return { ...newGoal(), sessions: goalSessions }
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
                    <Route path="/settings" element={<Link to="/study/1">ZURÜCK</Link>} />
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
        expect(estimate.ai).toBe(false)
        // a stepper change is manual
        fireEvent.click(within(dialog).getByRole('button', { name: 'Mehr Zeit: Grenzwerte' }))
        fireEvent.click(within(dialog).getByRole('button', { name: 'Plan ansehen' }))
        await screen.findByRole('button', { name: 'Übernehmen' })
        const body = bodyOf(calls(`${BASE}/goals`, 'POST')[0])
        expect(body).toMatchObject({ subjectId: 1, kind: 'exam', name: 'Klausur Analysis', due: inDays(10), planMode: 'slots' })
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

    it('plans in the study times by default when there is one, else on days', async () => {
        open('/study/1?new=goal')
        let dialog = await screen.findByRole('dialog')
        await waitFor(() => expect(within(dialog).getByRole('radio', { name: 'In deinen Lernzeiten' })).toHaveAttribute('aria-checked', 'true'))
        expect(within(dialog).getByRole('radio', { name: 'Nur an Tagen' })).toHaveAttribute('aria-checked', 'false')
        cleanup()
        settings.windows = []
        open('/study/1?new=goal')
        dialog = await screen.findByRole('dialog')
        await waitFor(() => expect(calls(`${BASE}/settings`).length).toBeGreaterThan(1))
        await waitFor(() => expect(within(dialog).getByRole('radio', { name: 'Nur an Tagen' })).toHaveAttribute('aria-checked', 'true'))
        expect(within(dialog).getByRole('radio', { name: 'In deinen Lernzeiten' })).toHaveAttribute('aria-checked', 'false')
    })

    it('with AI automatic, typing estimates without AI; leaving the list asks the AI once per name', async () => {
        settings.aiAuto = true
        const dialog = await toStepTwo()
        await defaults(dialog, 2)
        const aiCalls = () => calls(`${BASE}/estimate`, 'POST').map(bodyOf).filter(b => b.ai === true)
        expect(calls(`${BASE}/estimate`, 'POST').map(bodyOf).every(b => b.ai === false)).toBe(true)
        const area = within(dialog).getByLabelText('Themen, eins pro Zeile')
        fireEvent.blur(area)
        await waitFor(() => expect(within(dialog).getAllByText('KI-Schätzung')).toHaveLength(2))
        expect(aiCalls()).toHaveLength(1)
        expect(aiCalls()[0].parts).toEqual(['Grenzwerte', 'Ableitungen'])
        fireEvent.blur(area)
        // a new line: estimated without AI, the AI answers of the others stay
        fireEvent.change(area, { target: { value: 'Grenzwerte\nAbleitungen\nIntegrale' } })
        await defaults(dialog, 1)
        expect(within(dialog).getAllByText('KI-Schätzung')).toHaveLength(2)
        expect(aiCalls()).toHaveLength(1)
        fireEvent.blur(area)
        await waitFor(() => expect(within(dialog).getAllByText('KI-Schätzung')).toHaveLength(3))
        expect(aiCalls()).toHaveLength(2)
        expect(aiCalls()[1].parts).toEqual(['Integrale'])
    })

    it('without AI automatic, leaving the list asks no AI', async () => {
        const dialog = await toStepTwo()
        await defaults(dialog, 2)
        fireEvent.blur(within(dialog).getByLabelText('Themen, eins pro Zeile'))
        await new Promise(r => setTimeout(r, 50))
        expect(calls(`${BASE}/estimate`, 'POST').map(bodyOf).some(b => b.ai === true)).toBe(false)
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

describe('a goal sheet left for the study times', () => {
    it('comes back with everything typed when you return from the settings', async () => {
        settings.windows = []
        open('/study/1?new=goal')
        const dialog = await screen.findByRole('dialog')
        fireEvent.click(within(dialog).getByRole('radio', { name: 'In deinen Lernzeiten' }))
        fireEvent.change(within(dialog).getByLabelText('Name des Ziels'), { target: { value: 'Klausur Analysis' } })
        fireEvent.change(within(dialog).getByLabelText('Datum'), { target: { value: inDays(10) } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Weiter' }))
        fireEvent.change(await screen.findByLabelText('Themen, eins pro Zeile'), { target: { value: 'Grenzwerte\nAbleitungen' } })
        await defaults(dialog, 2)
        fireEvent.click(within(dialog).getByRole('button', { name: 'Plan ansehen' }))
        fireEvent.click(await screen.findByRole('link', { name: 'Lernzeiten festlegen' }))
        // in the settings: the study times are set, then back to Lernen (by the menu, not the sheet's address)
        settings.windows = [{ weekday: 1, start: '16:00', end: '18:00' }]
        fireEvent.click(await screen.findByText('ZURÜCK'))
        const back = await screen.findByRole('dialog')
        // the sheet is open again on the topics, with what was typed
        expect(await screen.findByLabelText('Themen, eins pro Zeile')).toHaveValue('Grenzwerte\nAbleitungen')
        fireEvent.click(within(back).getByRole('button', { name: 'Zurück' }))
        expect(within(back).getByLabelText('Name des Ziels')).toHaveValue('Klausur Analysis')
        expect(within(back).getByLabelText('Datum')).toHaveValue(inDays(10))
    })

    it('a sheet closed by hand leaves nothing behind', async () => {
        open('/study/1?new=goal')
        const dialog = await screen.findByRole('dialog')
        fireEvent.change(within(dialog).getByLabelText('Name des Ziels'), { target: { value: 'Verworfen' } })
        fireEvent.click(within(dialog).getByRole('button', { name: /Schließen|Abbrechen/ }))
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
        expect(sessionStorage.getItem('studyGoalDraft')).toBeNull()
    })
})

describe('plan preview', () => {
    it('opens with ?replan=1, an agenda per goal with summary, sessions by day, shortfall; Übernehmen applies and closes', async () => {
        open('/study/goals/20?replan=1')
        const dialog = await screen.findByRole('dialog')
        await within(dialog).findByText('Abgabe Übung')
        const first = within(dialog).getByRole('group', { name: 'Klausur Analysis' })
        expect(within(first).getByText('2 neu')).toBeTruthy()
        expect(within(first).getByText(/Es fehlen 3 h bis zur Klausur: mehr Lernzeiten freigeben oder Themen kürzer schätzen\?/)).toBeTruthy()
        expect(within(first).getByRole('button', { name: /^Grenzwerte, .* 15:00, neu\. Verschieben$/ })).toBeTruthy()
        expect(within(first).getByText('15:00 · 45 Min.')).toBeTruthy()
        const second = within(dialog).getByRole('group', { name: 'Abgabe Übung' })
        expect(within(second).getByText('1 Sitzung verschoben · 1 entfällt')).toBeTruthy()
        expect(within(second).getByText(/^verschoben, vorher .* 16:00$/)).toBeTruthy()
        expect(within(second).getByRole('button', { name: /^Aufgabe 3, / })).toBeTruthy()
        expect(within(second).getByText('1 entfällt')).toBeTruthy()
        expect(within(second).getByText('Aufgabe 2')).toBeTruthy()
        expect(within(second).queryByText(/Es fehlen/)).toBeNull()
        fireEvent.click(within(dialog).getByRole('button', { name: 'Übernehmen' }))
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
        expect(bodyOf(calls(`${BASE}/replan`, 'POST')[0])).toEqual({ inputHash: 'a'.repeat(64) })
        expect(screen.getByTestId('where').textContent).toBe('/study/goals/20')
    })

    it('a 409 shows the changed-plan line and the fresh rows without closing', async () => {
        const fresh = previewOf({ inputHash: 'b'.repeat(64) })
        fresh.goals[0].changes = [{ type: 'new', partName: 'Neues Thema', to: { date: inDays(6), time: '09:00' }, minutes: 45 }]
        fresh.goals[0].sessions = [{ key: 0, partId: 200, partName: 'Neues Thema', date: inDays(6), time: '09:00', minutes: 45, change: 'new' }]
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

    it('a session moved in the preview goes along with Übernehmen; back to the plan takes the move away', async () => {
        open('/study/goals/20?replan=1')
        const dialog = await screen.findByRole('dialog')
        const session = await within(dialog).findByRole('button', { name: /^Grenzwerte, / })
        fireEvent.click(session)
        expect(session.getAttribute('aria-expanded')).toBe('true')
        const mover = within(dialog).getByRole('group', { name: 'Grenzwerte verschieben' })
        fireEvent.click(within(mover).getByRole('button', { name: 'Einen Tag später' }))
        fireEvent.change(within(mover).getByLabelText('Uhrzeit'), { target: { value: '09:30' } })
        expect(within(dialog).getByText('1 Sitzung von dir verschoben')).toBeTruthy()
        expect(within(dialog).getByRole('button', { name: /^Grenzwerte, .* 09:30, von dir verschoben/ })).toBe(session)

        // Aufgabe 1 moved and put back: not sent
        fireEvent.click(within(dialog).getByRole('button', { name: /^Aufgabe 1, / }))
        const other = within(dialog).getByRole('group', { name: 'Aufgabe 1 verschieben' })
        fireEvent.click(within(other).getByRole('button', { name: 'Einen Tag früher' }))
        fireEvent.click(within(other).getByRole('button', { name: 'Wieder wie geplant' }))
        expect(within(dialog).getByText('1 Sitzung von dir verschoben')).toBeTruthy()

        fireEvent.click(within(dialog).getByRole('button', { name: 'Übernehmen' }))
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
        expect(bodyOf(calls(`${BASE}/replan`, 'POST')[0])).toEqual({
            inputHash: 'a'.repeat(64), moves: [{ key: 0, date: inDays(3), time: '09:30' }],
        })
    })

    it('Abbrechen closes without applying and removes the param', async () => {
        open('/study/goals/20?replan=1')
        const dialog = await screen.findByRole('dialog')
        fireEvent.click(await within(dialog).findByRole('button', { name: 'Abbrechen' }))
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
        expect(calls(`${BASE}/replan`, 'POST')).toHaveLength(0)
        expect(screen.getByTestId('where').textContent).toBe('/study/goals/20')
    })

    it('after applying on a goal page its sessions list shows the new sessions', async () => {
        open('/study/goals/20?replan=1')
        expect(await screen.findByText('Noch keine Lernsitzungen geplant.')).toBeTruthy()
        const dialog = await screen.findByRole('dialog')
        goalSessions = [{ taskId: 950, partId: 200, due: inDays(2), dueTime: null, minutes: 45, done: false, focusMs: 0, pinned: false }]
        fireEvent.click(await within(dialog).findByRole('button', { name: 'Übernehmen' }))
        await waitFor(() => expect(screen.queryByText('Noch keine Lernsitzungen geplant.')).toBeNull())
        expect(screen.getByText('45 Min.')).toBeTruthy()
    })

    it('a shortfall with nothing to change shows only the banner and close', async () => {
        previews = [{ inputHash: 'c'.repeat(64), shortfall: { 20: 120 }, goals: [{ goalId: 20, name: 'Klausur Analysis', summary: { moved: 0, added: 0, dropped: 0, unchanged: 0 }, changes: [] }] }]
        open('/study/goals/20?replan=1')
        const dialog = await screen.findByRole('dialog')
        expect(await within(dialog).findByText(/Es fehlen 2 h/)).toBeTruthy()
        expect(within(dialog).queryByText('Alles passt – nichts zu ändern.')).toBeNull()
        expect(within(dialog).queryByRole('button', { name: 'Übernehmen' })).toBeNull()
        expect(within(dialog).getAllByRole('button', { name: 'Schließen' }).length).toBeGreaterThan(0)
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
