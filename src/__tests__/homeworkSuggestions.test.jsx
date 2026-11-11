import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { setLanguage } from '../features/settings/settingsAction'
import HomeworkSuggestions from '../components/study/HomeworkSuggestions'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const calls = (path, method = 'GET') => apiFetch.mock.calls.filter(([url, options]) => url === path && (options?.method ?? 'GET') === method)

let list
const item = (over) => ({
    id: 1, subjectId: 7, subjectName: 'Deutsch', text: 'Aufsatz Seite 12', remark: 'bitte tippen',
    due: '2026-11-12', dueTime: '08:00', estimateMinutes: 45, estimateSource: 'ai', ...over,
})

beforeEach(() => {
    apiFetch.mockReset()
    list = [item({ id: 1 }), item({ id: 2, subjectId: 8, subjectName: 'Mathe', text: 'Aufgaben 1-5', remark: '', estimateMinutes: null, estimateSource: null })]
    apiFetch.mockImplementation(async (url, options = {}) => {
        const method = options.method ?? 'GET'
        if (url === '/api/untis/suggestions') return list
        const take = url.match(/^\/api\/untis\/suggestions\/(\d+)\/take$/)
        if (take && method === 'POST') { list = list.filter(s => s.id !== Number(take[1])); return { taskId: 99 } }
        const dismiss = url.match(/^\/api\/untis\/suggestions\/(\d+)\/dismiss$/)
        if (dismiss && method === 'POST') { list = list.filter(s => s.id !== Number(dismiss[1])); return null }
        return {}
    })
})
afterEach(cleanup)

function open(props = {}) {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch(setLanguage('de'))
    render(<Provider store={store}><MemoryRouter><HomeworkSuggestions {...props} /></MemoryRouter></Provider>)
}

describe('homework suggestions from Untis', () => {
    it('lists the suggestions with the AI estimate marked as such', async () => {
        open()
        const first = (await screen.findByText('Aufsatz Seite 12')).closest('li')
        expect(within(first).getByText('Deutsch')).toBeTruthy()
        expect(within(first).getByText('bitte tippen')).toBeTruthy()
        expect(within(first).getByLabelText('Minuten')).toHaveValue(45)
        expect(within(first).getByText('KI-Schätzung')).toBeTruthy()
        const second = screen.getByText('Aufgaben 1-5').closest('li')
        expect(within(second).getByLabelText('Minuten')).toHaveValue(null)
        expect(within(second).queryByText('KI-Schätzung')).toBeNull()
    })

    it('taking one sends the typed minutes and the row goes away', async () => {
        open()
        const row = (await screen.findByText('Aufsatz Seite 12')).closest('li')
        fireEvent.change(within(row).getByLabelText('Minuten'), { target: { value: '30' } })
        fireEvent.click(within(row).getByRole('button', { name: 'Als Aufgabe übernehmen' }))
        await waitFor(() => expect(calls('/api/untis/suggestions/1/take', 'POST')).toHaveLength(1))
        expect(JSON.parse(calls('/api/untis/suggestions/1/take', 'POST')[0][1].body)).toEqual({ minutes: 30 })
        await waitFor(() => expect(screen.queryByText('Aufsatz Seite 12')).toBeNull())
    })

    it('without minutes it sends none (the estimate, if any, is used by the server)', async () => {
        open()
        const row = (await screen.findByText('Aufgaben 1-5')).closest('li')
        fireEvent.click(within(row).getByRole('button', { name: 'Als Aufgabe übernehmen' }))
        await waitFor(() => expect(calls('/api/untis/suggestions/2/take', 'POST')).toHaveLength(1))
        expect(JSON.parse(calls('/api/untis/suggestions/2/take', 'POST')[0][1].body)).toEqual({})
    })

    it('dismissing one removes it', async () => {
        open()
        const row = (await screen.findByText('Aufsatz Seite 12')).closest('li')
        fireEvent.click(within(row).getByRole('button', { name: 'Verwerfen' }))
        await waitFor(() => expect(calls('/api/untis/suggestions/1/dismiss', 'POST')).toHaveLength(1))
        await waitFor(() => expect(screen.queryByText('Aufsatz Seite 12')).toBeNull())
    })

    it('on a subject\'s page only that subject\'s suggestions show; nothing at all renders nothing', async () => {
        open({ subjectId: 8 })
        expect(await screen.findByText('Aufgaben 1-5')).toBeTruthy()
        expect(screen.queryByText('Aufsatz Seite 12')).toBeNull()
        cleanup()
        list = []
        open()
        await waitFor(() => expect(calls('/api/untis/suggestions')).toHaveLength(1))
        expect(screen.queryByRole('region')).toBeNull()
        expect(screen.queryByText('Hausaufgaben aus Untis')).toBeNull()
    })
})
