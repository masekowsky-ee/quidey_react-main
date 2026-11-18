import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiFetch } from '../features/helperFunction'
import { clearOffline, flushOutbox, forgetReads, connectionState, tokenOwner, probeNow, startOfflineSync, SLOW_MS, HARD_MS, WRITE_TIMEOUT_MS, START_PROBE_MS } from '../features/offline/offline'
import { checkAuth } from '../features/auth/authAction'

// a JWT whose payload says who it is (the signature isn't looked at on the device)
const jwt = (userId) => `x.${btoa(JSON.stringify({ userId }))}.y`

const json = (data, status = 200) => Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }))
const down = () => Promise.reject(new TypeError('Failed to fetch'))
// the copy of a read is written right after the answer
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

// a connection that is there but leads nowhere: never answers, gives up when told to
const hang = (url, options) => new Promise((resolve, reject) => {
    options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
})

let fetchMock
beforeEach(async () => {
    await clearOffline()
    localStorage.setItem('token', jwt(7))
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('reads while offline', () => {
    it('answers from the saved copy when the server can not be reached', async () => {
        fetchMock.mockImplementationOnce(() => json([{ id: 1, name: 'Essay' }]))
        await apiFetch('/api/tasks')
        await settle()
        fetchMock.mockImplementation(down)
        expect(await apiFetch('/api/tasks')).toEqual([{ id: 1, name: 'Essay' }])
        expect(connectionState().offline).toBe(true)
    })

    it('shows the saved copy when the connection is only slow', async () => {
        fetchMock.mockImplementationOnce(() => json([{ id: 1 }]))
        await apiFetch('/api/tasks')
        await settle()
        vi.useFakeTimers()
        try {
            fetchMock.mockImplementation(hang) // never answers, gives up when cancelled
            const read = apiFetch('/api/tasks')
            await vi.advanceTimersByTimeAsync(SLOW_MS + 100)
            expect(await read).toEqual([{ id: 1 }])
            // the read that nobody waits for is cancelled later, so it doesn't hold a connection
            const signal = fetchMock.mock.calls.at(-1)[1].signal
            expect(signal.aborted).toBe(false)
            await vi.advanceTimersByTimeAsync(HARD_MS)
            expect(signal.aborted).toBe(true)
        } finally {
            vi.useRealTimers()
        }
    })

    it('fails with OFFLINE when nothing was saved for it', async () => {
        fetchMock.mockImplementation(down)
        await expect(apiFetch('/api/stats')).rejects.toMatchObject({ code: 'OFFLINE' })
    })

    it('treats a gateway error like a lost connection', async () => {
        fetchMock.mockImplementationOnce(() => json([{ id: 2 }]))
        await apiFetch('/api/tasks')
        await settle()
        fetchMock.mockImplementation(() => json({ error: 'bad gateway' }, 502))
        expect(await apiFetch('/api/tasks')).toEqual([{ id: 2 }])
    })

    it('does not hide an answer from the server, such as a refusal', async () => {
        fetchMock.mockImplementationOnce(() => json([{ id: 1 }]))
        await apiFetch('/api/tasks')
        await settle()
        fetchMock.mockImplementation(() => json({ error: 'No', code: 'PRO_REQUIRED' }, 403))
        await expect(apiFetch('/api/tasks')).rejects.toMatchObject({ status: 403, code: 'PRO_REQUIRED' })
    })

    it("keeps one account's copy away from another", async () => {
        fetchMock.mockImplementationOnce(() => json([{ id: 1 }]))
        await apiFetch('/api/tasks')
        await settle()
        localStorage.setItem('token', jwt(8))
        fetchMock.mockImplementation(down)
        await expect(apiFetch('/api/tasks')).rejects.toMatchObject({ code: 'OFFLINE' })
    })

    it('never saves sign-in or billing answers', async () => {
        fetchMock.mockImplementationOnce(() => json({ plans: [] }))
        await apiFetch('/api/billing')
        await settle()
        fetchMock.mockImplementation(down)
        await expect(apiFetch('/api/billing')).rejects.toMatchObject({ code: 'OFFLINE' })
    })
})

describe('a server that is known to be unreachable', () => {
    it('is not asked again for every request, only now and then, and at once when told to look', async () => {
        fetchMock.mockImplementationOnce(() => json([{ id: 1 }]))
        await apiFetch('/api/tasks')
        await settle()
        fetchMock.mockImplementation(down)
        await apiFetch('/api/tasks') // finds out: offline
        const callsWhenFound = fetchMock.mock.calls.length
        await apiFetch('/api/tasks')
        await apiFetch('/api/tasks')
        await apiFetch('/api/groups').catch(() => {})
        expect(fetchMock.mock.calls.length).toBe(callsWhenFound) // the saved copy, no network
        probeNow()
        await apiFetch('/api/tasks')
        expect(fetchMock.mock.calls.length).toBe(callsWhenFound + 1)
    })

    it('puts a change straight into the outbox, without waiting for a timeout', async () => {
        fetchMock.mockImplementation(down)
        await apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify({ name: 'First' }) }) // finds out
        const calls = fetchMock.mock.calls.length
        const second = await apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify({ name: 'Second' }) })
        expect(second).toMatchObject({ name: 'Second', pending: true })
        expect(fetchMock.mock.calls.length).toBe(calls)
        expect(connectionState().pending).toBe(2)
    })

    it('is back as soon as a request gets through', async () => {
        fetchMock.mockImplementation(down)
        await apiFetch('/api/stats').catch(() => {})
        expect(connectionState().offline).toBe(true)
        probeNow()
        fetchMock.mockImplementation(() => json({ ok: true }))
        await apiFetch('/api/stats')
        expect(connectionState().offline).toBe(false)
    })
})

