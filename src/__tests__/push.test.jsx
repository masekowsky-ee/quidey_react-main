import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { addTask } from '../features/tasks/taskAction'
import {
    keyBytes, pushSupport, refreshPush, enablePush, disablePush, offerPushAfterTask, forgetPushOnSignOut,
    pushCovers, resetPushState,
} from '../features/pwa/push'
import { devServiceWorkerSource, serviceWorkerSource, PUBLIC_FILES } from '../../pwa.js'
import Settings from '../components/Settings'
import PushOffer from '../components/PushOffer'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
const ALL_ON = { plan: true, digest: true, messages: true, social: true }
const callsTo = (path, method) => apiFetch.mock.calls.filter(([url, options]) => url === path && (options?.method ?? 'GET') === method)
const bodyOf = (path, method) => JSON.parse(callsTo(path, method).at(-1)[1].body)

describe('service worker: notifications', () => {
    it('shows pushes and opens their page on a click, in the built worker and the dev one', () => {
        for (const source of [serviceWorkerSource(PUBLIC_FILES), devServiceWorkerSource()]) {
            expect(source).toContain("addEventListener('push'")
            expect(source).toContain('showNotification(')
            expect(source).toContain("addEventListener('notificationclick'")
            expect(source).toContain("type: 'quidey:open'")
            expect(() => new Function(source)).not.toThrow()
        }
    })

    it('caches nothing in dev', () => {
        const source = devServiceWorkerSource()
        expect(source).not.toContain("addEventListener('fetch'")
        expect(source).not.toContain('caches.')
    })

    it('stays quiet while the app is in front, except for the test and on Safari', () => {
        const source = serviceWorkerSource(PUBLIC_FILES)
        expect(source).toContain("client.focused && client.visibilityState === 'visible'")
        expect(source).toContain("message.tag !== 'test'")
        expect(source).toContain('ALWAYS_SHOW')
    })
})

describe('push helpers', () => {
    it('turns the server key into bytes', () => {
        const bytes = keyBytes(KEY)
        expect(bytes).toBeInstanceOf(Uint8Array)
        expect(bytes.length).toBe(65)
        expect(bytes[0]).toBe(4)
    })

    it('knows when the browser cannot do it', () => {
        expect(pushSupport()).toBe('unsupported')
    })
})

// A browser that can do push: a worker, a push manager and the permission
function fakeBrowser({ permission = 'default', answer = 'granted' } = {}) {
    let current = null
    const subscription = {
        endpoint: 'https://push.example.com/send/abc',
        options: { applicationServerKey: keyBytes(KEY).buffer },
        toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'BKey', auth: 'secret' } } },
        unsubscribe: vi.fn(async () => { current = null; return true }),
    }
    const pushManager = {
        getSubscription: vi.fn(async () => current),
        subscribe: vi.fn(async () => { current = subscription; return subscription }),
    }
    const registration = { pushManager }
    Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: {
            register: vi.fn(async () => registration),
            ready: Promise.resolve(registration),
            getRegistration: vi.fn(async () => registration),
            addEventListener() {}, removeEventListener() {}, startMessages() {},
        },
    })
    window.PushManager = function PushManager() {}
    const notification = {
        permission,
        requestPermission: vi.fn(async () => { notification.permission = answer; return answer }),
    }
    globalThis.Notification = notification
    return { subscription, pushManager, notification, subscribed: () => current }
}

function respond() {
    apiFetch.mockImplementation(async (url, options = {}) => {
        if (url === '/api/push/key') return { publicKey: KEY }
        if (url === '/api/push/subscription' && options.method === 'PUT') {
            const { kinds } = JSON.parse(options.body)
            return { kinds: { ...ALL_ON, ...kinds } }
        }
        if (url === '/api/push/subscription' && options.method === 'DELETE') return { subscribed: false }
        if (url === '/api/push/test') return { sent: true }
        return []
    })
}

const makeStore = () => configureStore({ reducer: rootReducer })
function renderApp() {
    return render(<Provider store={makeStore()}><Settings /><PushOffer /></Provider>)
}
const openAppArea = () => fireEvent.click(screen.getByRole('tab', { name: 'App' }))

