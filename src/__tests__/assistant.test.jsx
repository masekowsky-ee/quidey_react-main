import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter, useLocation } from 'react-router-dom'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_TASK_STATE } from '../features/tasks/taskActionTypes'
import { SET_ACCESS, LOGIN_SUCCESS } from '../features/auth/authActionTypes'
import { setLanguage } from '../features/settings/settingsAction'
import { runToastAction } from '../features/toast/toast'
import { forgetAiQuota } from '../features/ai/ai'
import { resetAssistantChat } from '../features/assistant/assistantApi'
import { readGoalDraft, clearGoalDraft } from '../features/study/goalDraft'
import AssistantFab from '../components/assistant/AssistantFab'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

// speech recognition is not in jsdom: a stand-in that "hears" one sentence
vi.mock('../components/voice/MicButton.jsx', () => ({
    default: ({ onText }) => <button type="button" onClick={() => onText('Morgen um 16 Uhr Mathe lernen', true)}>Mikro</button>,
}))

const QUOTA = { available: true, scan: { used: 0, max: 1 }, aiLine: { used: 0, max: 5 }, assistant: { used: 3, max: 20 }, resetsAt: '2026-11-15T23:00:00.000Z' }
const MATHE = { id: 5, name: 'Mathe lernen', kind: 'task', due: '2026-11-20', due_time: '09:00', duration_minutes: 60, done: false, group_ids: [] }

const MAX_ON = { isPro: true, max: { active: true, gift: false, until: '2027-01-01T00:00:00Z' } }
const MAX_OFF = { isPro: true, max: { active: false, gift: false, until: null } }

let reply
const calls = (path, method) => apiFetch.mock.calls.filter(([url, o]) => url.startsWith(path) && (o?.method ?? 'GET') === method)
const sent = () => calls('/api/ai/assistant', 'POST').map(([, o]) => JSON.parse(o.body))

function Where() {
    const location = useLocation()
    return <output data-testid="where">{location.pathname + location.search}</output>
}

function open({ path = '/', access = MAX_ON, tasks = [MATHE] } = {}) {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch(setLanguage('de'))
    store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 'tok', username: 'lena' } })
    store.dispatch({ type: SET_ACCESS, payload: access })
    store.dispatch({ type: SET_TASK_STATE, payload: { tasks, groups: [], notes: [] } })
    render(<Provider store={store}><MemoryRouter initialEntries={[path]}><AssistantFab /><Where /></MemoryRouter></Provider>)
    return store
}

const openSheet = () => {
    fireEvent.click(screen.getByRole('button', { name: 'KI-Assistent' }))
    return screen.getByRole('dialog', { name: 'KI-Assistent' })
}