describe('the start of the app', () => {
    it('finds out whether the server answers before the first reads go out', async () => {
        const stop = startOfflineSync()
        vi.useFakeTimers()
        try {
            fetchMock.mockImplementation(hang) // a connection that leads nowhere
            const read = apiFetch('/api/tasks')
            const outcome = expect(read).rejects.toMatchObject({ code: 'OFFLINE' })
            await vi.advanceTimersByTimeAsync(START_PROBE_MS + 100)
            await outcome
            // only the probe went out: the read never touched the dead connection
            expect(fetchMock.mock.calls.length).toBe(1)
            expect(fetchMock.mock.calls[0][0]).toMatch(/app-version/)
        } finally {
            stop()
            vi.useRealTimers()
        }
    })

    it('does nothing special when the server answers, a refusal included', async () => {
        const stop = startOfflineSync()
        try {
            fetchMock.mockImplementation(() => json({ error: 'x' }, 404))
            fetchMock.mockImplementationOnce(() => json({ error: 'not there' }, 404)) // the probe: an old server without the route
            fetchMock.mockImplementationOnce(() => json([{ id: 1 }]))
            expect(await apiFetch('/api/tasks')).toEqual([{ id: 1 }])
            expect(connectionState().offline).toBe(false)
        } finally {
            stop()
        }
    })
})

