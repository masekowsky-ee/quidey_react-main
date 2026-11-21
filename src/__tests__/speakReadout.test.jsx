import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, act } from '@testing-library/react'
import { makeStore as baseStore } from './helpers/store'
import { renderWithStore } from './helpers/render'
import { apiFetch } from '../features/api/api';
import { SET_TASK_STATE } from '../features/tasks/taskActionTypes'
import { SET_ACCESS, LOGIN_SUCCESS } from '../features/auth/authActionTypes'
import { setUiVariant } from '../features/tester/variants'
import { setLanguage } from '../features/settings/settingsAction'
import { translate } from '../i18n/useTranslation'
import { resetAssistantChat, setReadAloud } from '../features/assistant/assistantApi'
import { forgetAiQuota } from '../features/ai/ai'
import { speak, speechOutputSupport, stopSpeaking } from '../features/voice/speak'
import { buildDayReadout } from '../features/assistant/dayReadout'
import Today from '../components/home/Today'
import Home from '../components/Home'
import AssistantFab from '../components/assistant/AssistantFab'

vi.mock('../features/api/api', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))
vi.mock('../components/voice/MicButton.jsx', () => ({ default: () => null }))

// ---------- a stand-in for the browser's speech synthesis ----------

let spoken
let synth
class FakeUtterance {
    constructor(text) { this.text = text; this.lang = ''; this.voice = null }
}
function installSpeech({ voices = [{ lang: 'fr-FR', name: 'F' }] } = {}) {
    const listeners = {}
    spoken = []
    synth = {
        voices,
        speaking: false,
        speak: vi.fn((u) => { spoken.push(u); synth.speaking = true }),
        cancel: vi.fn(() => { synth.speaking = false }),
        getVoices: () => synth.voices,
        addEventListener: (name, fn) => { (listeners[name] ??= new Set()).add(fn) },
        removeEventListener: (name, fn) => { listeners[name]?.delete(fn) },
        emit: (name) => listeners[name]?.forEach(fn => fn()),
    }
    window.speechSynthesis = synth
    window.SpeechSynthesisUtterance = FakeUtterance
}
function removeSpeech() {
    delete window.speechSynthesis
    delete window.SpeechSynthesisUtterance
}

const NOW = new Date(2026, 10, 15, 8, 0)
const tasks = [
    { id: 1, name: 'Training', kind: 'event', due: '2026-11-15', due_time: '17:00', done: false },
    { id: 2, name: 'Hausaufgaben', kind: 'task', due: '2026-11-15', due_time: null, done: false },
    { id: 3, name: 'Mathe-Test', kind: 'event', due: '2026-11-15', due_time: '09:00', done: false },
    { id: 4, name: 'Schon fertig', kind: 'task', due: '2026-11-15', due_time: '07:00', done: true },
    { id: 5, name: 'Morgen', kind: 'task', due: '2026-11-16', due_time: '10:00', done: false },
    { id: 6, name: 'Ohne Tag', kind: 'task', due: null, due_time: null, done: false },
]
const tFor = (language) => (key, index) => translate(language, key, index)

describe('buildDayReadout', () => {
    it('reads two events and a task in time order (German)', () => {
        expect(buildDayReadout(tasks, NOW, tFor('de'), 'de'))
            .toBe('Heute: Mathe-Test um 9:00 Uhr, dann Training um 17:00 Uhr, außerdem: Hausaufgaben.')
    })

    it('reads them in English', () => {
        expect(buildDayReadout(tasks, NOW, tFor('en'), 'en'))
            .toBe('Today: Mathe-Test at 9:00, then Training at 17:00, also: Hausaufgaben.')
    })

    it('says so when nothing is planned', () => {
        expect(buildDayReadout([tasks[3], tasks[4]], NOW, tFor('de'), 'de')).toBe('Heute ist nichts geplant.')
        expect(buildDayReadout([], NOW, tFor('en'), 'en')).toBe('Nothing planned today.')
    })

    it('reads only tasks without a time as a plain list', () => {
        const list = [{ id: 1, name: 'A', kind: 'task', due: '2026-11-15', done: false }, { id: 2, name: 'B', kind: 'task', due: '2026-11-15', done: false }]
        expect(buildDayReadout(list, NOW, tFor('de'), 'de')).toBe('Heute: A, B.')
    })

    it('caps the items at eight and counts the rest', () => {
        const many = Array.from({ length: 11 }, (_, i) => ({ id: i, name: `T${i}`, kind: 'task', due: '2026-11-15', due_time: `${String(8 + i).padStart(2, '0')}:00`, done: false }))
        const text = buildDayReadout(many, NOW, tFor('de'), 'de')
        expect(text).toContain('T7 um 15:00 Uhr')
        expect(text).not.toContain('T8')
        expect(text.endsWith(' und 3 weitere.')).toBe(true)
        expect(buildDayReadout(many, NOW, tFor('en'), 'en').endsWith(' and 3 more.')).toBe(true)
    })
})

