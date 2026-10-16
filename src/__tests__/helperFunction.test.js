import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    apiFetch, formatDate, toInputDate, formatClock,
    toDateOnly, sameDay, mondayIndex, monthGrid,
} from '../features/helperFunction'

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

describe('apiFetch', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.stubGlobal('fetch', vi.fn())
    })

    afterEach(() => {
        vi.unstubAllGlobals()
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

    it('throws a generic message when the error body is not JSON', async () => {
        fetch.mockResolvedValue({ ok: false, json: () => Promise.reject(new Error('not json')) })
        await expect(apiFetch('/api/tasks')).rejects.toThrow('Request failed')
    })
})