describe('writes while offline', () => {
    const post = (body) => ({ method: 'POST', body: JSON.stringify(body) })

    async function withSavedTasks(tasks = []) {
        fetchMock.mockImplementationOnce(() => json(tasks))
        await apiFetch('/api/tasks')
        await settle()
    }

    it('queues a new task, answers with a temporary id and shows it in the saved list', async () => {
        await withSavedTasks([{ id: 1, name: 'Old' }])
        fetchMock.mockImplementation(down)
        const created = await apiFetch('/api/tasks', post({ name: 'New', due: null }))
        expect(created.id).toMatch(/^local-/)
        expect(created).toMatchObject({ name: 'New', done: false, pending: true })
        expect(connectionState().pending).toBe(1)
        const list = await apiFetch('/api/tasks')
        expect(list.map((t) => t.name)).toEqual(['Old', 'New'])
    })

    it('sends the queue in order once the server is back, with an idempotency key', async () => {
        await withSavedTasks([])
        fetchMock.mockImplementation(down)
        const created = await apiFetch('/api/tasks', post({ name: 'New' }))
        await apiFetch(`/api/tasks/${created.id}`, { method: 'PUT', body: JSON.stringify({ id: created.id, name: 'Renamed', done: false }) })
        expect(connectionState().pending).toBe(2)

        fetchMock.mockReset()
        fetchMock.mockImplementationOnce(() => json({ id: 42, name: 'New' }, 201))
        fetchMock.mockImplementationOnce(() => json({ id: 42, name: 'Renamed' }))
        const synced = vi.fn()
        window.addEventListener('quidey:synced', synced)
        expect(await flushOutbox()).toBe(2)
        window.removeEventListener('quidey:synced', synced)

        const [firstUrl, first] = fetchMock.mock.calls[0]
        expect(firstUrl).toMatch(/\/api\/tasks$/)
        expect(first.headers['Idempotency-Key']).toBeTruthy()
        // the temporary id became the real one, in the address and in the body
        const [secondUrl, second] = fetchMock.mock.calls[1]
        expect(secondUrl).toMatch(/\/api\/tasks\/42$/)
        expect(JSON.parse(second.body).id).toBe(42)
        expect(connectionState().pending).toBe(0)
        expect(synced).toHaveBeenCalledTimes(1)
    })

    it('uses the real id for a later change to something made offline', async () => {
        await withSavedTasks([])
        fetchMock.mockImplementation(down)
        const created = await apiFetch('/api/tasks', post({ name: 'New' }))
        fetchMock.mockReset()
        fetchMock.mockImplementationOnce(() => json({ id: 9 }, 201))
        await flushOutbox()
        fetchMock.mockImplementationOnce(() => json({ id: 9, name: 'Later' }))
        await apiFetch(`/api/tasks/${created.id}`, { method: 'PUT', body: JSON.stringify({ id: created.id, name: 'Later' }) })
        expect(fetchMock.mock.calls[1][0]).toMatch(/\/api\/tasks\/9$/)
    })

    it('keeps the queue when the server is still down, and sends it later', async () => {
        await withSavedTasks([])
        fetchMock.mockImplementation(down)
        await apiFetch('/api/tasks', post({ name: 'A' }))
        expect(await flushOutbox()).toBe(0)
        expect(connectionState().pending).toBe(1)
        fetchMock.mockReset()
        fetchMock.mockImplementation(() => json({ id: 5 }, 201))
        expect(await flushOutbox()).toBe(1)
        expect(connectionState().pending).toBe(0)
    })

    it('drops a change the server refuses and says so, and ignores a delete of something already gone', async () => {
        await withSavedTasks([{ id: 1, name: 'A' }, { id: 2, name: 'B' }])
        fetchMock.mockImplementation(down)
        await apiFetch('/api/tasks/1', { method: 'DELETE' })
        await apiFetch('/api/tasks/2', { method: 'PUT', body: JSON.stringify({ id: 2, name: '' }) })
        fetchMock.mockReset()
        fetchMock.mockImplementationOnce(() => json({ error: 'gone' }, 404))
        fetchMock.mockImplementationOnce(() => json({ error: 'name', code: 'INVALID_INPUT' }, 400))
        await flushOutbox()
        expect(connectionState()).toMatchObject({ pending: 0, failed: 1 })
    })

    it('removes a deleted task from the saved list', async () => {
        await withSavedTasks([{ id: 1, name: 'A' }, { id: 2, name: 'B' }])
        fetchMock.mockImplementation(down)
        expect(await apiFetch('/api/tasks/1', { method: 'DELETE' })).toEqual({ deletedIds: ['1'] })
        expect((await apiFetch('/api/tasks')).map((t) => t.id)).toEqual([2])
    })

    it('keeps a change in the outbox when the server never answers, and sends it with the same key', async () => {
        await withSavedTasks([])
        vi.useFakeTimers()
        try {
            fetchMock.mockImplementation(hang)
            const pending = apiFetch('/api/tasks', post({ name: 'Slow' }))
            await vi.advanceTimersByTimeAsync(WRITE_TIMEOUT_MS + 100)
            const created = await pending
            expect(created).toMatchObject({ name: 'Slow', pending: true })
            expect(connectionState().pending).toBe(1)
            const firstKey = fetchMock.mock.calls.at(-1)[1].headers['Idempotency-Key']
            expect(firstKey).toBeTruthy()

            fetchMock.mockReset()
            fetchMock.mockImplementation(() => json({ id: 11 }, 201))
            expect(await flushOutbox()).toBe(1)
            // the same key as the try that got no answer: if it had reached the server, nothing is made twice
            expect(fetchMock.mock.calls[0][1].headers['Idempotency-Key']).toBe(firstKey)
        } finally {
            vi.useRealTimers()
        }
    })

    it('does not drop an outbox entry whose send got no answer', async () => {
        await withSavedTasks([])
        fetchMock.mockImplementation(down)
        await apiFetch('/api/tasks', post({ name: 'Keep' }))
        vi.useFakeTimers()
        try {
            fetchMock.mockReset()
            fetchMock.mockImplementation(hang)
            const flush = flushOutbox()
            await vi.advanceTimersByTimeAsync(WRITE_TIMEOUT_MS + 100)
            expect(await flush).toBe(0)
            expect(connectionState()).toMatchObject({ pending: 1, failed: 0 })
        } finally {
            vi.useRealTimers()
        }
    })

    it('queues a finished focus session', async () => {
        fetchMock.mockImplementation(down)
        const saved = await apiFetch('/api/sessions', post({ totalTime: 1500, workedTasks: [] }))
        expect(saved).toMatchObject({ totalTime: 1500, pending: true })
        expect(connectionState().pending).toBe(1)
    })

    it('refuses a write that is not made for offline use', async () => {
        fetchMock.mockImplementation(down)
        await expect(apiFetch('/api/friends/requests', post({ username: 'x' }))).rejects.toMatchObject({ code: 'OFFLINE' })
        expect(connectionState().pending).toBe(0)
    })

    it('goes straight out when online and nothing waits', async () => {
        fetchMock.mockImplementation(() => json({ id: 3, name: 'Direct' }, 201))
        expect(await apiFetch('/api/tasks', post({ name: 'Direct' }))).toEqual({ id: 3, name: 'Direct' })
        expect(connectionState().pending).toBe(0)
    })
})

