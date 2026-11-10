import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch, toInputDate } from '../features/helperFunction'
import { SET_ACCESS, LOGIN_SUCCESS } from '../features/auth/authActionTypes'
import { formatHours } from '../features/study/study'
import StudyPage from '../components/study/StudyPage'
import TesterOnly from '../components/TesterOnly'
import { TEST_FEATURES } from '../features/tester/feedback'
import translations from '../i18n/translations'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const BASE = '/api/tester/study'
const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return toInputDate(d) }
const calls = (path, method = 'GET') => apiFetch.mock.calls.filter(([url, options]) => url === path && (options?.method ?? 'GET') === method)
const bodyOf = (call) => JSON.parse(call[1].body)

const part = (id, name, extra = {}) => ({ id, name, position: id, estimateMinutes: 180, estimateSource: 'default', role: 'part', doneAt: null, credit: 0, remaining: 180, ...extra })

let subjects, goals
const resetData = () => {
    subjects = [
        { id: 1, name: 'Mathe', emoji: null, color: 'blue', archived: false, nextGoal: { id: 10, name: 'Klausur Analysis', kind: 'exam', due: inDays(12), progress: 0.4, behindMinutes: 90 } },
        { id: 2, name: 'Physik', emoji: null, color: 'green', archived: false, nextGoal: null },
        { id: 3, name: 'Latein', emoji: null, color: null, archived: true, nextGoal: null },
    ]
    goals = {
        10: {
            id: 10, subjectId: 1, kind: 'exam', name: 'Klausur Analysis', due: inDays(12), dueTime: null, planMode: 'days', status: 'active',
            parts: [
                part(100, 'Thema 3', { credit: 90, remaining: 90 }),
                part(101, 'Thema 4'),
                part(102, 'Wiederholung', { role: 'review', estimateMinutes: 60, remaining: 60 }),
            ],
            sessions: [{ taskId: 900, partId: 100, due: inDays(2), dueTime: '17:00', minutes: 45, done: false, focusMs: 0, pinned: false }],
        },
        11: { id: 11, subjectId: 1, kind: 'assignment', name: 'Abgabe Übung', due: inDays(3), dueTime: null, planMode: 'days', status: 'active', parts: [part(110, 'Aufgabe 1')], sessions: [] },
    }
}

beforeEach(() => {
    apiFetch.mockReset()
    resetData()
    apiFetch.mockImplementation(async (url, options = {}) => {
        const method = options.method ?? 'GET'
        const body = options.body ? JSON.parse(options.body) : undefined
        if (url === `${BASE}/subjects` && method === 'GET') return subjects
        if (url === `${BASE}/subjects` && method === 'POST') {
            const made = { id: 9, name: body.name, emoji: null, color: null, archived: false, nextGoal: null }
            subjects = [...subjects, made]
            return made
        }
        const patchSubject = url.match(new RegExp(`^${BASE}/subjects/(\\d+)$`))
        if (patchSubject && method === 'PATCH') return { ...subjects.find(s => s.id === Number(patchSubject[1])), ...body, nextGoal: null }
        if (url.startsWith(`${BASE}/goals?subject=`)) {
            const id = Number(url.split('=')[1])
            return Object.values(goals).filter(g => g.subjectId === id).sort((a, b) => a.due.localeCompare(b.due))
        }
        const goalUrl = url.match(new RegExp(`^${BASE}/goals/(\\d+)$`))
        if (goalUrl && method === 'GET') return structuredClone(goals[goalUrl[1]])
        if (goalUrl && method === 'PATCH') {
            goals[goalUrl[1]] = { ...goals[goalUrl[1]], ...body }
            return structuredClone(goals[goalUrl[1]])
        }
        if (url === `${BASE}/plan`) return { inputHash: 'a'.repeat(64), shortfall: { 10: 0 }, goals: [{ goalId: 10, name: 'Klausur Analysis', summary: { moved: 1, added: 0, dropped: 0, unchanged: 0 }, changes: [] }] }
        const unpin = url.match(/\/sessions\/(\d+)\/unpin$/)
        if (unpin) {
            for (const goal of Object.values(goals)) goal.sessions = goal.sessions.map(x => (x.taskId === Number(unpin[1]) ? { ...x, pinned: false } : x))
            return { ok: true }
        }
        if (goalUrl && method === 'DELETE') return { ok: true, removedSessions: 0 }
        const partUrl = url.match(new RegExp(`^${BASE}/parts/(\\d+)$`))
        if (partUrl && method === 'PATCH') {
            for (const goal of Object.values(goals)) {
                goal.parts = goal.parts.map(p => p.id !== Number(partUrl[1]) ? p : {
                    ...p, ...(body.estimateMinutes ? { estimateMinutes: body.estimateMinutes, estimateSource: 'manual' } : {}),
                    ...('doneAt' in body ? { doneAt: body.doneAt || null } : {}),
                })
            }
            return {}
        }
        if (url.match(/\/parts\/\d+\/now$/)) return { task: { id: 777, name: 'Thema 3', due: inDays(0) } }
        if (url.match(/\/parts\/order$/)) return []
        return []
    })
    window.matchMedia = vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
})
afterEach(cleanup)

