import { describe, expect, it, vi } from 'vitest'

// nativePush.js against a plugin that behaves like Capacitor's: a Proxy that answers every property
// with a native call, `then` included ("PushNotifications.then() is not implemented on android").
// A promise resolved with it never settles, so nothing about push may hand the plugin itself out
// of an async function.
const plugin = vi.hoisted(() => {
    const own = {
        checkPermissions: async () => ({ receive: 'granted' }),
        requestPermissions: async () => ({ receive: 'denied' }),
        unregister: vi.fn(async () => {}),
    }
    return new Proxy(own, {
        get: (target, prop) => (prop in target ? target[prop]
            : () => Promise.reject(new Error(`"PushNotifications.${String(prop)}()" is not implemented on android`))),
    })
})
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: plugin }))

import { nativePermission, requestNativePermission, unregisterNative } from '../features/native/nativePush'

const settles = (promise) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('never settled')), 500)),
])

describe('the Android app\'s push plugin', () => {
    it('reads and asks for the permission through the plugin', async () => {
        await expect(settles(nativePermission())).resolves.toBe('granted')
        await expect(settles(requestNativePermission())).resolves.toBe('denied')
    })

    it('unregisters through the plugin', async () => {
        await settles(unregisterNative())
        expect(plugin.unregister).toHaveBeenCalled()
    })
})

describe('Android notification channels', () => {
    it('every kind of push has a channel of its own (the server sends the kind as channel_id)', async () => {
        const { NATIVE_CHANNELS } = await import('../features/native/nativePush')
        const { PUSH_KINDS } = await import('../features/pwa/push')
        expect(Object.keys(NATIVE_CHANNELS).sort()).toEqual([...PUSH_KINDS].sort())
        expect(NATIVE_CHANNELS.groups.de).toBe('Familien & Sitzungen')
    })
})