describe('housekeeping', () => {
    it('reads the account id from a token', () => {
        expect(tokenOwner(jwt(7))).toBe('7')
        expect(tokenOwner('garbage')).toBe('')
    })

    it('forgetReads removes the saved answers but keeps changes that still wait', async () => {
        fetchMock.mockImplementationOnce(() => json([]))
        await apiFetch('/api/tasks')
        await settle()
        fetchMock.mockImplementation(down)
        await apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify({ name: 'Keep' }) })
        await forgetReads()
        await expect(apiFetch('/api/stats')).rejects.toMatchObject({ code: 'OFFLINE' })
        expect(connectionState().pending).toBe(1)
    })
})

describe('opening the app without a connection', () => {
    const run = async () => {
        const actions = []
        await checkAuth()((action) => actions.push(action))
        return actions
    }

    it('signs in from the last saved answer about the account', async () => {
        fetchMock.mockImplementationOnce(() => json({ username: 'ann', isPro: true }))
        expect((await run()).map((a) => a.type)).toContain('SET_ACCESS')
        await settle()
        fetchMock.mockImplementation(down)
        const actions = await run()
        expect(actions.find((a) => a.type === 'SET_ACCESS').payload).toMatchObject({ username: 'ann', isPro: true })
        expect(actions.find((a) => a.type === 'LOGIN_SUCCESS').payload.username).toBe('ann')
    })

    it('gives up on a server that never answers and uses the saved answer', async () => {
        fetchMock.mockImplementationOnce(() => json({ username: 'ann', isPro: true }))
        await run()
        await settle()
        vi.useFakeTimers()
        try {
            fetchMock.mockImplementation(hang)
            const pending = run()
            await vi.advanceTimersByTimeAsync(5100)
            expect((await pending).map((a) => a.type)).toEqual(['LOGIN_SUCCESS', 'SET_ACCESS'])
        } finally {
            vi.useRealTimers()
        }
    })

    it('does nothing when there is no saved answer yet', async () => {
        fetchMock.mockImplementation(down)
        expect(await run()).toEqual([])
    })

    it('still signs out when the server says the login is no good', async () => {
        fetchMock.mockImplementation(() => json({ error: 'x' }, 401))
        expect((await run()).map((a) => a.type)).toEqual(['LOGOUT'])
    })
})
