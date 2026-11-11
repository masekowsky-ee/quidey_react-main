import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, cleanup, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_ACCESS } from '../features/auth/authActionTypes'
import {
    fetchSubjects, saveSubject, deleteSubject, fetchGoal, fetchGoals, deleteGoal,
    fetchStudySettings, saveStudySettings, fetchStudyStatus, fetchPlanPreview, applyPlan,
    studyNow, unpinSession, selectSubjects, selectGoal, selectPlanPreview, selectStudyStatus,
} from '../features/study/study'
import { PUSH_KINDS } from '../features/pwa/push'
import { NATIVE_CHANNELS } from '../features/native/nativePush'
import translations from '../i18n/translations'
import Settings from '../components/Settings'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))
vi.mock('../features/pwa/push', async (importOriginal) => ({
    ...(await importOriginal()),
    refreshPush: vi.fn(),
    usePushState: () => ({ status: 'on', kinds: { plan: true, digest: true, messages: true, social: true, groups: true, study: true }, busy: false, error: null, detail: null, diagnosis: null }),
}))

const SETTINGS = { windows: [], sessionMinutes: 45, dailyMaxMinutes: 180, aiAuto: false, aiAvailable: true }
const calls = (path, method = 'GET') => apiFetch.mock.calls.filter(([url, options]) => url === path && (options?.method ?? 'GET') === method)
const makeStore = () => configureStore({ reducer: rootReducer, middleware: (get) => get({ serializableCheck: false, immutableCheck: false }) })

let settings, plan
beforeEach(() => {
    apiFetch.mockReset()
    settings = { ...SETTINGS }
    plan = { inputHash: 'a'.repeat(64), shortfall: {}, goals: [] }
    apiFetch.mockImplementation(async (url, options = {}) => {
        if (url === '/api/tester/study/plan') return structuredClone(plan)
        if (url === '/api/tester/study/settings' && options.method === 'PUT') {
            settings = { ...settings, ...JSON.parse(options.body) }
            return settings
        }
        if (url === '/api/tester/study/settings') return settings
        return []
    })
    window.matchMedia = vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
})

