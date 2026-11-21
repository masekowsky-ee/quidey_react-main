import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch, clearApiCache } from '../features/api/api';

const ok = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

describe('apiFetch answer cache', () => {
    beforeEach(() => { clearApiCache(); localStorage.clear(); localStorage.setItem('token', 'me'); });

    it('serves a repeated GET from memory and shares a request in flight', async () => {
        const fetchMock = vi.fn(() => ok({ n: 1 }));
        vi.stubGlobal('fetch', fetchMock);
        const [a, b] = await Promise.all([apiFetch('/x', { cacheMs: 1000 }), apiFetch('/x', { cacheMs: 1000 })]);
        await apiFetch('/x', { cacheMs: 1000 });
        expect(a).toEqual({ n: 1 });
        expect(b).toEqual({ n: 1 });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not cache without cacheMs, and { fresh } skips it', async () => {
        const fetchMock = vi.fn(() => ok({}));
        vi.stubGlobal('fetch', fetchMock);
        await apiFetch('/y'); await apiFetch('/y');
        await apiFetch('/z', { cacheMs: 1000 }); await apiFetch('/z', { cacheMs: 1000, fresh: true });
        expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it('empties after a change and for another account', async () => {
        const fetchMock = vi.fn(() => ok({}));
        vi.stubGlobal('fetch', fetchMock);
        await apiFetch('/x', { cacheMs: 1000 });
        await apiFetch('/t', { method: 'POST', body: '{}' });
        await apiFetch('/x', { cacheMs: 1000 });
        localStorage.setItem('token', 'other');
        await apiFetch('/x', { cacheMs: 1000 });
        expect(fetchMock).toHaveBeenCalledTimes(4);
    });
});
