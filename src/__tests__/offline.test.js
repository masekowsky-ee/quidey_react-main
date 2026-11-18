import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiFetch } from '../features/helperFunction'
import { clearOffline, flushOutbox, forgetReads, connectionState, tokenOwner } from '../features/offline/offline'

// a JWT whose payload says who it is (the signature isn't looked at on the device)
const jwt = (userId) => `x.${btoa(JSON.stringify({ userId }))}.y`

const json = (data, status = 200) => Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }))
const down = () => Promise.reject(new TypeError('Failed to fetch'))
// the copy of a read is written right after the answer
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

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