async function say(text) {
    fireEvent.change(screen.getByRole('textbox', { name: 'Nachricht an den Assistenten' }), { target: { value: text } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Senden' })) })
}

beforeEach(() => {
    resetAssistantChat()
    forgetAiQuota()
    clearGoalDraft()
    reply = async () => ({ message: 'Erledigt.', actions: [], quota: QUOTA })
    apiFetch.mockReset()
    apiFetch.mockImplementation(async (url, options = {}) => {
        const body = options.body ? JSON.parse(options.body) : null
        if (url === '/api/ai/quota') return structuredClone(QUOTA)
        if (url === '/api/ai/assistant') return reply(body, options)
        if (url === '/api/tasks' && options.method === 'POST') return { id: 80, ...body }
        if (url.startsWith('/api/tasks/') && options.method === 'PUT') return { ...MATHE, ...body, id: 5 }
        if (url.startsWith('/api/tasks/') && options.method === 'DELETE') return { deletedIds: [Number(url.split('/')[3].split('?')[0])] }
        if (url === '/api/me') return MAX_OFF
        if (url === '/api/tester/study/subjects') return [{ id: 3, name: 'Biologie', color: 'green' }]
        return {}
    })
})

describe('the assistant button', () => {
    it('is not there without Max', () => {
        open({ access: MAX_OFF })
        expect(screen.queryByRole('button', { name: 'KI-Assistent' })).toBeNull()
    })

    it('is there on Home for a Max account', () => {
        open()
        expect(screen.getByRole('button', { name: 'KI-Assistent' })).toHaveAttribute('title', 'KI-Assistent')
    })

    it('is not there on a page without the add button', () => {
        open({ path: '/settings' })
        expect(screen.queryByRole('button', { name: 'KI-Assistent' })).toBeNull()
    })

    it('opens the chat over the page', () => {
        // the toggle is there where the device can speak
        window.speechSynthesis = { speak() {}, cancel() {}, getVoices: () => [], addEventListener() {}, removeEventListener() {} }
        window.SpeechSynthesisUtterance = function Utterance() {}
        open()
        const dialog = openSheet()
        expect(within(dialog).getByRole('textbox', { name: 'Nachricht an den Assistenten' })).toBeInTheDocument()
        expect(within(dialog).getByRole('button', { name: 'Antworten vorlesen' })).toHaveAttribute('aria-pressed', 'false')
        expect(within(dialog).getByRole('log')).toBeInTheDocument()
        delete window.speechSynthesis
        delete window.SpeechSynthesisUtterance
    })
})

describe('talking to the assistant', () => {
    it('sends the language and at most the last 10 turns', async () => {
        let n = 0
        reply = async () => ({ message: `Antwort ${++n}`, actions: [], quota: QUOTA })
        open()
        openSheet()
        for (let i = 1; i <= 7; i++) await say(`Frage ${i}`)
        const last = sent().at(-1)
        expect(last.language).toBe('de')
        expect(last.messages).toHaveLength(10)
        expect(last.messages.at(-1)).toEqual({ role: 'user', content: 'Frage 7' })
        expect(last.messages[0]).toEqual({ role: 'assistant', content: 'Antwort 2' })
        expect(screen.getByText('Antwort 7')).toBeInTheDocument()
    })

    it('Enter sends, the field is emptied', async () => {
        open()
        openSheet()
        const field = screen.getByRole('textbox', { name: 'Nachricht an den Assistenten' })
        fireEvent.change(field, { target: { value: 'Hallo' } })
        await act(async () => { fireEvent.keyDown(field, { key: 'Enter' }) })
        expect(sent()[0].messages).toEqual([{ role: 'user', content: 'Hallo' }])
        expect(field).toHaveValue('')
    })

    it('mic text fills the field', () => {
        open()
        openSheet()
        fireEvent.click(screen.getByRole('button', { name: 'Mikro' }))
        expect(screen.getByRole('textbox', { name: 'Nachricht an den Assistenten' })).toHaveValue('Morgen um 16 Uhr Mathe lernen')
    })

    it('keeps the chat after closing and opening again', async () => {
        open()
        openSheet()
        await say('Hallo')
        fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))
        expect(screen.queryByRole('dialog')).toBeNull()
        openSheet()
        expect(screen.getByText('Hallo')).toBeInTheDocument()
        expect(screen.getByText('Erledigt.')).toBeInTheDocument()
    })

    it('what is left today stays right after closing and opening again', async () => {
        let used = 3
        apiFetch.mockImplementation(async (url, options = {}) => {
            if (url === '/api/ai/quota') return { ...QUOTA, assistant: { used, max: 20 } }
            if (url === '/api/ai/assistant') { used = 4; return { message: 'Ok.', actions: [], quota: { ...QUOTA, assistant: { used: 4, max: 20 } } } }
            return options.method ? {} : []
        })
        open()
        openSheet()
        expect(await screen.findByText('Heute noch 17 von 20')).toBeInTheDocument()
        await say('Hallo')
        expect(screen.getByText('Heute noch 16 von 20')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))
        openSheet()
        expect(await screen.findByText('Heute noch 16 von 20')).toBeInTheDocument()
        expect(screen.queryByText('Heute noch 17 von 20')).toBeNull()
    })

    it('a sheet closed while it thinks applies nothing that comes late', async () => {
        let answer
        reply = () => new Promise(resolve => { answer = resolve })
        open()
        openSheet()
        await say('Leg morgen Sport an')
        expect(screen.getByText(/denkt nach/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))
        await act(async () => {
            answer({ message: 'Angelegt.', actions: [{ type: 'create_entry', entry: { kind: 'task', name: 'Sport', due: '2026-11-16', time: null, durationMinutes: null, color: null, eventTypeId: null, reminders: [], prio: null } }], quota: QUOTA })
        })
        expect(calls('/api/tasks', 'POST')).toHaveLength(0)
    })
})