describe('speak', () => {
    beforeEach(() => installSpeech())
    afterEach(() => { stopSpeaking(); removeSpeech() })

    it('knows whether speech output exists', () => {
        expect(speechOutputSupport()).toBe(true)
        removeSpeech()
        expect(speechOutputSupport()).toBe(false)
    })

    it('speaks with the language, cancelling earlier speech first', () => {
        speak('Hallo', { lang: 'de-DE' })
        expect(synth.cancel).toHaveBeenCalled()
        expect(spoken).toHaveLength(1)
        expect(spoken[0].text).toBe('Hallo')
        expect(spoken[0].lang).toBe('de-DE')
    })

    it('stop cancels and fires onEnd once', () => {
        const onEnd = vi.fn()
        const stop = speak('Hallo', { lang: 'de-DE', onEnd })
        stop()
        stop()
        expect(onEnd).toHaveBeenCalledTimes(1)
        expect(synth.cancel).toHaveBeenCalledTimes(2) // before starting, and the stop
    })

    it('fires onEnd when the utterance ends or fails, and when a newer one takes over', () => {
        const first = vi.fn()
        const second = vi.fn()
        speak('Eins', { lang: 'de-DE', onEnd: first })
        spoken[0].onend()
        expect(first).toHaveBeenCalledTimes(1)
        speak('Zwei', { lang: 'de-DE', onEnd: first })
        speak('Drei', { lang: 'de-DE', onEnd: second })
        expect(first).toHaveBeenCalledTimes(2)
        spoken[2].onerror()
        expect(second).toHaveBeenCalledTimes(1)
    })

    it('picks a voice of the language when there is one', () => {
        synth.voices = [{ lang: 'en-US', name: 'E' }, { lang: 'de_DE', name: 'D' }]
        speak('Hallo', { lang: 'de-DE' })
        expect(spoken[0].voice.name).toBe('D')
    })

    it('prefers a voice on the device over a network voice of the language', () => {
        synth.voices = [
            { lang: 'de-DE', name: 'Google Deutsch', localService: false },
            { lang: 'de-AT', name: 'Lokal AT', localService: true },
            { lang: 'de-DE', name: 'Lokal DE', localService: true },
        ]
        speak('Hallo', { lang: 'de-DE' })
        expect(spoken[0].voice.name).toBe('Lokal DE')
        // a local voice of the language in another region beats a network voice of the exact one
        synth.voices = [{ lang: 'de-DE', name: 'Google Deutsch', localService: false }, { lang: 'de-AT', name: 'Lokal AT', localService: true }]
        speak('Hallo', { lang: 'de-DE' })
        expect(spoken[1].voice.name).toBe('Lokal AT')
        // only a network voice: it may be used
        synth.voices = [{ lang: 'en-US', name: 'Local EN', localService: true }, { lang: 'de-DE', name: 'Google Deutsch', localService: false }]
        speak('Hallo', { lang: 'de-DE' })
        expect(spoken[2].voice.name).toBe('Google Deutsch')
    })

    it('waits for the voices when none are loaded yet', () => {
        vi.useFakeTimers()
        try {
            synth.voices = []
            speak('Hallo', { lang: 'de-DE' })
            expect(spoken).toHaveLength(0)
            synth.voices = [{ lang: 'de-DE', name: 'D' }]
            synth.emit('voiceschanged')
            expect(spoken).toHaveLength(1)
            expect(spoken[0].voice.name).toBe('D')
            // and speaks anyway when they never come
            speak('Noch einmal', { lang: 'en-US' })
            synth.voices = []
            vi.advanceTimersByTime(1000)
            expect(spoken).toHaveLength(2)
        } finally { vi.useRealTimers() }
    })

    it('stops when the app is hidden', () => {
        const onEnd = vi.fn()
        speak('Hallo', { lang: 'de-DE', onEnd })
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
        document.dispatchEvent(new Event('visibilitychange'))
        Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
        expect(onEnd).toHaveBeenCalledTimes(1)
        expect(synth.speaking).toBe(false)
    })
})

