import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch, SIGNED_OUT_EVENT } from '../features/helperFunction'
import { track, flushUsage, setUsageEnabled, resetUsage, platform } from '../features/usage/usage'
import { trackView, trackAction } from '../features/usage/track'
import { setUsageConsent, selectUsageConsent } from '../features/auth/authAction'

const plugin = vi.hoisted(() => ({
    isAvailable: vi.fn(async () => ({ available: true })),
    setEnabled: vi.fn(async () => {}),
    logScreen: vi.fn(async () => {}),
    logEvent: vi.fn(async () => {}),
}))
vi.mock('@capacitor/core', async (importOriginal) => {
    const original = await importOriginal()
    return { ...original, registerPlugin: (name) => (name === 'QuideyAnalytics' ? plugin : original.registerPlugin(name)) }
})

let fetchMock
const usageCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/api/usage'))
const bodyOf = (call) => JSON.parse(call[1].body)
const queued = () => JSON.parse(sessionStorage.getItem('usageQueue') ?? '[]')

beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-07T10:00:00Z'))
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('token', 'tok')
    resetUsage()
    fetchMock = vi.fn(async () => ({ ok: true, status: 204, json: async () => ({}) }))
    vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
    resetUsage()
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

describe('track', () => {
    it('queues nothing and sends nothing without consent', async () => {
        track('app_open')
        track('view:home')
        await vi.advanceTimersByTimeAsync(120_000)
        expect(usageCalls()).toHaveLength(0)
        expect(queued()).toEqual([])
    })

    it('flushes three events as one POST /api/usage with the platform', async () => {
        setUsageEnabled(true)
        track('app_open')
        track('view:home')
        track('focus_start')
        await vi.advanceTimersByTimeAsync(60_000)
        expect(usageCalls()).toHaveLength(1)
        const call = usageCalls()[0]
        expect(call[1].method).toBe('POST')
        expect(call[1].headers.Authorization).toBe('Bearer tok')
        const body = bodyOf(call)
        expect(body.platform).toBe('web')
        expect(body.events.map(e => e.metric)).toEqual(['app_open', 'view:home', 'focus_start'])
        expect(body.events[0].at).toBe('2026-11-07T10:00:00.000Z')
    })

    it('sends a value along when there is one', async () => {
        setUsageEnabled(true)
        track('active_minute', 1)
        await flushUsage()
        expect(bodyOf(usageCalls()[0]).events[0]).toMatchObject({ metric: 'active_minute', value: 1 })
    })

    it('drops metrics the server does not take from the client', async () => {
        setUsageEnabled(true)
        track('task_created')
        track('task_done')
        track('focus_done')
        track('focus_end')
        track('view:somewhere_else')
        track('anything')
        await flushUsage()
        expect(usageCalls()).toHaveLength(0)
    })

    it('empties the queue and never sends when switched off with a full queue', async () => {
        setUsageEnabled(true)
        for (let i = 0; i < 50; i++) track('app_open')
        expect(queued()).toHaveLength(50)
        setUsageEnabled(false)
        expect(queued()).toEqual([])
        await flushUsage()
        await vi.advanceTimersByTimeAsync(300_000)
        expect(usageCalls()).toHaveLength(0)
    })

    it('flushes with keepalive when the tab gets hidden', async () => {
        setUsageEnabled(true)
        track('app_open')
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
        document.dispatchEvent(new Event('visibilitychange'))
        await vi.advanceTimersByTimeAsync(0)
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
        expect(usageCalls()).toHaveLength(1)
        expect(usageCalls()[0][1].keepalive).toBe(true)
        expect(usageCalls()[0][1].headers.Authorization).toBe('Bearer tok')
    })

    it('sends in chunks of at most 200 events and keeps at most 500', async () => {
        setUsageEnabled(true)
        for (let i = 0; i < 520; i++) track('app_open')
        expect(queued()).toHaveLength(500)
        await flushUsage()
        const sizes = usageCalls().map(c => bodyOf(c).events.length)
        expect(sizes).toEqual([200, 200, 100])
    })

    it('keeps the events when the server cannot be reached', async () => {
        setUsageEnabled(true)
        track('app_open')
        fetchMock.mockRejectedValueOnce(new Error('offline'))
        await flushUsage()
        expect(queued()).toHaveLength(1)
        await flushUsage()
        expect(usageCalls()).toHaveLength(2)
        expect(queued()).toEqual([])
    })

    it('clears the queue without sending on sign-out', async () => {
        setUsageEnabled(true)
        track('app_open')
        window.dispatchEvent(new Event(SIGNED_OUT_EVENT))
        await vi.advanceTimersByTimeAsync(120_000)
        expect(usageCalls()).toHaveLength(0)
        expect(queued()).toEqual([])
    })

    it('picks up events a reload left in sessionStorage', async () => {
        sessionStorage.setItem('usageQueue', JSON.stringify([{ metric: 'app_open', at: Date.now() }]))
        setUsageEnabled(true)
        await flushUsage()
        expect(bodyOf(usageCalls()[0]).events).toHaveLength(1)
    })
})

describe('platform', () => {
    it('is web in a browser tab and pwa when installed', () => {
        expect(platform()).toBe('web')
        window.matchMedia = vi.fn(() => ({ matches: true }))
        expect(platform()).toBe('pwa')
        delete window.matchMedia
    })
})

describe('apiFetch', () => {
    it('sends X-Quidey-Platform', async () => {
        await apiFetch('/api/me')
        expect(fetchMock.mock.calls[0][1].headers['X-Quidey-Platform']).toBe('web')
    })
})

describe('trackView / trackAction', () => {
    it('queues the area of a page by name, never the path', async () => {
        setUsageEnabled(true)
        trackView('/u/anna')
        trackView('/notes')
        trackView('/study')
        await flushUsage()
        expect(bodyOf(usageCalls()[0]).events.map(e => e.metric)).toEqual(['view:user_profile', 'view:notes', 'view:study'])
    })

    it('queues client actions and keeps task_created for Firebase only', async () => {
        setUsageEnabled(true)
        trackAction('group_created')
        trackAction('task_created')
        await flushUsage()
        expect(bodyOf(usageCalls()[0]).events.map(e => e.metric)).toEqual(['group_created'])
    })
})

describe('setUsageConsent', () => {
    it('stores the answer in access.usageConsent and switches counting on', async () => {
        const store = configureStore({ reducer: rootReducer })
        expect(selectUsageConsent(store.getState()).choice).toBe(null)
        fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ choice: 'granted', at: '2026-11-07T10:00:00.000Z', version: 1 }) })
        await store.dispatch(setUsageConsent(true))
        const call = fetchMock.mock.calls[0]
        expect(call[0]).toContain('/api/profile/usage-consent')
        expect(call[1].method).toBe('PUT')
        expect(JSON.parse(call[1].body)).toEqual({ granted: true })
        expect(selectUsageConsent(store.getState()).choice).toBe('granted')
        track('app_open')
        expect(queued()).toHaveLength(1)
    })

    it('a no switches counting off and empties the queue', async () => {
        const store = configureStore({ reducer: rootReducer })
        setUsageEnabled(true)
        track('app_open')
        fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ choice: 'denied', at: 'x', version: 1 }) })
        await store.dispatch(setUsageConsent(false))
        expect(selectUsageConsent(store.getState()).choice).toBe('denied')
        expect(queued()).toEqual([])
    })
})