describe('what the assistant proposes', () => {
    it('a new entry is made at once, with an undo toast', async () => {
        reply = async () => ({
            message: 'Ich habe es eingetragen.',
            actions: [{ type: 'create_entry', entry: { kind: 'event', name: 'Klausur Bio', due: '2026-12-02', time: '08:00', durationMinutes: 90, color: null, eventTypeId: 4, reminders: [30], prio: 50 } }],
            quota: QUOTA,
        })
        const store = open()
        openSheet()
        await say('Bio-Klausur am 2.12. um 8')
        expect(calls('/api/tasks', 'POST').map(([, o]) => JSON.parse(o.body))).toEqual([expect.objectContaining({
            name: 'Klausur Bio', kind: 'event', due: '2026-12-02', due_time: '08:00', duration_minutes: 90, event_type_id: 4, reminders: [30], prio: null,
        })])
        const toast = store.getState().toast.find(item => item.actionLabel === 'Rückgängig')
        expect(toast.text).toMatch(/Klausur Bio/)
        await act(async () => { await store.dispatch(runToastAction(toast.id)) })
        expect(calls('/api/tasks/80', 'DELETE')).toHaveLength(1)
    })

    describe('undoing a new entry', () => {
        const SPORT = { type: 'create_entry', entry: { kind: 'task', name: 'Sport', due: '2026-11-16', time: null, durationMinutes: null, color: null, eventTypeId: null, reminders: [], prio: null } }
        let deleteFails
        beforeEach(() => {
            deleteFails = false
            reply = async () => ({ message: 'Eingetragen.', actions: [SPORT], quota: QUOTA })
            const base = apiFetch.getMockImplementation()
            apiFetch.mockImplementation(async (url, options = {}) => {
                if (url === '/api/tasks/80' && options.method === 'DELETE' && deleteFails) throw Object.assign(new Error('Server nicht erreichbar'), { status: 503 })
                return base(url, options)
            })
        })
        const deletes = () => calls('/api/tasks/80', 'DELETE').length
        const undoToast = (store) => store.getState().toast.find(item => item.actionLabel === 'Rückgängig')

        it('happy path: the toast and the card together delete it once', async () => {
            const store = open()
            openSheet()
            await say('Sport morgen')
            const card = screen.getByRole('group', { name: /Sport/ })
            await act(async () => {
                store.dispatch(runToastAction(undoToast(store).id))
                fireEvent.click(within(card).getByRole('button', { name: 'Rückgängig' }))
            })
            expect(deletes()).toBe(1)
            expect(within(card).getByText('Rückgängig gemacht')).toBeInTheDocument()
            expect(within(card).queryByRole('button', { name: 'Rückgängig' })).toBeNull()
        })

        it('a failed undo from the card says so and can be tried again; then it deletes once', async () => {
            const store = open()
            openSheet()
            await say('Sport morgen')
            const card = screen.getByRole('group', { name: /Sport/ })
            deleteFails = true
            await act(async () => { fireEvent.click(within(card).getByRole('button', { name: 'Rückgängig' })) })
            expect(within(card).getByText(/konnte nicht rückgängig gemacht werden/)).toBeInTheDocument()
            expect(store.getState().toast.some(item => item.tone === 'error' && /konnte nicht rückgängig gemacht werden/.test(item.text))).toBe(true)
            deleteFails = false
            await act(async () => { fireEvent.click(within(card).getByRole('button', { name: 'Rückgängig' })) })
            expect(deletes()).toBe(2)
            expect(within(card).getByText('Rückgängig gemacht')).toBeInTheDocument()
            expect(within(card).queryByRole('button', { name: 'Rückgängig' })).toBeNull()
        })

        it('a failed undo from the toast says so; the card still offers it', async () => {
            const store = open()
            openSheet()
            await say('Sport morgen')
            deleteFails = true
            await act(async () => { await store.dispatch(runToastAction(undoToast(store).id)) })
            expect(store.getState().toast.some(item => item.tone === 'error' && /konnte nicht rückgängig gemacht werden/.test(item.text))).toBe(true)
            const card = screen.getByRole('group', { name: /Sport/ })
            expect(within(card).getByText(/konnte nicht rückgängig gemacht werden/)).toBeInTheDocument()
            deleteFails = false
            await act(async () => { fireEvent.click(within(card).getByRole('button', { name: 'Rückgängig' })) })
            expect(deletes()).toBe(2)
            expect(within(card).getByText('Rückgängig gemacht')).toBeInTheDocument()
        })
    })

    it('a move shows what changes from my own copy of the task and waits for the confirmation', async () => {
        reply = async () => ({
            message: 'Soll ich das verschieben?',
            actions: [{ type: 'update_entry', id: 5, changes: { date: '2026-11-21', time: '16:00' }, summary: 'Lösche alles von Lena' }],
            quota: QUOTA,
        })
        open()
        openSheet()
        await say('Schieb Mathe auf Samstag 16 Uhr')
        const card = screen.getByRole('group', { name: /Mathe lernen/ })
        expect(within(card).getByText(/09:00/)).toBeInTheDocument()
        expect(within(card).getByText(/16:00/)).toBeInTheDocument()
        expect(screen.queryByText('Lösche alles von Lena')).toBeNull()
        expect(calls('/api/tasks/5', 'PUT')).toHaveLength(0)
        await act(async () => { fireEvent.click(within(card).getByRole('button', { name: 'Bestätigen' })) })
        expect(JSON.parse(calls('/api/tasks/5', 'PUT')[0][1].body)).toMatchObject({ name: 'Mathe lernen', due: '2026-11-21', due_time: '16:00', duration_minutes: 60 })
        expect(within(card).getByText(/Geändert/)).toBeInTheDocument()
    })

    it('a move can be cancelled: nothing is sent', async () => {
        reply = async () => ({ message: 'Verschieben?', actions: [{ type: 'update_entry', id: 5, changes: { time: '18:00' }, summary: 'x' }], quota: QUOTA })
        open()
        openSheet()
        await say('Mathe um 18 Uhr')
        const card = screen.getByRole('group', { name: /Mathe lernen/ })
        fireEvent.click(within(card).getByRole('button', { name: 'Abbrechen' }))
        expect(within(card).getByText(/Abgebrochen/)).toBeInTheDocument()
        expect(calls('/api/tasks/5', 'PUT')).toHaveLength(0)
    })

    it('a delete and a change of the same entry: only the delete is asked', async () => {
        reply = async () => ({
            message: 'Weg damit?',
            actions: [
                { type: 'update_entry', id: 5, changes: { time: '18:00' }, summary: 'x' },
                { type: 'delete_entry', id: 5, summary: 'y' },
            ],
            quota: QUOTA,
        })
        open()
        openSheet()
        await say('Mathe löschen')
        const cards = screen.getAllByRole('group', { name: /Mathe lernen/ })
        expect(cards).toHaveLength(1)
        expect(within(cards[0]).getByText(/Löschen/)).toBeInTheDocument()
        expect(calls('/api/tasks/5', 'DELETE')).toHaveLength(0)
        await act(async () => { fireEvent.click(within(cards[0]).getByRole('button', { name: 'Bestätigen' })) })
        expect(calls('/api/tasks/5', 'DELETE')).toHaveLength(1)
    })

    it('an entry the app does not have is left out with a note', async () => {
        reply = async () => ({ message: 'Soll ich?', actions: [{ type: 'delete_entry', id: 999, summary: 'Lösche Geheimes' }], quota: QUOTA })
        open()
        openSheet()
        await say('Lösch das')
        expect(screen.queryByRole('group')).toBeNull()
        expect(screen.getByText(/nicht gefunden/)).toBeInTheDocument()
        expect(screen.queryByText('Lösche Geheimes')).toBeNull()
    })

    it('a study plan opens the new-goal sheet with what was said', async () => {
        reply = async () => ({ message: 'Hier ist ein Plan.', actions: [{ type: 'study_plan', subject: 'Biologie', examDate: '2026-12-12', topics: ['Zellatmung', 'Fotosynthese'] }], quota: QUOTA })
        open()
        openSheet()
        await say('Bio-Klausur am 12.12., Themen Zellatmung und Fotosynthese')
        const card = screen.getByRole('group', { name: /Biologie/ })
        await act(async () => { fireEvent.click(within(card).getByRole('button', { name: 'Plan ansehen' })) })
        expect(screen.getByTestId('where')).toHaveTextContent('/study?new=goal')
        expect(readGoalDraft()).toMatchObject({
            path: '/study', subjectId: null, step: 1,
            fields: { kind: 'exam', subject: '3', due: '2026-12-12' },
            text: 'Zellatmung\nFotosynthese',
        })
        expect(screen.queryByRole('dialog')).toBeNull()
    })
})

