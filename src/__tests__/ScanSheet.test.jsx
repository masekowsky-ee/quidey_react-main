import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter } from 'react-router-dom'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_TASK_STATE } from '../features/tasks/taskActionTypes'
import { SET_ACCESS, LOGIN_SUCCESS } from '../features/auth/authActionTypes'
import { setLanguage } from '../features/settings/settingsAction'
import { forgetAiQuota } from '../features/ai/ai'
import ScanSheet from '../components/scan/ScanSheet'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const QUOTA = { available: true, scan: { used: 0, max: 1 }, aiLine: { used: 0, max: 5 }, resetsAt: '2026-11-09T23:00:00.000Z' }
const RESULT = {
    plan: { name: 'Biologie Klausur', kind: 'exam', due: '2026-12-02', subject: 'Biologie', parts: [{ name: 'Zellatmung', minutes: 90 }, { name: 'Fotosynthese', minutes: 60 }] },
    notes: { title: 'Zellatmung', body: '# Zellatmung\n- Glykolyse\n- [ ] Schaubild' },
    entries: [
        { kind: 'event', name: 'Klausur Biologie', due: '2026-12-02', time: '08:00', durationMinutes: 90, color: null, eventTypeId: null, reminders: [], prio: null },
        { kind: 'task', name: 'Protokoll abgeben', due: '2026-11-27', time: null, durationMinutes: null, color: null, eventTypeId: null, reminders: [], prio: null },
    ],
}
const posts = (path) => apiFetch.mock.calls.filter(([url, o]) => url === path && o?.method === 'POST').map(([, o]) => JSON.parse(o.body))

function open({ isTester = false } = {}) {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch(setLanguage('de'))
    store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 'tok', username: 'lena' } })
    store.dispatch({ type: SET_ACCESS, payload: { isPro: true, isAdmin: false, isTester, adminPendingCount: 0, betaRequest: null } })
    store.dispatch({ type: SET_TASK_STATE, payload: { tasks: [], groups: [], notes: [] } })
    const onDone = vi.fn()
    render(<Provider store={store}><MemoryRouter><ScanSheet onClose={vi.fn()} onDone={onDone} /></MemoryRouter></Provider>)
    return { store, onDone }
}

describe('scanning study material', () => {
    let result
    beforeEach(() => {
        forgetAiQuota()
        result = structuredClone(RESULT)
        apiFetch.mockReset()
        apiFetch.mockImplementation(async (url, options = {}) => {
            const body = options.body ? JSON.parse(options.body) : null
            if (url === '/api/ai/quota') return structuredClone(QUOTA)
            if (url === '/api/ai/scan') return { result: { ...result, plan: body.wants.includes('plan') ? result.plan : null }, quota: QUOTA }
            if (url === '/api/notebook' && options.method === 'POST') return { id: 70, ...body, attachments: [] }
            if (url === '/api/tasks' && options.method === 'POST') return { id: 80, ...body }
            if (url === '/api/tester/study/subjects' && !options.method) return [{ id: 3, name: 'Biologie', color: 'green' }]
            if (url === '/api/tester/study/settings') return { windows: [] }
            if (url === '/api/tester/study/goals' && options.method === 'POST') return { id: 90, ...body, parts: [] }
            return {}
        })
    })

    const pasteAndScan = async (text = 'Klausur Biologie am 2.12., Themen: Zellatmung, Fotosynthese') => {
        fireEvent.click(screen.getByRole('tab', { name: 'Text einfügen' }))
        fireEvent.change(screen.getByRole('textbox', { name: 'Text zum Scannen' }), { target: { value: text } })
        await act(async () => { fireEvent.click(await screen.findByRole('button', { name: /Scannen/ })) })
    }

    it('says what goes where and how many scans are left', async () => {
        open()
        expect(await screen.findByText(/noch 1 heute/)).toBeInTheDocument()
        expect(screen.getByText(/an Anthropic/)).toBeInTheDocument()
        // the study plan only where there is Lernen (testers)
        expect(screen.queryByRole('checkbox', { name: 'Lernplan' })).toBeNull()
        expect(screen.getByRole('checkbox', { name: 'Notizen' })).toBeChecked()
    })

    it('shows what it found and makes only what is kept', async () => {
        const { onDone } = open()
        await pasteAndScan()
        expect(posts('/api/ai/scan')[0]).toEqual({ wants: ['notes', 'entries'], source: { kind: 'text', text: 'Klausur Biologie am 2.12., Themen: Zellatmung, Fotosynthese' } })
        const preview = screen.getByRole('region', { name: 'Gefunden' })
        expect(within(preview).getByRole('checkbox', { name: /Zellatmung/ })).toBeChecked()
        // the second entry is left out
        fireEvent.click(within(preview).getByRole('checkbox', { name: /Protokoll abgeben/ }))
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' })) })
        expect(posts('/api/notebook')).toEqual([expect.objectContaining({ title: 'Zellatmung', body: '# Zellatmung\n- Glykolyse\n- [ ] Schaubild' })])
        expect(posts('/api/tasks')).toEqual([expect.objectContaining({ name: 'Klausur Biologie', kind: 'event', due: '2026-12-02', due_time: '08:00', duration_minutes: 90 })])
        expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ notes: 1, entries: 1, plan: 0 }))
    })

    it('testers can keep the study plan, in a subject they have', async () => {
        open({ isTester: true })
        expect(await screen.findByRole('checkbox', { name: 'Lernplan' })).toBeChecked()
        fireEvent.click(screen.getByRole('checkbox', { name: 'Notizen' }))
        fireEvent.click(screen.getByRole('checkbox', { name: 'Termine & Aufgaben' }))
        await pasteAndScan()
        const preview = screen.getByRole('region', { name: 'Gefunden' })
        expect(within(preview).getByRole('combobox', { name: 'Fach' })).toHaveValue('3')
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' })) })
        expect(posts('/api/tester/study/goals')[0]).toMatchObject({
            subjectId: 3, kind: 'exam', name: 'Biologie Klausur', due: '2026-12-02', planMode: 'days',
            parts: [{ name: 'Zellatmung', estimateMinutes: 90, estimateSource: 'ai' }, { name: 'Fotosynthese', estimateMinutes: 60, estimateSource: 'ai' }],
        })
    })

    it('with today\'s scan used up it says when it comes back, nothing is sent', async () => {
        apiFetch.mockImplementation(async (url) => (url === '/api/ai/quota' ? { ...QUOTA, scan: { used: 1, max: 1 } } : {}))
        open()
        expect(await screen.findByText(/Heute kein Scan mehr/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Scannen/ })).toBeDisabled()
    })
})