// ---------- the pages ----------

const MAX_ON = { isPro: true, max: { active: true, gift: false, until: '2027-01-01T00:00:00Z' } }
const MAX_OFF = { isPro: true, max: { active: false, gift: false, until: null } }
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const todays = () => [
    { id: 1, name: 'Mathe-Test', kind: 'event', due: todayKey(), due_time: '23:30', done: false, group_ids: [] },
    { id: 2, name: 'Hausaufgaben', kind: 'task', due: todayKey(), due_time: null, done: false, group_ids: [] },
]

function makeStore(access, list = todays()) {
    const store = baseStore()
    store.dispatch(setLanguage('de'))
    store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 'tok', username: 'lena' } })
    store.dispatch({ type: SET_ACCESS, payload: access })
    store.dispatch({ type: SET_TASK_STATE, payload: { tasks: list, groups: [], notes: [] } })
    store.dispatch({ type: 'SET_COLLECTIONS', payload: [] })
    return store
}
const wrap = (store, ui) => renderWithStore(ui, { store })

describe('the Home read-out', () => {
    beforeEach(() => { installSpeech(); apiFetch.mockReset(); apiFetch.mockResolvedValue([]) })
    afterEach(() => { stopSpeaking(); removeSpeech() })

    it('is not there without Max', () => {
        wrap(makeStore(MAX_OFF), <Today tasks={todays()} />)
        expect(screen.queryByRole('button', { name: 'Vorlesen' })).toBeNull()
    })

    it('is not there when the device cannot speak', () => {
        removeSpeech()
        wrap(makeStore(MAX_ON), <Today tasks={todays()} />)
        expect(screen.queryByRole('button', { name: 'Vorlesen' })).toBeNull()
    })

    it('reads today aloud on a tap and stops on the second', () => {
        wrap(makeStore(MAX_ON), <Today tasks={todays()} />)
        const button = screen.getByRole('button', { name: 'Vorlesen' })
        expect(button).toHaveAttribute('aria-pressed', 'false')
        fireEvent.click(button)
        expect(spoken).toHaveLength(1)
        expect(spoken[0].text).toBe('Heute: Mathe-Test um 23:30 Uhr, außerdem: Hausaufgaben.')
        expect(spoken[0].lang).toBe('de-DE')
        const stop = screen.getByRole('button', { name: 'Stopp' })
        expect(stop).toHaveAttribute('aria-pressed', 'true')
        fireEvent.click(stop)
        expect(synth.speaking).toBe(false)
        expect(screen.getByRole('button', { name: 'Vorlesen' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('goes back to "Vorlesen" when the reading ends by itself', () => {
        wrap(makeStore(MAX_ON), <Today tasks={todays()} />)
        fireEvent.click(screen.getByRole('button', { name: 'Vorlesen' }))
        act(() => { spoken[0].onend() })
        expect(screen.getByRole('button', { name: 'Vorlesen' })).toBeInTheDocument()
    })

    it('stops when the page is left', () => {
        const view = wrap(makeStore(MAX_ON), <Today tasks={todays()} />)
        fireEvent.click(screen.getByRole('button', { name: 'Vorlesen' }))
        expect(synth.speaking).toBe(true)
        view.unmount()
        expect(synth.speaking).toBe(false)
    })
})

describe('Home on a phone', () => {
    beforeEach(() => { installSpeech(); apiFetch.mockReset(); apiFetch.mockResolvedValue([]); localStorage.clear() })
    afterEach(() => { stopSpeaking(); removeSpeech(); localStorage.clear() })
    // the phone's round timer button belongs to the testers' interface variants: the app's own look
    // has the timer on the focus sheet
    const renderHome = (access) => {
        const store = makeStore({ ...access, isTester: true })
        store.dispatch(setUiVariant('schulheft'))
        wrap(store, <Home t={(key) => key} setCustomError={vi.fn()} setActiveTimer={vi.fn()} />)
    }

    it('has the round timer button without Max', () => {
        renderHome(MAX_OFF)
        expect(screen.getByRole('button', { name: 'Timer öffnen' })).toBeInTheDocument()
    })

    it('has no round timer button with Max', () => {
        renderHome(MAX_ON)
        expect(screen.queryByRole('button', { name: 'Timer öffnen' })).toBeNull()
    })
})

describe('the assistant speaking its answers', () => {
    let release
    beforeEach(() => {
        installSpeech()
        resetAssistantChat()
        forgetAiQuota()
        apiFetch.mockReset()
        apiFetch.mockImplementation(async (url) => {
            if (url === '/api/ai/quota') return { available: true, scan: { used: 0, max: 1 }, aiLine: { used: 0, max: 5 }, assistant: { used: 0, max: 20 }, resetsAt: '2026-11-15T23:00:00.000Z' }
            if (url === '/api/ai/assistant') {
                await new Promise(resolve => { release = resolve })
                return { message: 'Das ist die Antwort.', actions: [], quota: null }
            }
            return {}
        })
    })
    afterEach(() => { stopSpeaking(); removeSpeech(); resetAssistantChat() })

    const openSheet = (store) => {
        wrap(store, <AssistantFab />)
        fireEvent.click(screen.getByRole('button', { name: 'KI-Assistent' }))
    }
    async function say(text) {
        fireEvent.change(screen.getByRole('textbox', { name: 'Nachricht an den Assistenten' }), { target: { value: text } })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Senden' })) })
    }
    const answer = async () => { await act(async () => { release() }) }

    it('speaks the answer when the toggle is on', async () => {
        openSheet(makeStore(MAX_ON))
        fireEvent.click(screen.getByRole('button', { name: 'Antworten vorlesen' }))
        await say('Hallo')
        await answer()
        expect(spoken.map(u => u.text)).toEqual(['Das ist die Antwort.'])
        expect(spoken[0].lang).toBe('de-DE')
    })

    it('is silent when the toggle is off', async () => {
        openSheet(makeStore(MAX_ON))
        await say('Hallo')
        await answer()
        expect(spoken).toHaveLength(0)
    })

    it('uses the toggle as it is when the answer arrives, not as it was when sent', async () => {
        openSheet(makeStore(MAX_ON))
        await say('Hallo')
        fireEvent.click(screen.getByRole('button', { name: 'Antworten vorlesen' }))
        await answer()
        expect(spoken).toHaveLength(1)

        await say('Und noch eins')
        fireEvent.click(screen.getByRole('button', { name: 'Antworten vorlesen' }))
        await answer()
        expect(spoken).toHaveLength(1)
    })

    it('stops speaking when the sheet closes', async () => {
        openSheet(makeStore(MAX_ON))
        fireEvent.click(screen.getByRole('button', { name: 'Antworten vorlesen' }))
        await say('Hallo')
        await answer()
        expect(synth.speaking).toBe(true)
        fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))
        expect(synth.speaking).toBe(false)
    })

    it('has no toggle where the device cannot speak', () => {
        removeSpeech()
        setReadAloud(false)
        openSheet(makeStore(MAX_ON))
        expect(screen.queryByRole('button', { name: 'Antworten vorlesen' })).toBeNull()
    })
})
