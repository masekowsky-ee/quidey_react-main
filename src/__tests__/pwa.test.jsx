import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import Settings from '../components/Settings'
import { listenForInstallPrompt } from '../features/pwa/install'
import { PUBLIC_FILES, serviceWorkerSource } from '../../pwa.js'

describe('PWA service worker', () => {
    it('precaches the given files under a version that follows them', () => {
        const a = serviceWorkerSource(['/', '/assets/index-a.js'])
        const b = serviceWorkerSource(['/', '/assets/index-b.js'])
        expect(a).toContain('const PRECACHE = ["/","/assets/index-a.js"];')
        const version = (source) => source.match(/const CACHE = '(quidey-[0-9a-f]+)'/)[1]
        expect(version(a)).not.toBe(version(b))
        expect(version(a)).toBe(version(serviceWorkerSource(['/', '/assets/index-a.js'])))
    })

    it('leaves the API, the live connection and other origins alone', () => {
        const source = serviceWorkerSource(PUBLIC_FILES)
        expect(source).toContain("url.origin !== self.location.origin) return")
        expect(source).toContain("startsWith('/api/')")
        expect(source).toContain("startsWith('/socket.io/')")
        expect(source).toContain("request.method !== 'GET') return")
        // a running timer must not be reloaded by an update
        expect(source).not.toContain('skipWaiting')
    })

    it('is a valid script', () => {
        expect(() => new Function(serviceWorkerSource(PUBLIC_FILES))).not.toThrow()
    })
})

describe('web app manifest', () => {
    const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'))

    it('has what browsers need to offer installing', () => {
        expect(manifest.name).toBe('Quidey')
        expect(manifest.start_url).toBe('/')
        expect(manifest.display).toBe('standalone')
        const sizes = manifest.icons.map((icon) => icon.sizes)
        expect(sizes).toContain('192x192')
        expect(sizes).toContain('512x512')
        expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true)
    })

    it('only points at icons that exist and are precached', () => {
        for (const icon of manifest.icons) {
            expect(() => readFileSync(`public${icon.src}`)).not.toThrow()
        }
        expect(PUBLIC_FILES).toContain('/manifest.webmanifest')
    })
})

describe('install as app (settings)', () => {
    const makeStore = () => configureStore({ reducer: rootReducer })
    const renderSettings = () => render(<Provider store={makeStore()}><MemoryRouter><Settings /></MemoryRouter></Provider>)

    beforeAll(() => listenForInstallPrompt())
    beforeEach(() => {
        localStorage.clear()
        window.matchMedia = vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
    })

    it('is hidden where the browser cannot install it', () => {
        renderSettings()
        expect(screen.queryByText('Als App')).not.toBeInTheDocument()
    })

    it('offers the browser install dialog once it is available', async () => {
        renderSettings()
        const event = new Event('beforeinstallprompt', { cancelable: true })
        event.prompt = vi.fn()
        event.userChoice = Promise.resolve({ outcome: 'accepted' })
        act(() => { window.dispatchEvent(event) })
        expect(event.defaultPrevented).toBe(true)

        // it has an area of its own in the settings
        fireEvent.click(screen.getByRole('tab', { name: 'App' }))
        fireEvent.click(screen.getByRole('button', { name: 'Installieren' }))
        expect(event.prompt).toHaveBeenCalledTimes(1)
        expect(await screen.findByText('Quidey ist als App installiert.')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Installieren' })).not.toBeInTheDocument()
    })
})
