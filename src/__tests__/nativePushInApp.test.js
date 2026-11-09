import { describe, expect, it, vi, beforeEach } from 'vitest'

// The Android app shows nothing for a push that comes while it is open. The test push from
// Settings is always sent from the open app, so the app shows that one itself (QuideyNotice).
const { listeners, notice } = vi.hoisted(() => ({ listeners: {}, notice: { show: vi.fn(async () => {}) } }))
vi.mock('@capacitor/push-notifications', () => ({
    PushNotifications: {
        addListener: (event, handler) => {
            listeners[event] = handler
            return Promise.resolve({ remove: async () => { delete listeners[event] } })
        },
    },
}))
vi.mock('@capacitor/core', () => ({ registerPlugin: () => notice }))
vi.mock('../features/native/native', () => ({ isNativeApp: () => true }))

const loaded = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('a push while the app is open', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_NATIVE_PUSH', 'on')
        notice.show.mockClear()
    })

    it('shows the test push on the channel of its kind', async () => {
        const { onNativePushInApp } = await import('../features/native/nativePush')
        const stop = onNativePushInApp()
        await loaded()
        listeners.pushNotificationReceived({ title: 'Quidey', body: 'Benachrichtigungen kommen an.', data: { tag: 'test', kind: 'plan', url: '/settings#app' } })
        expect(notice.show).toHaveBeenCalledWith({ title: 'Quidey', body: 'Benachrichtigungen kommen an.', channel: 'plan' })
        stop()
    })

    it('leaves every other push to the open app (its own toasts)', async () => {
        const { onNativePushInApp } = await import('../features/native/nativePush')
        const stop = onNativePushInApp()
        await loaded()
        listeners.pushNotificationReceived({ title: 'Lena', body: 'Hallo', data: { tag: '', kind: 'messages', url: '/inbox' } })
        expect(notice.show).not.toHaveBeenCalled()
        stop()
    })
})