describe('study slice', () => {
    it('stores subjects and goals', async () => {
        const store = makeStore()
        const subjects = [{ id: 1, name: 'Mathe', emoji: null, color: 'blue', archived: false, nextGoal: null }]
        apiFetch.mockResolvedValueOnce(subjects)
        expect(await store.dispatch(fetchSubjects())).toEqual(subjects)
        expect(selectSubjects(store.getState())).toEqual(subjects)
        expect(calls('/api/tester/study/subjects')).toHaveLength(1)

        const goal = { id: 5, subjectId: 1, name: 'Klausur', parts: [], sessions: [] }
        apiFetch.mockResolvedValueOnce(goal)
        await store.dispatch(fetchGoal(5))
        expect(selectGoal(5)(store.getState())).toEqual(goal)

        apiFetch.mockResolvedValueOnce([{ ...goal, id: 6 }])
        await store.dispatch(fetchGoals(1))
        expect(calls('/api/tester/study/goals?subject=1')).toHaveLength(1)
        expect(selectGoal(6)(store.getState()).id).toBe(6)
        expect(selectGoal(5)(store.getState())).toBeTruthy()
    })

    it('saves and deletes a subject; a refused name rejects with the code', async () => {
        const store = makeStore()
        apiFetch.mockResolvedValueOnce({ id: 2, name: 'Bio' })
        await store.dispatch(saveSubject(null, { name: 'Bio' }))
        expect(calls('/api/tester/study/subjects', 'POST')).toHaveLength(1)
        expect(selectSubjects(store.getState()).map(s => s.id)).toEqual([2])
        apiFetch.mockResolvedValueOnce({ id: 2, name: 'Biologie' })
        await store.dispatch(saveSubject(2, { name: 'Biologie' }))
        expect(calls('/api/tester/study/subjects/2', 'PATCH')).toHaveLength(1)
        expect(selectSubjects(store.getState())[0].name).toBe('Biologie')
        apiFetch.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 400, code: 'subject_exists' }))
        await expect(store.dispatch(saveSubject(null, { name: 'Biologie' }))).rejects.toMatchObject({ code: 'subject_exists' })
        apiFetch.mockResolvedValueOnce({ ok: true, removedSessions: 0 })
        await store.dispatch(deleteSubject(2))
        expect(selectSubjects(store.getState())).toEqual([])
    })

    it('renaming a subject keeps its next goal', async () => {
        const store = makeStore()
        const nextGoal = { id: 5, name: 'Klausur', kind: 'exam', due: '2026-12-01', progress: 0.5, behindMinutes: 0 }
        apiFetch.mockResolvedValueOnce([{ id: 2, name: 'Bio', archived: false, nextGoal }])
        await store.dispatch(fetchSubjects())
        apiFetch.mockResolvedValueOnce({ id: 2, name: 'Biologie', archived: false, nextGoal: null })
        await store.dispatch(saveSubject(2, { name: 'Biologie' }))
        expect(selectSubjects(store.getState())[0]).toMatchObject({ name: 'Biologie', nextGoal })
    })

    it('deleting a goal with its sessions reloads the tasks', async () => {
        const store = makeStore()
        apiFetch.mockResolvedValueOnce({ id: 5, parts: [], sessions: [] })
        await store.dispatch(fetchGoal(5))
        apiFetch.mockImplementation(async (url) => (url.startsWith('/api/tester/study/goals/5') ? { ok: true, removedSessions: 2 } : []))
        await store.dispatch(deleteGoal(5, 'delete'))
        expect(calls('/api/tester/study/goals/5?sessions=delete', 'DELETE')).toHaveLength(1)
        expect(selectGoal(5)(store.getState())).toBeUndefined()
        expect(calls('/api/tasks')).toHaveLength(1)
    })

    it('settings and status are stored', async () => {
        const store = makeStore()
        await store.dispatch(fetchStudySettings())
        expect(store.getState().study.settings).toEqual(SETTINGS)
        await store.dispatch(saveStudySettings({ sessionMinutes: 60 }))
        expect(store.getState().study.settings.sessionMinutes).toBe(60)
        const status = { goals: [], notifiedMinutes: {}, aiAvailable: false }
        apiFetch.mockResolvedValueOnce(status)
        await store.dispatch(fetchStudyStatus())
        expect(selectStudyStatus(store.getState())).toEqual(status)
    })

    it('applyPlan: a 409 stores the fresh preview and rejects with plan_changed', async () => {
        const store = makeStore()
        const fresh = { inputHash: 'b'.repeat(64), shortfall: [], goals: [] }
        apiFetch.mockRejectedValueOnce(Object.assign(new Error('The plan has changed'), { status: 409, code: 'plan_changed', data: { code: 'plan_changed', preview: fresh } }))
        await expect(store.dispatch(applyPlan('a'.repeat(64)))).rejects.toMatchObject({ code: 'plan_changed' })
        expect(selectPlanPreview(store.getState())).toEqual(fresh)
        expect(calls('/api/tasks')).toHaveLength(0)
    })

    it('applyPlan reloads the goals in the store, unpinSession the goal of the session', async () => {
        const store = makeStore()
        const goal = (pinned) => ({ id: 5, subjectId: 1, parts: [], sessions: [{ taskId: 9, partId: 1, due: '2026-12-01', dueTime: null, minutes: 45, done: false, focusMs: 0, pinned }] })
        let pinned = true
        apiFetch.mockImplementation(async (url) => {
            if (url === '/api/tester/study/goals/5') return goal(pinned)
            if (url.endsWith('/unpin')) { pinned = false; return { ok: true } }
            return url === '/api/tasks' || url === '/api/event-types' ? [] : { ok: true }
        })
        await store.dispatch(fetchGoal(5))
        await store.dispatch(applyPlan('a'.repeat(64)))
        expect(calls('/api/tester/study/goals/5')).toHaveLength(2)
        await store.dispatch(unpinSession(9))
        expect(calls('/api/tester/study/goals/5')).toHaveLength(3)
        expect(selectGoal(5)(store.getState()).sessions[0].pinned).toBe(false)
    })

    it('a new colour of a subject reloads the tasks (its sessions take it)', async () => {
        const store = makeStore()
        apiFetch.mockImplementation(async (url) => (url === '/api/tasks' || url === '/api/event-types' ? [] : { id: 2, name: 'Bio', color: 'red' }))
        await store.dispatch(saveSubject(2, { name: 'Biologie' }))
        expect(calls('/api/tasks')).toHaveLength(0)
        await store.dispatch(saveSubject(2, { color: 'red' }))
        expect(calls('/api/tasks')).toHaveLength(1)
    })

    it('applyPlan, studyNow and unpinSession reload the tasks', async () => {
        const store = makeStore()
        apiFetch.mockImplementation(async (url) => (url === '/api/tasks' || url === '/api/event-types' ? [] : { ok: true, task: { id: 9 } }))
        await store.dispatch(fetchPlanPreview())
        expect(calls('/api/tester/study/plan')).toHaveLength(1)
        await store.dispatch(applyPlan('a'.repeat(64)))
        expect(JSON.parse(calls('/api/tester/study/replan', 'POST')[0][1].body)).toEqual({ inputHash: 'a'.repeat(64) })
        expect(calls('/api/tasks')).toHaveLength(1)
        expect(selectPlanPreview(store.getState())).toBeNull()
        await store.dispatch(studyNow(3))
        expect(calls('/api/tester/study/parts/3/now', 'POST')).toHaveLength(1)
        expect(calls('/api/tasks')).toHaveLength(2)
        await store.dispatch(unpinSession(9))
        expect(calls('/api/tester/study/sessions/9/unpin', 'POST')).toHaveLength(1)
        expect(calls('/api/tasks')).toHaveLength(3)
    })
})

