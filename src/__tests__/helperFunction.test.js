import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    apiFetch, apiUrl, formatDate, toInputDate, formatClock, getInitials,
    toDateOnly, sameDay, mondayIndex, monthGrid, dueText,
} from '../features/helperFunction'
import { translate } from '../i18n/useTranslation'

// The API sends a date column as "local midnight, written in UTC".
// Building it from local parts keeps these tests correct in every time zone.
const apiDate = (year, month, day) => new Date(year, month - 1, day).toISOString()

describe('formatDate', () => {
    it('shows the day that was saved, even though the API sends it in UTC', () => {
        expect(formatDate(apiDate(2026, 10, 20))).toBe('20.10.2026')
    })

    it('does not pad day or month', () => {
        expect(formatDate(apiDate(2026, 1, 5))).toBe('5.1.2026')
    })

    it('returns an empty string for missing dates', () => {
        expect(formatDate(null)).toBe('')
        expect(formatDate(undefined)).toBe('')
    })
})

describe('toInputDate', () => {
    it('gives the YYYY-MM-DD format a date input expects, zero padded', () => {
        expect(toInputDate(apiDate(2026, 3, 7))).toBe('2026-03-07')
    })

    it('returns an empty string for missing dates', () => {
        expect(toInputDate(null)).toBe('')
    })
})

describe('dueText', () => {
    // Thursday, 22 October 2026
    const now = new Date(2026, 9, 22, 15, 30)
    const t = (key, index) => translate('de', key, index)

    it('says the near days as words', () => {
        expect(dueText(apiDate(2026, 10, 22), t, now)).toBe('Heute')
        expect(dueText(apiDate(2026, 10, 23), t, now)).toBe('Morgen')
        expect(dueText(apiDate(2026, 10, 21), t, now)).toBe('Gestern')
        expect(dueText('2026-10-26', t, now)).toBe('Montag')
    })

    it('counts a day with a clock change as one day', () => {
        // the clocks go back on 25 October 2026 in Germany
        expect(dueText('2026-10-27', t, now)).toBe('Dienstag')
    })

    it('shows the date further away, with the year only when it is another one', () => {
        expect(dueText('2026-10-29', t, now)).toBe('29.10.')
        expect(dueText('2026-10-10', t, now)).toBe('10.10.')
        expect(dueText('2027-01-04', t, now)).toBe('4.1.2027')
        expect(dueText(null, t, now)).toBe('')
    })
})

describe('getInitials', () => {
    it('takes the first letters of up to two words', () => {
        expect(getInitials('anna berg')).toBe('AB')
        expect(getInitials('Anna Maria Berg')).toBe('AM')
        expect(getInitials('ben')).toBe('B')
    })

    it('skips symbols at the start of a word', () => {
        expect(getInitials('__ben')).toBe('B')
        expect(getInitials('@anna _berg')).toBe('AB')
        expect(getInitials('2fast')).toBe('2')
        expect(getInitials('élodie')).toBe('É')
    })

    it('shows a question mark when there is no name', () => {
        expect(getInitials('')).toBe('?')
        expect(getInitials('   ')).toBe('?')
        expect(getInitials(null)).toBe('?')
        expect(getInitials('___')).toBe('?')
    })
})

describe('formatClock', () => {
    it('formats milliseconds as HH:MM:SS', () => {
        expect(formatClock(3723000)).toBe('01:02:03')
        expect(formatClock(30 * 60 * 1000)).toBe('00:30:00')
    })

    it('drops partial seconds instead of rounding up', () => {
        expect(formatClock(1999)).toBe('00:00:01')
    })

    it('never shows negative time', () => {
        expect(formatClock(-5000)).toBe('00:00:00')
    })
})

