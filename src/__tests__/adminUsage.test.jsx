import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { downloadXlsx, downloadCsv } from '../features/admin/exportTable'
import { usageSheets } from '../features/admin/usageSheets'
import { translate } from '../i18n/useTranslation'
import { SET_ACCESS, LOGIN_SUCCESS } from '../features/auth/authActionTypes'
import Admin from '../components/Admin'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

vi.mock('../features/admin/exportTable', async (importOriginal) => ({
    ...(await importOriginal()),
    downloadXlsx: vi.fn(() => Promise.resolve()),
    downloadCsv: vi.fn(),
}))

const report = {
    range: { from: '2026-10-09', to: '2026-11-07' },
    summary: {
        activeToday: 3, avgActivePerDay: 1.5, busiestDay: { date: '2026-11-04', people: 4 },
        activeThisWeek: 5, focusHours: 12.5,
        consent: { granted: 12, denied: 2, notAsked: 30 },
    },
    heatmap: {
        active: [{ weekday: 2, hour: 13, people: 7, events: 9 }, { weekday: 5, hour: 8, people: 1, events: 1 }],
        task_done: [{ weekday: 2, hour: 13, people: 2, events: 2 }],
        focus_start: [],
    },
    daily: [
        { date: '2026-11-06', active: 2, tasksCreated: 1, tasksDone: 3, focusMinutes: 60, activeMinutesPerPerson: 1.5 },
        { date: '2026-11-07', active: 3, tasksCreated: 0, tasksDone: 1, focusMinutes: 25, activeMinutesPerPerson: 4 },
    ],
    weekly: [{ weekStart: '2026-11-02', active: 5 }],
    features: [
        { metric: 'view:calendar', personDays: 2, events: 6, perPersonDay: 3, spark: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0] },
        { metric: 'task_done', personDays: 9, events: 14, perPersonDay: 1.6, spark: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 4, 3] },
        { metric: 'view:home', personDays: 5, events: 8, perPersonDay: 1.6, spark: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 1] },
    ],
    splits: {
        platform: [{ key: 'android', personDays: 2, events: 5 }, { key: 'web', personDays: 6, events: 11 }],
        language: [{ key: 'de', personDays: 8, events: 16 }],
        plan: [{ key: 'tester', personDays: 8, events: 16 }],
    },
}

const raw = {
    rows: [{ hour: '2026-11-04T12:00:00.000Z', localHour: 13, weekday: 2, metric: 'task_done', platform: 'web', language: 'de', plan: 'pro', events: 1, people: 1, valueSum: 0 }],
}

const SHEETS_DE = ['Übersicht', 'Tageszeiten', 'Täglich', 'Bereiche', 'Aufteilung', 'Rohdaten']
const SHEETS_EN = ['Summary', 'Times of day', 'Daily', 'Features', 'Splits', 'Raw']

let rawAnswer
const usageCalls = () => apiFetch.mock.calls.map(([url]) => url).filter(url => url.startsWith('/api/admin/usage?'))
const rawCalls = () => apiFetch.mock.calls.map(([url]) => url).filter(url => url.startsWith('/api/admin/usage/raw'))

function makeStore() {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 'tok', username: 'testUser1' } })
    store.dispatch({ type: SET_ACCESS, payload: { isPro: true, isAdmin: true, adminPendingCount: 0, betaRequest: null } })
    return store
}

async function renderAdmin(path = '/admin?tab=usage') {
    const store = makeStore()
    let view
    await act(async () => {
        view = render(
            <Provider store={store}>
                <MemoryRouter initialEntries={[path]}>
                    <Routes><Route path="/admin" element={<Admin />} /></Routes>
                </MemoryRouter>
            </Provider>
        )
    })
    return { store, ...view }
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 7, 12, 0))
    apiFetch.mockReset()
    downloadXlsx.mockClear()
    downloadCsv.mockClear()
    rawAnswer = async () => raw
    apiFetch.mockImplementation(async (url) => {
        if (url === '/api/admin/requests') return []
        if (url.startsWith('/api/admin/usage/raw')) return rawAnswer()
        if (url.startsWith('/api/admin/usage?')) return structuredClone(report)
        throw new Error(`unexpected call ${url}`)
    })
})