const makeStore = (isTester = true) => {
    const store = configureStore({ reducer: rootReducer, middleware: (get) => get({ serializableCheck: false, immutableCheck: false }) })
    store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 'tok', username: 'lena' } })
    store.dispatch({ type: SET_ACCESS, payload: { isPro: true, isAdmin: false, isTester, adminPendingCount: 0, betaRequest: null } })
    return store
}

function Where() {
    const location = useLocation()
    return <div data-testid="where">{location.pathname + location.search}</div>
}

function open(path, store = makeStore()) {
    const page = <TesterOnly fallback={<Navigate to="/" replace />}><StudyPage /></TesterOnly>
    render(
        <Provider store={store}>
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
    return store
}

describe('formatHours', () => {
    it('one decimal, comma in German, whole hours without decimals', () => {
        expect(formatHours(390, 'de')).toBe('6,5 h')
        expect(formatHours(390, 'en')).toBe('6.5 h')
        expect(formatHours(180, 'de')).toBe('3 h')
        expect(formatHours(0, 'de')).toBe('0 h')
    })
})

describe('study area', () => {
    it('is listed among the features in test (out for everybody) with texts in both languages', () => {
        expect(TEST_FEATURES.find(f => f.id === 'study')).toMatchObject({ to: '/study' })
        expect(TEST_FEATURES.find(f => f.id === 'study').testerOnly).toBeUndefined()
        for (const language of ['de', 'en']) {
            expect(translations[language].testerFeature_study).toBeTruthy()
            expect(translations[language].testerFeatureHint_study).toBeTruthy()
            expect(translations[language].studyNav).toBeTruthy()
        }
    })

    it('sends a non-tester on /study to /', async () => {
        open('/study', makeStore(false))
        expect(await screen.findByText('HOME')).toBeInTheDocument()
        expect(calls(`${BASE}/subjects`)).toHaveLength(0)
    })
})

describe('subject list', () => {
    it('shows the next goal, its countdown and a warning when behind', async () => {
        open('/study')
        const row = (await screen.findByText('Mathe')).closest('li')
        expect(within(row).getByText('Klausur Analysis')).toBeInTheDocument()
        expect(within(row).getByText('in 12 Tagen')).toBeInTheDocument()
        expect(within(row).getByText(/Im Rückstand/)).toBeInTheDocument()
        const physik = screen.getByText('Physik').closest('li')
        expect(within(physik).queryByText(/Im Rückstand/)).toBeNull()
        expect(within(physik).getByText('Noch kein Ziel')).toBeInTheDocument()
    })

    it('keeps archived subjects in a collapsed group', async () => {
        open('/study')
        await screen.findByText('Mathe')
        expect(screen.queryByText('Latein')).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: /Archivierte Fächer \(1\)/ }))
        expect(screen.getByText('Latein')).toBeInTheDocument()
    })

    it('creates a subject with "+ Fach"', async () => {
        open('/study')
        await screen.findByText('Mathe')
        fireEvent.change(screen.getByLabelText('Name des Fachs'), { target: { value: 'Chemie' } })
        fireEvent.click(screen.getByRole('button', { name: /Fach$/ }))
        await waitFor(() => expect(calls(`${BASE}/subjects`, 'POST')).toHaveLength(1))
        expect(bodyOf(calls(`${BASE}/subjects`, 'POST')[0]).name).toBe('Chemie')
        expect(await screen.findByText('Chemie')).toBeInTheDocument()
    })

    it('links a subject to its page', async () => {
        open('/study')
        fireEvent.click(await screen.findByRole('link', { name: /Mathe/ }))
        expect(screen.getByTestId('where')).toHaveTextContent('/study/1')
    })
})