describe('notifications on this device', () => {
    beforeEach(() => {
        apiFetch.mockReset()
        respond()
        localStorage.clear()
        resetPushState()
        window.matchMedia = vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
    })
    afterEach(() => {
        delete navigator.serviceWorker
        delete window.PushManager
        delete globalThis.Notification
    })

    it('says so where the browser cannot receive them', async () => {
        renderApp()
        openAppArea()
        expect(screen.getByRole('heading', { name: 'Benachrichtigungen' })).toBeInTheDocument()
        expect(await screen.findByText('Dieser Browser kann keine Benachrichtigungen empfangen.')).toBeInTheDocument()
    })

    it('turns on in the settings: asks once, signs the device up, then each kind switches on its own', async () => {
        const browser = fakeBrowser()
        renderApp()
        openAppArea()
        const device = await screen.findByRole('group', { name: 'Auf diesem Gerät' })
        fireEvent.click(device.querySelector('button[aria-pressed="false"]'))

        await screen.findByRole('group', { name: 'Dein Tag' })
        expect(browser.notification.requestPermission).toHaveBeenCalledTimes(1)
        expect(browser.pushManager.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }))
        expect(bodyOf('/api/push/subscription', 'PUT')).toEqual({ endpoint: 'https://push.example.com/send/abc', keys: { p256dh: 'BKey', auth: 'secret' } })
        expect(localStorage.getItem('push')).toBe('on')
        expect(localStorage.getItem('pushEndpoint')).toBe('https://push.example.com/send/abc')
        expect(pushCovers('plan')).toBe(true)

        const digest = screen.getByRole('group', { name: 'Dein Tag' })
        fireEvent.click(digest.querySelector('button[aria-pressed="false"]'))
        await waitFor(() => expect(bodyOf('/api/push/subscription', 'PUT').kinds).toEqual({ digest: false }))
        expect(screen.getByRole('group', { name: 'Dein Tag' }).querySelector('[aria-pressed="true"]').textContent).toBe('Aus')

        fireEvent.click(screen.getByRole('button', { name: 'Test senden' }))
        expect(await screen.findByText('Verschickt. Sie sollte gleich erscheinen.')).toBeInTheDocument()
        expect(bodyOf('/api/push/test', 'POST')).toEqual({ endpoint: 'https://push.example.com/send/abc' })
    })

    it('turns off: gone from the server and from the browser', async () => {
        const browser = fakeBrowser({ permission: 'granted' })
        await act(() => enablePush())
        await act(() => disablePush())
        expect(bodyOf('/api/push/subscription', 'DELETE')).toEqual({ endpoint: 'https://push.example.com/send/abc' })
        expect(browser.subscription.unsubscribe).toHaveBeenCalled()
        expect(localStorage.getItem('push')).toBe('off')
        expect(pushCovers('plan')).toBe(false)
    })

    it('a permission taken back in the browser turns it off on the next start', async () => {
        const browser = fakeBrowser({ permission: 'granted' })
        await act(() => enablePush())
        browser.notification.permission = 'denied'
        await act(() => refreshPush())
        expect(callsTo('/api/push/subscription', 'DELETE')).toHaveLength(1)
        expect(localStorage.getItem('push')).toBe('off')
        renderApp()
        openAppArea()
        expect(await screen.findByText(/Im Browser blockiert/)).toBeInTheDocument()
        expect(screen.queryByRole('group', { name: 'Auf diesem Gerät' })).not.toBeInTheDocument()
    })

    it('every start hands the address over again, for whoever is signed in', async () => {
        fakeBrowser({ permission: 'granted' })
        await act(() => enablePush())
        apiFetch.mockClear()
        await act(() => refreshPush())
        expect(callsTo('/api/push/subscription', 'PUT')).toHaveLength(1)
    })

    it('asks once after a new task, and yes turns them on', async () => {
        const browser = fakeBrowser()
        await act(() => refreshPush())
        const store = makeStore()
        render(<Provider store={store}><PushOffer /></Provider>)
        apiFetch.mockImplementationOnce(async () => ({ id: 7, name: 'Essay' }))
        await act(() => store.dispatch(addTask('Essay', null, '', 50)))

        expect(screen.getByRole('alertdialog', { name: 'Soll Quidey dich erinnern?' })).toBeInTheDocument()
        expect(localStorage.getItem('pushAsked')).toBe('1')
        fireEvent.click(screen.getByRole('button', { name: 'Benachrichtigungen einschalten' }))
        await waitFor(() => expect(localStorage.getItem('push')).toBe('on'))
        expect(browser.notification.requestPermission).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })

    it('"later" closes it, and it does not come again', async () => {
        fakeBrowser()
        await act(() => refreshPush())
        render(<Provider store={makeStore()}><PushOffer /></Provider>)
        act(() => offerPushAfterTask())
        fireEvent.click(screen.getByRole('button', { name: 'Später' }))
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
        expect(localStorage.getItem('push')).toBeNull()
        act(() => offerPushAfterTask())
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })

    it('never asks when the browser blocked them or they are on already', async () => {
        fakeBrowser({ permission: 'denied' })
        await act(() => refreshPush())
        render(<Provider store={makeStore()}><PushOffer /></Provider>)
        act(() => offerPushAfterTask())
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
        expect(localStorage.getItem('pushAsked')).toBeNull()
    })

    it('signing out removes this device from the account, with the old token', () => {
        localStorage.setItem('push', 'on')
        localStorage.setItem('pushEndpoint', 'https://push.example.com/send/abc')
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))
        forgetPushOnSignOut('old-token')
        const [url, options] = fetchSpy.mock.calls[0]
        expect(url).toBe('/api/push/subscription')
        expect(options).toMatchObject({ method: 'DELETE', keepalive: true, body: JSON.stringify({ endpoint: 'https://push.example.com/send/abc' }) })
        expect(options.headers.Authorization).toBe('Bearer old-token')
        expect(localStorage.getItem('push')).toBeNull()

        // another account takes over: the device stays on and goes over to that one
        localStorage.setItem('push', 'on')
        localStorage.setItem('pushEndpoint', 'https://push.example.com/send/abc')
        forgetPushOnSignOut('old-token', true)
        expect(localStorage.getItem('push')).toBe('on')
        fetchSpy.mockRestore()
    })
})