afterEach(() => {
    vi.useRealTimers()
})

describe('admin usage tab', () => {
    it('is a tab for admins and loads the last 30 days', async () => {
        await renderAdmin('/admin')
        const tab = screen.getByRole('tab', { name: 'Nutzung' })
        await act(async () => { fireEvent.click(tab) })
        expect(tab).toHaveAttribute('aria-selected', 'true')
        expect(usageCalls()).toEqual(['/api/admin/usage?from=2026-10-09&to=2026-11-07'])
        expect(screen.getByText('Nur Summen von Leuten, die zugestimmt haben. Keine Personen, keine Inhalte.')).toBeInTheDocument()
    })

    it('shows the summary numbers', async () => {
        await renderAdmin()
        expect(screen.getByText('Aktiv heute').previousSibling).toHaveTextContent('3')
        expect(screen.getByText('Aktiv diese Woche').previousSibling).toHaveTextContent('5')
        expect(screen.getByText('Aktiv pro Tag (Schnitt)').previousSibling).toHaveTextContent('1,5')
        expect(screen.getByText('Fokusstunden').previousSibling).toHaveTextContent('12,5')
        expect(screen.getByText('Zugestimmt').previousSibling).toHaveTextContent('12')
        expect(screen.queryByText(/verschiedene/i)).not.toBeInTheDocument()
    })

    it('loads the last 7 days when picked', async () => {
        await renderAdmin()
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: '7 Tage' })) })
        expect(usageCalls().at(-1)).toBe('/api/admin/usage?from=2026-11-01&to=2026-11-07')
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Alles' })) })
        expect(usageCalls().at(-1)).toBe('/api/admin/usage?from=2026-11-01&to=2026-11-07')
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: '90 Tage' })) })
        expect(usageCalls().at(-1)).toBe('/api/admin/usage?from=2026-08-10&to=2026-11-07')
    })

    it('takes a custom range from two dates', async () => {
        await renderAdmin()
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Eigener Zeitraum' })) })
        await act(async () => { fireEvent.change(screen.getByLabelText('Von'), { target: { value: '2026-11-02' } }) })
        expect(usageCalls().at(-1)).toBe('/api/admin/usage?from=2026-11-02&to=2026-11-07')
    })

    it('filters by platform', async () => {
        await renderAdmin()
        await act(async () => { fireEvent.change(screen.getByLabelText('Plattform'), { target: { value: 'android' } }) })
        expect(usageCalls().at(-1)).toBe('/api/admin/usage?from=2026-10-09&to=2026-11-07&platform=android')
    })

    it('draws a 7 × 24 heatmap with the numbers in a table', async () => {
        const { container } = await renderAdmin()
        expect(container.querySelectorAll('[data-heat-cell]')).toHaveLength(168)
        const table = screen.getByRole('table', { name: /Tageszeiten/ })
        const tuesday = within(table).getByRole('rowheader', { name: 'Di' }).closest('tr')
        const cells = within(tuesday).getAllByRole('cell')
        expect(cells).toHaveLength(24)
        expect(cells[13]).toHaveTextContent('7')
        expect(cells[12]).toHaveTextContent('0')
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Aufgaben erledigt' })) })
        expect(within(within(screen.getByRole('table', { name: /Tageszeiten/ })).getByRole('rowheader', { name: 'Di' }).closest('tr')).getAllByRole('cell')[13]).toHaveTextContent('2')
    })

    it('lists the features by person-days', async () => {
        await renderAdmin()
        const table = screen.getByRole('table', { name: 'Bereiche' })
        expect(within(table).getByRole('columnheader', { name: 'Personentage' })).toBeInTheDocument()
        const names = within(table).getAllByRole('rowheader').map(cell => cell.textContent)
        expect(names).toEqual(['task_done', 'view:home', 'view:calendar'])
    })

    it('shows the splits as person-days', async () => {
        await renderAdmin()
        const platform = screen.getByRole('table', { name: 'Plattform' })
        expect(within(within(platform).getByRole('rowheader', { name: 'android' }).closest('tr')).getAllByRole('cell').map(c => c.textContent)).toEqual(['2', '5'])
    })

    it('exports all six sheets to Excel, with the raw rows fetched only then', async () => {
        await renderAdmin()
        expect(rawCalls()).toEqual([])
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Excel (.xlsx)' })) })
        expect(rawCalls()).toEqual(['/api/admin/usage/raw?from=2026-10-09&to=2026-11-07'])
        expect(downloadXlsx).toHaveBeenCalledTimes(1)
        const [sheets, fileName] = downloadXlsx.mock.calls[0]
        expect(sheets.map(s => s.name)).toEqual(SHEETS_DE)
        expect(sheets[5].rows).toHaveLength(1)
        expect(fileName).toBe('quidey-nutzung_2026-10-09_2026-11-07.xlsx')
    })

    it('exports one sheet as CSV from a small menu', async () => {
        await renderAdmin()
        const csv = screen.getByRole('button', { name: 'CSV' })
        expect(csv).toHaveAttribute('aria-expanded', 'false')
        await act(async () => { fireEvent.click(csv) })
        expect(csv).toHaveAttribute('aria-expanded', 'true')
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Täglich' })) })
        expect(downloadCsv).toHaveBeenCalledTimes(1)
        const [sheet, language, fileName] = downloadCsv.mock.calls[0]
        expect(sheet.name).toBe('Täglich')
        expect(sheet.rows).toHaveLength(2)
        expect(language).toBe('de')
        expect(fileName).toBe('quidey-nutzung-taeglich_2026-10-09_2026-11-07.csv')
        expect(rawCalls()).toEqual([])
    })

    it('says so when the raw data is too big, and downloads nothing', async () => {
        rawAnswer = async () => { throw Object.assign(new Error('too big'), { status: 400, code: 'USAGE_RANGE_TOO_BIG' }) }
        const { store } = await renderAdmin()
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Excel (.xlsx)' })) })
        expect(downloadXlsx).not.toHaveBeenCalled()
        expect(store.getState().toast.map(toast => toast.text)).toContain('Zu viele Zeilen für die Rohdaten. Wähle einen kürzeren Zeitraum.')
    })
})

