import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiFetch } from '../features/helperFunction'
import { enablePush, disablePush, refreshPush, pushSupport, resetPushState, usePushState } from '../features/pwa/push'
import { requestNativePermission, unregisterNative } from '../features/native/nativePush'
import { renderHook } from '@testing-library/react'

// The Android app: push.js runs its flow on Firebase (nativePush.js), mocked here
vi.mock('../features/native/native', () => ({ isNativeApp: () => true, setupNativeApp: () => {} }))
vi.mock('../features/native/nativePush', () => ({
    nativePushAvailable: () => true,
    nativePermission: vi.fn(async () => 'granted'),
    requestNativePermission: vi.fn(async () => 'granted'),
    nativeSubscription: vi.fn(async () => ({ endpoint: 'fcm:token-123456789012345678', toJSON: () => ({ endpoint: 'fcm:token-123456789012345678' }) })),
    unregisterNative: vi.fn(async () => {}),
    onNativePushOpen: () => () => {},
    onNativePushInApp: () => () => {},
}))
vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const ALL_ON = { plan: true, digest: true, messages: true, social: true }
const callsTo = (path, method) => apiFetch.mock.calls.filter(([url, options]) => url === path && (options?.method ?? 'GET') === method)

beforeEach(() => {
    resetPushState()
    localStorage.clear()
    vi.clearAllMocks()
    apiFetch.mockImplementation(async (url, options = {}) => {
        if (url === '/api/push/key') return { publicKey: null, fcm: true }
        if (url === '/api/push/subscription' && options.method === 'PUT') return { kinds: ALL_ON }
        return {}
    })
})

describe('notifications in the Android app (Firebase)', () => {
    it('are supported when the app was built with its Firebase config', () => {
        expect(pushSupport()).toBe('supported')
    })

    it('turning on asks Android, then hands the FCM token over as the endpoint, without keys', async () => {
        expect(await enablePush()).toBe(true)
        expect(requestNativePermission).toHaveBeenCalled()
        expect(JSON.parse(callsTo('/api/push/subscription', 'PUT').at(-1)[1].body)).toEqual({ endpoint: 'fcm:token-123456789012345678' })
        expect(localStorage.getItem('push')).toBe('on')
        expect(localStorage.getItem('pushEndpoint')).toBe('fcm:token-123456789012345678')
        const { result } = renderHook(() => usePushState())
        expect(result.current.status).toBe('on')
    })

    it('the check at every start hands the token over again; off removes it and Firebase forgets it', async () => {
        await enablePush()
        apiFetch.mockClear()
        await refreshPush()
        expect(callsTo('/api/push/subscription', 'PUT')).toHaveLength(1)

        await disablePush()
        expect(JSON.parse(callsTo('/api/push/subscription', 'DELETE').at(-1)[1].body)).toEqual({ endpoint: 'fcm:token-123456789012345678' })
        expect(unregisterNative).toHaveBeenCalled()
        expect(localStorage.getItem('push')).toBe('off')
    })

    it('a server without Firebase sends nothing to the app: unavailable', async () => {
        apiFetch.mockImplementation(async (url) => (url === '/api/push/key' ? { publicKey: 'web-key', fcm: false } : {}))
        localStorage.setItem('push', 'on')
        await refreshPush()
        const { result } = renderHook(() => usePushState())
        expect(result.current.status).toBe('unavailable')
    })
})