describe('calendar helpers', () => {
    it('toDateOnly drops the time of day', () => {
        const d = toDateOnly(new Date(2026, 9, 16, 23, 59))
        expect([d.getHours(), d.getMinutes(), d.getDate()]).toEqual([0, 0, 16])
    })

    it('sameDay ignores the time of day', () => {
        expect(sameDay(new Date(2026, 9, 16, 0, 1), new Date(2026, 9, 16, 23, 59))).toBe(true)
        expect(sameDay(new Date(2026, 9, 16), new Date(2026, 9, 17))).toBe(false)
    })

    it('mondayIndex counts Monday as 0 and Sunday as 6', () => {
        expect(mondayIndex(new Date(2026, 9, 12))).toBe(0) // Monday
        expect(mondayIndex(new Date(2026, 9, 18))).toBe(6) // Sunday
    })

    it('monthGrid always returns 6 full weeks starting on a Monday', () => {
        const grid = monthGrid(new Date(2026, 9, 1)) // October 2026 starts on a Thursday
        expect(grid).toHaveLength(42)
        expect(mondayIndex(grid[0])).toBe(0)
        expect(grid[0]).toEqual(new Date(2026, 8, 28)) // Mon 28 Sep
        expect(grid[3]).toEqual(new Date(2026, 9, 1))  // the 1st lands under Thursday
    })

    it('monthGrid puts a month that starts on Sunday in the last column', () => {
        const grid = monthGrid(new Date(2026, 10, 1)) // November 2026 starts on a Sunday
        expect(grid[6]).toEqual(new Date(2026, 10, 1))
    })

    it('monthGrid handles a month that starts on Monday without a leading week', () => {
        const grid = monthGrid(new Date(2026, 5, 1)) // June 2026 starts on a Monday
        expect(grid[0]).toEqual(new Date(2026, 5, 1))
    })
})

describe('apiUrl', () => {
    afterEach(() => vi.unstubAllEnvs())

    it('keeps the relative path locally, so the Vite proxy handles it', () => {
        vi.stubEnv('VITE_API_URL', '')
        expect(apiUrl('/api/tasks')).toBe('/api/tasks')
    })

    it('prefixes the backend address in production builds', () => {
        vi.stubEnv('VITE_API_URL', 'https://api.quidey.example.com')
        expect(apiUrl('/api/tasks')).toBe('https://api.quidey.example.com/api/tasks')
    })

    it('ignores a trailing slash in the configured address', () => {
        vi.stubEnv('VITE_API_URL', 'https://api.quidey.example.com/')
        expect(apiUrl('/api/tasks')).toBe('https://api.quidey.example.com/api/tasks')
    })
})

describe('apiFetch', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.stubGlobal('fetch', vi.fn())
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.unstubAllEnvs()
    })

    it('calls the configured backend address', async () => {
        vi.stubEnv('VITE_API_URL', 'https://api.quidey.example.com')
        fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
        await apiFetch('/api/tasks')
        expect(fetch.mock.calls[0][0]).toBe('https://api.quidey.example.com/api/tasks')
    })

    const respond = (ok, body) => fetch.mockResolvedValue({ ok, json: () => Promise.resolve(body) })

    it('returns the parsed JSON body', async () => {
        respond(true, { id: 1 })
        await expect(apiFetch('/api/tasks')).resolves.toEqual({ id: 1 })
    })

    it('sends the stored token as a Bearer header', async () => {
        localStorage.setItem('token', 'abc')
        respond(true, {})
        await apiFetch('/api/tasks')
        const { headers } = fetch.mock.calls[0][1]
        expect(headers.Authorization).toBe('Bearer abc')
        expect(headers['Content-Type']).toBe('application/json')
    })

    it('sends no Authorization header when signed out', async () => {
        respond(true, {})
        await apiFetch('/api/tasks')
        expect(fetch.mock.calls[0][1].headers).not.toHaveProperty('Authorization')
    })

    it('keeps the method and body it was given', async () => {
        respond(true, {})
        await apiFetch('/api/tasks', { method: 'POST', body: '{"a":1}' })
        expect(fetch).toHaveBeenCalledWith('/api/tasks', expect.objectContaining({ method: 'POST', body: '{"a":1}' }))
    })

    it('throws the error message the API sent', async () => {
        respond(false, { error: 'Token invalid or expired' })
        await expect(apiFetch('/api/tasks')).rejects.toThrow('Token invalid or expired')
    })

    it('attaches the HTTP status and the API error code to the error', async () => {
        fetch.mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve({ error: 'User not found', code: 'USER_NOT_FOUND' }) })
        await expect(apiFetch('/api/friends/requests')).rejects.toMatchObject({ status: 404, code: 'USER_NOT_FOUND' })
    })

    it('throws a generic message when the error body is not JSON', async () => {
        fetch.mockResolvedValue({ ok: false, json: () => Promise.reject(new Error('not json')) })
        await expect(apiFetch('/api/tasks')).rejects.toThrow('Request failed')
    })
})
