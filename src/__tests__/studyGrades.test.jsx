import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_ACCESS, LOGIN_SUCCESS } from '../features/auth/authActionTypes'
import { parseGrade, formatGrade } from '../features/study/grades'
import StudyPage from '../components/study/StudyPage'
import StudySettings from '../components/study/StudySettings'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const BASE = '/api/tester/study'
const calls = (path, method = 'GET') => apiFetch.mock.calls.filter(([url, options]) => url === path && (options?.method ?? 'GET') === method)
const bodyOf = (call) => JSON.parse(call[1].body)

let settings, subjects, goals
const goalOf = (over) => ({
    id: 11, subjectId: 1, kind: 'exam', name: 'Klausur 1', due: '2026-10-01', dueTime: null, planMode: 'days', status: 'done', shape: 'circle',
    grade: null, gradedAt: null, parts: [], sessions: [], ...over,
})

beforeEach(() => {
    sessionStorage.clear()
    apiFetch.mockReset()
    settings = { windows: [], sessionMinutes: 45, dailyMaxMinutes: 180, aiAuto: false, aiAvailable: false, gradeScale: 'points' }
    subjects = [
        { id: 1, name: 'Mathe', emoji: null, color: 'blue', archived: false, nextGoal: null, exam: { avg: 11, n: 2 }, other: { avg: null, n: 0 } },
    ]
    goals = [goalOf({ id: 11 }), goalOf({ id: 12, name: 'Aufsatz', kind: 'assignment', grade: 13, gradedAt: '2026-10-02T10:00:00Z' }), goalOf({ id: 13, name: 'Offen', status: 'active', due: '2099-01-01' })]
    apiFetch.mockImplementation(async (url, options = {}) => {
        const method = options.method ?? 'GET'
        const body = options.body ? JSON.parse(options.body) : undefined
        if (url === `${BASE}/subjects`) return subjects
        if (url === `${BASE}/settings` && method === 'GET') return settings
        if (url === `${BASE}/settings` && method === 'PUT') { settings = { ...settings, ...body }; return settings }
        if (url.startsWith(`${BASE}/goals?subject=`)) return goals
        const goalMatch = url.match(new RegExp(`^${BASE}/goals/(\\d+)$`))
        if (goalMatch) {
            const goal = goals.find(g => g.id === Number(goalMatch[1]))
            if (method === 'GET') return goal
            if (method === 'PATCH') {
                Object.assign(goal, body)
                if ('grade' in body) goal.gradedAt = body.grade == null ? null : '2026-11-11T10:00:00Z'
                return goal
            }
        }
        if (url === `${BASE}/status`) return { goals: [], aiAvailable: false }
        return {}
    })
})
afterEach(cleanup)

function makeStore() {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 't', username: 'u', displayName: 'U' } })
    store.dispatch({ type: SET_ACCESS, payload: { isPro: true, isAdmin: false, isTester: true, adminPendingCount: 0, betaRequest: null } })
    return store
}

function open(path, element) {
    render(
        <Provider store={makeStore()}>
            <MemoryRouter initialEntries={[path]}>
                <Routes>
                    <Route path="/study" element={element ?? <StudyPage />} />
                    <Route path="/study/goals/:id" element={<StudyPage />} />
                    <Route path="/study/:subjectId" element={<StudyPage />} />
                </Routes>
            </MemoryRouter>
        </Provider>,
    )
}

describe('grade helpers', () => {
    it('parses a typed grade in the scale (comma or dot), null when out of range', () => {
        expect(parseGrade('12', 'points')).toBe(12)
        expect(parseGrade('12,5', 'points')).toBe(12.5)
        expect(parseGrade('2,3', 'marks')).toBe(2.3)
        expect(parseGrade('2.3', 'marks')).toBe(2.3)
        expect(parseGrade('16', 'points')).toBeNull()
        expect(parseGrade('0', 'marks')).toBeNull()
        expect(parseGrade('7', 'marks')).toBeNull()
        expect(parseGrade('abc', 'points')).toBeNull()
        expect(parseGrade('', 'points')).toBeNull()
    })

    it('shows a grade with a comma in German and an en dash without one', () => {
        expect(formatGrade(2.3, 'de')).toBe('2,3')
        expect(formatGrade(2.3, 'en')).toBe('2.3')
        expect(formatGrade(11, 'de')).toBe('11')
        expect(formatGrade(null, 'de')).toBe('–')
    })
})