describe('subject page', () => {
    it('edits the subject: name, emoji and colour', async () => {
        open('/study/1')
        fireEvent.click(await screen.findByRole('button', { name: 'Fach bearbeiten' }))
        const dialog = await screen.findByRole('dialog')
        const name = within(dialog).getByLabelText('Name des Fachs')
        expect(name).toHaveValue('Mathe')
        fireEvent.change(name, { target: { value: 'Mathematik' } })
        fireEvent.change(within(dialog).getByLabelText('Emoji (optional)'), { target: { value: '📐' } })
        fireEvent.click(within(dialog).getByRole('radio', { name: 'Rot' }))
        fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }))
        await waitFor(() => expect(calls(`${BASE}/subjects/1`, 'PATCH')).toHaveLength(1))
        expect(bodyOf(calls(`${BASE}/subjects/1`, 'PATCH')[0])).toEqual({ name: 'Mathematik', emoji: '📐', color: 'red' })
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
        expect(screen.getByRole('heading', { name: /Mathematik/ })).toBeInTheDocument()
    })

    it('a past goal is marked as such in the list', async () => {
        goals[11].due = inDays(-1)
        open('/study/1')
        const row = (await screen.findByText('Abgabe Übung')).closest('li')
        expect(within(row).getByText('Vorbei')).toBeInTheDocument()
    })

    it('lists the goals by date and leads to + Ziel', async () => {
        open('/study/1')
        const links = await screen.findAllByRole('link', { name: /Abgabe Übung|Klausur Analysis/ })
        expect(links.map(l => l.textContent.includes('Abgabe Übung'))).toEqual([true, false])
        fireEvent.click(screen.getByRole('button', { name: /Ziel$/ }))
        expect(screen.getByTestId('where')).toHaveTextContent('/study/1?new=goal')
    })
})