describe('usageSheets', () => {
    it('names the six sheets in German and English', () => {
        expect(usageSheets(report, raw, (key, i) => translate('de', key, i)).map(s => s.name)).toEqual(SHEETS_DE)
        expect(usageSheets(report, raw, (key, i) => translate('en', key, i)).map(s => s.name)).toEqual(SHEETS_EN)
    })

    it('fills the times of day with zeros and keeps numbers as numbers', () => {
        const sheets = usageSheets(report, null, (key, i) => translate('de', key, i))
        const times = sheets[1]
        expect(times.rows).toHaveLength(3 * 7 * 24)
        const cell = times.rows.find(r => r.metric === 'active' && r.weekday === 2 && r.hour === 13)
        expect(cell).toMatchObject({ people: 7, events: 9, day: 'Di' })
        expect(times.rows.find(r => r.metric === 'focus_start' && r.weekday === 7 && r.hour === 23)).toMatchObject({ people: 0, events: 0 })
        expect(sheets[2].columns.find(c => c.key === 'date').type).toBe('date')
        expect(sheets[5].rows).toEqual([])
        for (const sheet of sheets) {
            for (const col of sheet.columns) expect(['string', 'number', 'date', 'datetime', 'boolean']).toContain(col.type)
        }
    })

    it('labels sums of daily people as person-days', () => {
        const sheets = usageSheets(report, raw, (key, i) => translate('de', key, i))
        expect(sheets[3].columns.map(c => c.label)).toContain('Personentage')
        expect(sheets[4].columns.map(c => c.label)).toContain('Personentage')
        expect(sheets[4].rows).toContainEqual(expect.objectContaining({ dimension: 'Plattform', key: 'android', personDays: 2, events: 5 }))
    })
})