describe('push kind study', () => {
    it('is a kind with a native channel and texts in both languages', () => {
        expect(PUSH_KINDS).toContain('study')
        expect(NATIVE_CHANNELS.study).toEqual({ de: 'Lernen', en: 'Studying', importance: 3 })
        expect(translations.de.pushKind_study).toBe('Lernen')
        expect(translations.en.pushKind_study).toBe('Studying')
        expect(translations.de.pushKindHint_study).toBe('Wenn ein Ziel hinter seinem Plan liegt, höchstens einmal am Tag.')
        expect(translations.en.pushKindHint_study).toBe('When a goal falls behind its plan, at most once a day.')
    })
})

function renderSettings({ tester = true, hash = '#plan' } = {}) {
    const store = makeStore()
    store.dispatch({ type: SET_ACCESS, payload: { isPro: true, isTester: tester } })
    render(<Provider store={store}><MemoryRouter initialEntries={[`/settings${hash}`]}><Settings /></MemoryRouter></Provider>)
    return store
}

describe('Settings → Lernen', () => {
    it('shows the section to testers only', async () => {
        renderSettings()
        expect(await screen.findByRole('heading', { name: 'Lernen' })).toBeInTheDocument()
    })

    it('is there for everybody, not only testers', async () => {
        renderSettings({ tester: false })
        expect(await screen.findByRole('group', { name: 'Mo' })).toBeInTheDocument()
        expect(calls('/api/tester/study/settings').length).toBeGreaterThan(0)
    })

    it('adds a window and saves everything with one Speichern', async () => {
        renderSettings()
        const monday = await screen.findByRole('group', { name: 'Mo' })
        fireEvent.click(within(monday).getByRole('button', { name: /Lernzeit hinzufügen/ }))
        const [start, end] = within(monday).getAllByLabelText(/Beginn|Ende/)
        fireEvent.change(start, { target: { value: '15:00' } })
        fireEvent.change(end, { target: { value: '19:00' } })
        fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
        await waitFor(() => expect(calls('/api/tester/study/settings', 'PUT')).toHaveLength(1))
        expect(JSON.parse(calls('/api/tester/study/settings', 'PUT')[0][1].body)).toEqual({
            windows: [{ weekday: 1, start: '15:00', end: '19:00' }], sessionMinutes: 45, dailyMaxMinutes: 180, aiAuto: false, gradeScale: 'points',
        })
    })

    it('a saved change of the study times opens the plan preview when a goal is planned', async () => {
        plan.goals = [{ goalId: 7, name: 'Klausur', summary: { moved: 2, added: 0, dropped: 0, unchanged: 1 }, changes: [] }]
        renderSettings()
        const monday = await screen.findByRole('group', { name: 'Mo' })
        fireEvent.click(within(monday).getByRole('button', { name: /Lernzeit hinzufügen/ }))
        fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
        const dialog = await screen.findByRole('dialog')
        expect(within(dialog).getByRole('heading', { name: 'Neuer Plan' })).toBeInTheDocument()
        expect(await within(dialog).findByText('2 Sitzungen verschoben')).toBeInTheDocument()
    })

    it('no preview after saving when no goal is planned, nor when only the AI switch changed', async () => {
        renderSettings()
        const monday = await screen.findByRole('group', { name: 'Mo' })
        fireEvent.click(within(monday).getByRole('button', { name: /Lernzeit hinzufügen/ }))
        fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
        expect(await screen.findByText('Gespeichert')).toBeInTheDocument()
        await waitFor(() => expect(calls('/api/tester/study/plan')).toHaveLength(1))
        expect(screen.queryByRole('dialog')).toBeNull()

        plan.goals = [{ goalId: 7, name: 'Klausur', summary: { moved: 2, added: 0, dropped: 0, unchanged: 1 }, changes: [] }]
        fireEvent.click(screen.getByRole('switch', { name: 'KI-Schätzungen automatisch' }))
        fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
        await waitFor(() => expect(calls('/api/tester/study/settings', 'PUT')).toHaveLength(2))
        expect(await screen.findByText('Gespeichert')).toBeInTheDocument()
        expect(calls('/api/tester/study/plan')).toHaveLength(1)
        expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('removes a window', async () => {
        settings.windows = [{ weekday: 2, start: '10:00', end: '12:00' }]
        renderSettings()
        const tuesday = await screen.findByRole('group', { name: 'Di' })
        fireEvent.click(await within(tuesday).findByRole('button', { name: /Lernzeit entfernen/ }))
        fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
        await waitFor(() => expect(calls('/api/tester/study/settings', 'PUT')).toHaveLength(1))
        expect(JSON.parse(calls('/api/tester/study/settings', 'PUT')[0][1].body).windows).toEqual([])
    })

    it('shows the AI switch with its note only when the server has a key', async () => {
        renderSettings()
        expect(await screen.findByText('KI-Schätzungen automatisch')).toBeInTheDocument()
        expect(screen.getByText('Sendet nur die Namen deiner Themen, das Fach, die Art und die Tage bis zum Termin an Anthropic.')).toBeInTheDocument()
    })

    it('hides the AI switch when aiAvailable is false', async () => {
        settings.aiAvailable = false
        renderSettings()
        await screen.findByRole('group', { name: 'Mo' })
        expect(screen.queryByText('KI-Schätzungen automatisch')).not.toBeInTheDocument()
    })

    it('shows the server refusal inline', async () => {
        renderSettings()
        await screen.findByRole('group', { name: 'Mo' })
        apiFetch.mockImplementationOnce(async () => { throw Object.assign(new Error('Invalid study window'), { status: 400, code: 'invalid_window' }) })
        fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
        expect(await screen.findByRole('alert')).toHaveTextContent(/Lernzeit/)
    })

    it('the push list has the study kind for everybody, not only testers', async () => {
        renderSettings({ hash: '#app', tester: false })
        expect(await screen.findByText('Aufgaben und Termine')).toBeInTheDocument()
        expect(screen.getByText('Wenn ein Ziel hinter seinem Plan liegt, höchstens einmal am Tag.')).toBeInTheDocument()
    })

    it('a second visit shows the fresh settings, not the cached ones', async () => {
        const store = renderSettings()
        await screen.findByRole('group', { name: 'Mo' })
        settings = { ...settings, sessionMinutes: 90 }
        cleanup()
        render(<Provider store={store}><MemoryRouter initialEntries={['/settings#plan']}><Settings /></MemoryRouter></Provider>)
        expect(await screen.findByDisplayValue('90')).toBeInTheDocument()
    })

    it('the push list in Settings has the study kind', async () => {
        renderSettings({ hash: '#app' })
        expect(await screen.findByText('Lernen')).toBeInTheDocument()
        expect(screen.getByText('Wenn ein Ziel hinter seinem Plan liegt, höchstens einmal am Tag.')).toBeInTheDocument()
    })
})
