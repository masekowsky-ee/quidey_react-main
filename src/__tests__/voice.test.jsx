import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter } from 'react-router-dom'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_TASK_STATE } from '../features/tasks/taskActionTypes'
import { SET_ACCESS, LOGIN_SUCCESS } from '../features/auth/authActionTypes'
import { setLanguage } from '../features/settings/settingsAction'
import { voiceSupport, startDictation, speechLang } from '../features/voice/voice'
import TaskForm from '../components/TaskForm'
import DictateButton from '../components/voice/DictateButton'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(async () => ({})),
}))

// the browser's speech recognition, played by the test
let current
class FakeRecognition {
    constructor() { current = this; this.started = false; this.stopped = false }
    start() { this.started = true }
    stop() { this.stopped = true; this.onend?.() }
    abort() { this.stop() }
    say(text, isFinal) {
        const result = [{ transcript: text }]
        result.isFinal = isFinal
        this.onresult?.({ resultIndex: 0, results: [result] })
    }
}

describe('dictation in the browser', () => {
    beforeEach(() => { window.SpeechRecognition = FakeRecognition; current = null })
    afterEach(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition })

    it('is there only where the browser can recognise speech', () => {
        expect(voiceSupport()).toBe('web')
        delete window.SpeechRecognition
        expect(voiceSupport()).toBe(null)
        window.webkitSpeechRecognition = FakeRecognition
        expect(voiceSupport()).toBe('web')
    })

    it('hands over the words while speaking and at the end, in the app\'s language', () => {
        const onText = vi.fn()
        const onEnd = vi.fn()
        const stop = startDictation({ lang: speechLang('de'), onText, onEnd })
        expect(current.lang).toBe('de-DE')
        expect(current.interimResults).toBe(true)
        current.say('Lernen morgen', false)
        current.say('Lernen morgen 14 Uhr', true)
        expect(onText.mock.calls).toEqual([['Lernen morgen', false], ['Lernen morgen 14 Uhr', true]])
        stop()
        expect(current.stopped).toBe(true)
        expect(onEnd).toHaveBeenCalled()
    })

    it('says why it stopped', () => {
        const onError = vi.fn()
        startDictation({ lang: 'en-US', onText: () => {}, onError })
        current.onerror?.({ error: 'not-allowed' })
        expect(onError).toHaveBeenCalledWith('not-allowed')
    })
})

describe('the microphone in the new-entry form', () => {
    beforeEach(() => { window.SpeechRecognition = FakeRecognition; apiFetch.mockClear() })
    afterEach(() => { delete window.SpeechRecognition })

    const open = () => {
        const store = configureStore({ reducer: rootReducer })
        store.dispatch(setLanguage('en'))
        store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 'tok', username: 'lena' } })
        store.dispatch({ type: SET_ACCESS, payload: { isPro: true, isAdmin: false, isTester: false, adminPendingCount: 0, betaRequest: null } })
        store.dispatch({ type: SET_TASK_STATE, payload: { tasks: [], groups: [], notes: [] } })
        render(<Provider store={store}><MemoryRouter><TaskForm setCreateTask={vi.fn()} /></MemoryRouter></Provider>)
    }

    it('what is said becomes the line, and the line is read as typed', () => {
        open()
        const mic = screen.getByRole('button', { name: 'Speak' })
        fireEvent.click(mic)
        expect(mic).toHaveAttribute('aria-pressed', 'true')
        act(() => { current.say('Essay tomorrow', false) })
        expect(screen.getByRole('textbox', { name: /name/i })).toHaveValue('Essay tomorrow')
        act(() => { current.say('Essay tomorrow 2pm', true) })
        act(() => { current.stop() })
        expect(screen.getByRole('textbox', { name: /name/i })).toHaveValue('Essay tomorrow 2pm')
        expect(screen.getByText(/Found:/).textContent).toContain('14:00')
        expect(mic).toHaveAttribute('aria-pressed', 'false')
    })

    it('no microphone where speech can\'t be recognised', () => {
        delete window.SpeechRecognition
        open()
        expect(screen.queryByRole('button', { name: 'Speak' })).toBeNull()
    })
})

describe('dictating into a note', () => {
    beforeEach(() => { window.SpeechRecognition = FakeRecognition })
    afterEach(() => { delete window.SpeechRecognition })

    it('keeps listening and puts in each finished sentence once, at the cursor', () => {
        const insert = vi.fn()
        const store = configureStore({ reducer: rootReducer })
        store.dispatch(setLanguage('en'))
        render(<Provider store={store}><MemoryRouter><DictateButton insert={insert} /></MemoryRouter></Provider>)
        fireEvent.click(screen.getByRole('button', { name: 'Speak' }))
        expect(current.continuous).toBe(true)
        act(() => { current.say('Die Zelle', false) })
        expect(insert).not.toHaveBeenCalled()
        act(() => { current.say('Die Zelle atmet.', true) })
        act(() => { current.say('Die Zelle atmet. Mitochondrien', false) })
        act(() => { current.say('Die Zelle atmet. Mitochondrien machen ATP.', true) })
        expect(insert.mock.calls).toEqual([['Die Zelle atmet.'], [' Mitochondrien machen ATP.']])
    })
})

describe('when the microphone is blocked', () => {
    beforeEach(() => { window.SpeechRecognition = FakeRecognition })
    afterEach(() => { delete window.SpeechRecognition })

    it('the warning leads to the settings where it can be allowed', async () => {
        const { default: Toaster } = await import('../components/Toaster')
        const { MemoryRouter: Router, Routes, Route, useLocation } = await import('react-router-dom')
        const Where = () => <output data-testid="where">{useLocation().pathname + useLocation().hash}</output>
        const store = configureStore({ reducer: rootReducer })
        store.dispatch(setLanguage('de'))
        render(<Provider store={store}><Router initialEntries={['/']}><Routes><Route path="*" element={<><DictateButton insert={() => {}} /><Toaster /><Where /></>} /></Routes></Router></Provider>)
        fireEvent.click(screen.getByRole('button', { name: 'Sprechen' }))
        act(() => { current.onerror?.({ error: 'not-allowed' }) })
        await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Erlauben' })) })
        expect(screen.getByTestId('where')).toHaveTextContent('/settings#microphone')
    })
})

describe('the microphone in the settings', () => {
    let state
    afterEach(() => { delete window.SpeechRecognition })
    beforeEach(() => {
        window.SpeechRecognition = FakeRecognition
        state = 'denied'
        Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: vi.fn(async () => ({ state, addEventListener() {}, removeEventListener() {} })) } })
        Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(async () => { state = 'granted'; return { getTracks: () => [{ stop() {} }] } }) } })
    })

    it('says it is blocked and how to allow it; asking again shows when it works', async () => {
        const { default: MicrophoneSettings } = await import('../components/voice/MicrophoneSettings')
        const store = configureStore({ reducer: rootReducer })
        store.dispatch(setLanguage('de'))
        await act(async () => { render(<Provider store={store}><MicrophoneSettings /></Provider>) })
        expect(screen.getByText(/blockiert/)).toBeInTheDocument()
        expect(screen.getByText(/Schloss/)).toBeInTheDocument()
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Nochmal fragen' })) })
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true })
        expect(screen.getByText(/darf das Mikrofon benutzen/)).toBeInTheDocument()
    })
})
