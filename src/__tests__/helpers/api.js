// Routes for a mocked apiFetch: { 'GET /api/x': answer | (options) => answer }. A missing route
// throws, so a call the test did not expect fails loudly (unless `fallback` answers it).
// Usage: vi.mock('../features/helperFunction', ...) stays in the test file (vi.mock is hoisted per file).
export function mockApiFetch(apiFetch, routes, fallback) {
    return apiFetch.mockImplementation(async (url, options = {}) => {
        const key = `${options.method ?? 'GET'} ${url}`
        if (!(key in routes)) {
            if (fallback) return fallback(url, options)
            throw new Error(`unexpected call ${key}`)
        }
        const route = routes[key]
        return typeof route === 'function' ? route(options) : route
    })
}