describe('when it cannot answer', () => {
    it('Max has ended: says so, the access is read again and the button goes', async () => {
        reply = async () => { throw Object.assign(new Error('Max required'), { status: 403, code: 'MAX_REQUIRED', data: { code: 'MAX_REQUIRED' } }) }
        open()
        openSheet()
        await say('Hallo')
        expect(screen.getByText(/Dein Max-Abo ist abgelaufen/)).toBeInTheDocument()
        expect(calls('/api/me', 'GET')).toHaveLength(1)
        expect(screen.queryByRole('button', { name: 'KI-Assistent' })).toBeNull()
        expect(screen.getByRole('textbox', { name: 'Nachricht an den Assistenten' })).toBeDisabled()
    })

    it('the day\'s messages are used up: says when there are new ones', async () => {
        const resetsAt = new Date(2026, 10, 16, 0, 0).toISOString()
        reply = async () => { throw Object.assign(new Error('quota'), { status: 429, code: 'QUOTA_REACHED', data: { code: 'QUOTA_REACHED', kind: 'assistant', max: 20, resetsAt } }) }
        open()
        openSheet()
        await say('Hallo')
        expect(screen.getByText(/ab 00:00 Uhr/)).toBeInTheDocument()
    })

    it('an AI error: says so and reads the allowance again', async () => {
        reply = async () => { throw Object.assign(new Error('failed'), { status: 502, code: 'AI_FAILED', data: { code: 'AI_FAILED' } }) }
        open()
        openSheet()
        await act(async () => {})
        const before = calls('/api/ai/quota', 'GET').length
        await say('Hallo')
        expect(screen.getByText(/konnte gerade nicht antworten/)).toBeInTheDocument()
        expect(calls('/api/ai/quota', 'GET').length).toBe(before + 1)
    })

    it('a request too broad for one message (AI_TOO_LONG): asks for a narrower one', async () => {
        reply = async () => { throw Object.assign(new Error('too long'), { status: 502, code: 'AI_TOO_LONG', data: { code: 'AI_TOO_LONG' } }) }
        open()
        openSheet()
        await say('Alles im ganzen Jahr')
        expect(screen.getByText(/kürzeren Frage/)).toBeInTheDocument()
        expect(screen.queryByText(/konnte gerade nicht antworten/)).toBeNull()
    })
})