describe('Lernen as school life: grades', () => {
    it('the subject list shows the exam average and the other work average, an en dash without grades', async () => {
        open('/study')
        const row = (await screen.findByText('Mathe')).closest('li')
        expect(within(row).getByText('Klausuren Ø 11')).toBeTruthy()
        expect(within(row).getByText('Sonstige Ø –')).toBeTruthy()
    })

    it('a subject page lists open work apart from finished work with its grade', async () => {
        open('/study/1')
        const openList = await screen.findByRole('list', { name: 'Offen' })
        expect(within(openList).getByText('Offen')).toBeTruthy()
        const finished = screen.getByRole('list', { name: 'Erledigt' })
        expect(within(finished).getByText('Aufsatz')).toBeTruthy()
        expect(within(finished).getByText('Note: 13')).toBeTruthy()
        expect(within(finished).getByText('Klausur 1')).toBeTruthy()
        expect(within(finished).getByRole('button', { name: 'Note eintragen: Klausur 1' })).toBeTruthy()
    })

    it('a grade is typed for finished work and saved in the account\'s scale', async () => {
        open('/study/1')
        fireEvent.click(await screen.findByRole('button', { name: 'Note eintragen: Klausur 1' }))
        const dialog = await screen.findByRole('dialog')
        fireEvent.change(within(dialog).getByLabelText('Notenpunkte (0–15)'), { target: { value: '12' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }))
        await waitFor(() => expect(calls(`${BASE}/goals/11`, 'PATCH')).toHaveLength(1))
        expect(bodyOf(calls(`${BASE}/goals/11`, 'PATCH')[0])).toEqual({ grade: 12 })
    })

    it('an invalid grade says so and sends nothing; "Note entfernen" clears one', async () => {
        open('/study/1')
        fireEvent.click(await screen.findByRole('button', { name: 'Note ändern: Aufsatz' }))
        const dialog = await screen.findByRole('dialog')
        const field = within(dialog).getByLabelText('Notenpunkte (0–15)')
        expect(field).toHaveValue('13')
        fireEvent.change(field, { target: { value: '16' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }))
        expect(await within(dialog).findByRole('alert')).toHaveTextContent('0 bis 15')
        expect(calls(`${BASE}/goals/12`, 'PATCH')).toHaveLength(0)
        fireEvent.click(within(dialog).getByRole('button', { name: 'Note entfernen' }))
        await waitFor(() => expect(calls(`${BASE}/goals/12`, 'PATCH')).toHaveLength(1))
        expect(bodyOf(calls(`${BASE}/goals/12`, 'PATCH')[0])).toEqual({ grade: null })
    })

    it('with marks the field asks for 1-6', async () => {
        settings.gradeScale = 'marks'
        open('/study/1')
        fireEvent.click(await screen.findByRole('button', { name: 'Note eintragen: Klausur 1' }))
        const dialog = await screen.findByRole('dialog')
        fireEvent.change(within(dialog).getByLabelText('Note (1–6)'), { target: { value: '2,3' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }))
        await waitFor(() => expect(calls(`${BASE}/goals/11`, 'PATCH')).toHaveLength(1))
        expect(bodyOf(calls(`${BASE}/goals/11`, 'PATCH')[0])).toEqual({ grade: 2.3 })
    })

    it('finishing a goal offers the grade; skipping saves nothing', async () => {
        // a goal whose day is over asks "Als erledigt markieren"; the sheet follows
        goals = [goalOf({ id: 13, name: 'Vorbei', status: 'active', due: '2020-01-01' })]
        open('/study/goals/13')
        fireEvent.click(await screen.findByRole('button', { name: 'Als erledigt markieren' }))
        const dialog = await screen.findByRole('dialog', { name: 'Note eintragen' })
        expect(bodyOf(calls(`${BASE}/goals/13`, 'PATCH')[0])).toEqual({ status: 'done' })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Überspringen' }))
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Note eintragen' })).toBeNull(), { timeout: 3000 })
        expect(calls(`${BASE}/goals/13`, 'PATCH').filter(c => 'grade' in bodyOf(c))).toHaveLength(0)
    })
})

describe('Settings → Lernen: the grade scale', () => {
    it('switches between points and marks and saves it', async () => {
        render(<Provider store={makeStore()}><MemoryRouter><StudySettings /></MemoryRouter></Provider>)
        const marks = await screen.findByRole('radio', { name: 'Noten 1–6' })
        expect(screen.getByRole('radio', { name: 'Notenpunkte 0–15' })).toHaveAttribute('aria-checked', 'true')
        fireEvent.click(marks)
        fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
        await waitFor(() => expect(calls(`${BASE}/settings`, 'PUT')).toHaveLength(1))
        expect(bodyOf(calls(`${BASE}/settings`, 'PUT')[0]).gradeScale).toBe('marks')
    })
})
