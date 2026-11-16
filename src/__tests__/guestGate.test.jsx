import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OPEN_AUTH_EVENT, openAuth, isGuestPath } from '../features/auth/gate'
import { apiFetch } from '../features/helperFunction'

// What a visitor without an account can open, and the window that asks them to sign in
let seen
const listener = (event) => seen.push(event.detail)

beforeEach(() => {
    seen = []
    localStorage.clear()
    window.addEventListener(OPEN_AUTH_EVENT, listener)
})
afterEach(() => {
    window.removeEventListener(OPEN_AUTH_EVENT, listener)
    vi.restoreAllMocks()
})

const answer = (status, body) => vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: false, status, json: async () => body,
})

describe('auth gate', () => {
    it('openAuth sends the mode and the details along', () => {
        openAuth('signup', { email: 'a@b.de' })
        openAuth()
        expect(seen).toEqual([{ mode: 'signup', email: 'a@b.de' }, { mode: 'signin' }])
    })

    it('knows which pages a visitor may look at', () => {
        expect(isGuestPath('/')).toBe(true)
        expect(isGuestPath('/calendar')).toBe(true)
        expect(isGuestPath('/focus')).toBe(true)
        expect(isGuestPath('/settings')).toBe(false)
    })

    it('a write without a token opens the window once and still fails', async () => {
        answer(401, { error: 'No existing token' })
        await expect(apiFetch('/api/tasks', { method: 'POST' })).rejects.toThrow()
        expect(seen).toHaveLength(1)
    })

    it('a read without a token fails quietly, without a request', async () => {
        const fetched = answer(401, { error: 'No existing token' })
        await expect(apiFetch('/api/tasks')).rejects.toMatchObject({ status: 401, code: 'NO_ACCOUNT' })
        expect(fetched).not.toHaveBeenCalled()
        expect(seen).toHaveLength(0)
    })

    it('what the sign-in itself reads still goes out', async () => {
        const fetched = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 200, json: async () => ({ nonce: 'n' }) })
        await expect(apiFetch('/api/auth/google/nonce')).resolves.toEqual({ nonce: 'n' })
        expect(fetched).toHaveBeenCalledTimes(1)
    })

    it('a wrong password does not open another window', async () => {
        answer(401, { error: 'Invalid sign in' })
        await expect(apiFetch('/api/login', { method: 'POST' })).rejects.toThrow()
        expect(seen).toHaveLength(0)
    })

    it('with a token nothing opens', async () => {
        localStorage.setItem('token', 't')
        answer(401, { error: 'No existing token' })
        await expect(apiFetch('/api/tasks', { method: 'POST' })).rejects.toThrow()
        expect(seen).toHaveLength(0)
    })
})