describe('goal page', () => {
    it('shows the parts with their credit and estimate', async () => {
        open('/study/goals/10')
        expect(await screen.findByText(/Thema 3 · 1,5 \/ 3 h/)).toBeInTheDocument()
        expect(screen.getByText(/Thema 4 · 0 \/ 3 h/)).toBeInTheDocument()
        expect(screen.getByText('1,5 von 7 h')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Neu planen' })).toBeInTheDocument()
    })

    it('"Neu planen" opens ?replan=1', async () => {
        open('/study/goals/10')
        fireEvent.click(await screen.findByRole('button', { name: 'Neu planen' }))
        expect(screen.getByTestId('where')).toHaveTextContent('/study/goals/10?replan=1')
    })

    it('ticking a part calls updatePart with doneAt', async () => {
        open('/study/goals/10')
        fireEvent.click(await screen.findByRole('checkbox', { name: 'Erledigt: Thema 3' }))
        await waitFor(() => expect(calls(`${BASE}/parts/100`, 'PATCH')).toHaveLength(1))
        expect(bodyOf(calls(`${BASE}/parts/100`, 'PATCH')[0]).doneAt).toBeTruthy()
    })

    it('the stepper moves the estimate in 15-minute steps and shows source "manuell"', async () => {
        open('/study/goals/10')
        await screen.findByText(/Thema 4 ·/)
        fireEvent.click(screen.getByRole('button', { name: 'Mehr Zeit: Thema 4' }))
        await waitFor(() => expect(calls(`${BASE}/parts/101`, 'PATCH')).toHaveLength(1))
        expect(bodyOf(calls(`${BASE}/parts/101`, 'PATCH')[0])).toEqual({ estimateMinutes: 195 })
        const row = (await screen.findByText(/Thema 4 ·/)).closest('li')
        await waitFor(() => expect(within(row).getByText('manuell')).toBeInTheDocument())
        fireEvent.click(within(row).getByRole('button', { name: 'Weniger Zeit: Thema 4' }))
        await waitFor(() => expect(calls(`${BASE}/parts/101`, 'PATCH')).toHaveLength(2))
        expect(bodyOf(calls(`${BASE}/parts/101`, 'PATCH')[1])).toEqual({ estimateMinutes: 180 })
    })

    it('does not step below 15 or above 1200 minutes', async () => {
        goals[10].parts[1] = part(101, 'Thema 4', { estimateMinutes: 15 })
        goals[10].parts[0] = part(100, 'Thema 3', { estimateMinutes: 1200 })
        open('/study/goals/10')
        await screen.findByText(/Thema 4 ·/)
        expect(screen.getByRole('button', { name: 'Weniger Zeit: Thema 4' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Mehr Zeit: Thema 3' })).toBeDisabled()
    })

    it('moves a part with the buttons and keeps the review part last', async () => {
        open('/study/goals/10')
        await screen.findByText(/Thema 4 ·/)
        expect(screen.getByRole('button', { name: 'Nach oben: Thema 3' })).toBeDisabled()
        expect(screen.queryByRole('button', { name: 'Nach unten: Wiederholung' })).toBeNull()
        expect(screen.getByRole('button', { name: 'Nach unten: Thema 4' })).toBeDisabled()
        fireEvent.click(screen.getByRole('button', { name: 'Nach unten: Thema 3' }))
        await waitFor(() => expect(calls(`${BASE}/goals/10/parts/order`, 'PUT')).toHaveLength(1))
        expect(bodyOf(calls(`${BASE}/goals/10/parts/order`, 'PUT')[0])).toEqual({ ids: [101, 100, 102] })
    })

    it('"Jetzt lernen" studies the part now, focuses the returned task and starts the timer', async () => {
        const store = open('/study/goals/10')
        await screen.findByText(/Thema 3 ·/)
        fireEvent.click(screen.getAllByRole('button', { name: 'Jetzt lernen' })[0])
        await waitFor(() => expect(calls(`${BASE}/parts/100/now`, 'POST')).toHaveLength(1))
        await waitFor(() => expect(store.getState().session.focusTask).toMatchObject({ id: 777 }))
        expect(store.getState().session.timer.active).toBe(true)
    })

    it('a refused "Jetzt lernen" shows a toast and starts nothing', async () => {
        const base = apiFetch.getMockImplementation()
        apiFetch.mockImplementation(async (url, options) => {
            if (String(url).endsWith('/now')) throw Object.assign(new Error('x'), { status: 400, code: 'due_in_past' })
            return base(url, options)
        })
        const store = open('/study/goals/10')
        await screen.findByText(/Thema 3 ·/)
        fireEvent.click(screen.getAllByRole('button', { name: 'Jetzt lernen' })[0])
        await waitFor(() => expect(store.getState().toast.some(x => x.text === 'Der Termin dieses Ziels ist schon vorbei.')).toBe(true))
        expect(store.getState().session.timer.active).toBe(false)
    })

    it('unpinning a session clears its pin on the page', async () => {
        goals[10].sessions[0].pinned = true
        open('/study/goals/10')
        expect(await screen.findByText('festgesetzt')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Lösen' }))
        await waitFor(() => expect(screen.queryByText('festgesetzt')).toBeNull())
    })

    it('the goal settings save the edited fields and open the preview when the date changed', async () => {
        open('/study/goals/10')
        fireEvent.click(await screen.findByRole('button', { name: 'Ziel bearbeiten' }))
        const dialog = await screen.findByRole('dialog')
        fireEvent.change(within(dialog).getByLabelText('Name des Ziels'), { target: { value: 'Klausur Analysis 2' } })
        fireEvent.change(within(dialog).getByLabelText('Datum'), { target: { value: inDays(14) } })
        fireEvent.change(within(dialog).getByLabelText('Uhrzeit (optional)'), { target: { value: '09:30' } })
        fireEvent.click(within(dialog).getByRole('radio', { name: 'Referat' }))
        fireEvent.click(within(dialog).getByRole('radio', { name: 'In deinen Lernzeiten' }))
        fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }))
        await waitFor(() => expect(calls(`${BASE}/goals/10`, 'PATCH')).toHaveLength(1))
        expect(bodyOf(calls(`${BASE}/goals/10`, 'PATCH')[0])).toEqual({
            name: 'Klausur Analysis 2', kind: 'presentation', due: inDays(14), dueTime: '09:30', planMode: 'slots',
        })
        expect(await screen.findByRole('heading', { name: 'Neuer Plan' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Klausur Analysis 2' })).toBeInTheDocument()
    })

    it('renaming in the goal settings opens no preview', async () => {
        open('/study/goals/10')
        fireEvent.click(await screen.findByRole('button', { name: 'Ziel bearbeiten' }))
        const dialog = await screen.findByRole('dialog')
        fireEvent.change(within(dialog).getByLabelText('Name des Ziels'), { target: { value: 'Analysis' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }))
        await waitFor(() => expect(calls(`${BASE}/goals/10`, 'PATCH')).toHaveLength(1))
        expect(bodyOf(calls(`${BASE}/goals/10`, 'PATCH')[0])).toEqual({ name: 'Analysis' })
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
        expect(calls(`${BASE}/plan`)).toHaveLength(0)
    })

    it('the goal settings mark the goal done', async () => {
        open('/study/goals/10')
        fireEvent.click(await screen.findByRole('button', { name: 'Ziel bearbeiten' }))
        const dialog = await screen.findByRole('dialog')
        fireEvent.click(within(dialog).getByRole('button', { name: 'Als erledigt markieren' }))
        await waitFor(() => expect(calls(`${BASE}/goals/10`, 'PATCH')).toHaveLength(1))
        expect(bodyOf(calls(`${BASE}/goals/10`, 'PATCH')[0])).toEqual({ status: 'done' })
        expect(await screen.findByText('Erledigt', { selector: 'span' })).toBeInTheDocument()
    })

    it('a goal whose date is over shows "Vorbei" with done and archive', async () => {
        goals[10].due = inDays(-2)
        open('/study/goals/10')
        expect(await screen.findByText('Vorbei')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Ziel archivieren' }))
        await waitFor(() => expect(calls(`${BASE}/goals/10`, 'PATCH')).toHaveLength(1))
        expect(bodyOf(calls(`${BASE}/goals/10`, 'PATCH')[0])).toEqual({ status: 'archived' })
    })

    it('after a part edit a quiet line offers the preview, without opening it', async () => {
        open('/study/goals/10')
        await screen.findByText(/Thema 4 ·/)
        expect(screen.queryByText('Plan anpassen?')).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: 'Mehr Zeit: Thema 4' }))
        expect(await screen.findByText('Plan anpassen?')).toBeInTheDocument()
        expect(screen.queryByRole('dialog')).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: 'Plan ansehen' }))
        expect(await screen.findByRole('heading', { name: 'Neuer Plan' })).toBeInTheDocument()
    })

    it('deleting a goal asks what happens to the coming sessions', async () => {
        open('/study/goals/10')
        fireEvent.click(await screen.findByRole('button', { name: 'Ziel löschen' }))
        expect(screen.getByRole('button', { name: 'Künftige Lernsitzungen löschen' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'als normale Aufgaben behalten' }))
        await waitFor(() => expect(calls(`${BASE}/goals/10?sessions=keep`, 'DELETE')).toHaveLength(1))
        await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/study/1'))
    })

    it('can delete the coming sessions with the goal', async () => {
        open('/study/goals/10')
        fireEvent.click(await screen.findByRole('button', { name: 'Ziel löschen' }))
        fireEvent.click(screen.getByRole('button', { name: 'Künftige Lernsitzungen löschen' }))
        await waitFor(() => expect(calls(`${BASE}/goals/10?sessions=delete`, 'DELETE')).toHaveLength(1))
    })
})
