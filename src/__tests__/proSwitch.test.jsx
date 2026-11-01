import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { SET_ACCESS } from '../features/auth/authActionTypes'
import { proBuilt, useProOn } from '../features/pro/flag'
import { LEGAL_PATHS } from '../legal/paths'
import { LegalFooter } from '../legal/LegalFooter'
import LegalPage from '../legal/LegalPage'
import Settings from '../components/Settings'
import { androidApk, apkOffer, formatSize } from '../features/native/androidApk'
import { placeList } from '../features/search/places'

const storeWith = (access) => {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch({ type: SET_ACCESS, payload: { isPro: true, accessMode: 'beta', ...access } })
    return store
}

afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
})

describe('Quidey Pro is switched off until it is turned on by hand', () => {
    it('is off by default: no build switch, nothing on sale', () => {
        expect(proBuilt()).toBe(false)
        const { result } = renderHook(() => useProOn(), { wrapper: ({ children }) => <Provider store={storeWith({ proSales: true })}>{children}</Provider> })
        expect(result.current).toBe(false)
    })

    it('shows only when the build and the server both say so', () => {
        vi.stubEnv('VITE_PRO', 'on')
        const hook = (access) => renderHook(() => useProOn(), { wrapper: ({ children }) => <Provider store={storeWith(access)}>{children}</Provider> }).result.current
        expect(hook({ proSales: true })).toBe(true)
        expect(hook({ proSales: false })).toBe(false)
        expect(hook({})).toBe(false)
    })

    it('has no cancel page, no cancel link and no Pro parts in the legal texts', () => {
        expect(LEGAL_PATHS).not.toContain('/kuendigen')
        render(<MemoryRouter><LegalFooter /></MemoryRouter>)
        expect(screen.queryByRole('link', { name: 'Verträge hier kündigen' })).not.toBeInTheDocument()
    })

    it('numbers the terms without the Pro sections', () => {
        render(<Provider store={storeWith({})}><MemoryRouter initialEntries={['/nutzungsbedingungen']}><LegalPage /></MemoryRouter></Provider>)
        expect(screen.queryByText(/Widerrufsbelehrung/)).not.toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: /Quidey Pro/ })).not.toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '8. Änderungen dieser Bedingungen' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '9. Schlussbestimmungen' })).toBeInTheDocument()
    })

    it('numbers the privacy policy without the payment section, and names Google Analytics for the app', () => {
        render(<Provider store={storeWith({})}><MemoryRouter initialEntries={['/datenschutz']}><LegalPage /></MemoryRouter></Provider>)
        expect(screen.queryByText(/Stripe/)).not.toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '7. Kontaktformular, Feedback und E-Mail' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '13. Änderungen' })).toBeInTheDocument()
        expect(screen.getByText(/Google Analytics für Firebase \(nur Android-App\)/)).toBeInTheDocument()
    })

    it('with the build switch on, the footer links the cancel page', () => {
        vi.stubEnv('VITE_PRO', 'on')
        render(<MemoryRouter><LegalFooter /></MemoryRouter>)
        expect(screen.getByRole('link', { name: 'Verträge hier kündigen' })).toHaveAttribute('href', '/kuendigen')
    })
})

describe('the Android app to download (settings)', () => {
    const APK = JSON.stringify({ version: '1.0.0', versionCode: 1, size: 6487118, sha256: 'a'.repeat(64) })
    const android = () => vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/141.0 Mobile Safari/537.36')

    it('is offered only on Android, and only when the build has an APK', () => {
        expect(androidApk()).toBe(null)
        vi.stubEnv('VITE_ANDROID_APK', APK)
        expect(apkOffer()).toBe(null)
        android()
        expect(apkOffer()).toMatchObject({ version: '1.0.0', size: 6487118 })
        expect(formatSize(6487118, 'de')).toBe('6,2 MB')
        expect(placeList({ apk: false }).some((place) => place.to === '/settings#android')).toBe(false)
        expect(placeList({ apk: true }).some((place) => place.to === '/settings#android')).toBe(true)
    })

    it('ignores details it cannot read', () => {
        vi.stubEnv('VITE_ANDROID_APK', '{nope')
        android()
        expect(apkOffer()).toBe(null)
    })

    it('links the file with its version and size under Settings → App', () => {
        vi.stubEnv('VITE_ANDROID_APK', APK)
        android()
        window.matchMedia = vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
        render(<Provider store={storeWith({})}><MemoryRouter><Settings /></MemoryRouter></Provider>)
        fireEvent.click(screen.getByRole('tab', { name: 'App' }))
        const link = screen.getByRole('link', { name: 'Herunterladen' })
        expect(link).toHaveAttribute('href', '/download/quidey.apk')
        expect(link).toHaveAttribute('download', 'Quidey.apk')
        expect(screen.getByText(/Version 1\.0\.0 · 6,2 MB/)).toBeInTheDocument()
    })
})
