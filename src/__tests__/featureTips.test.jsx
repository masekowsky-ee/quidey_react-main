import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { LOGIN_SUCCESS, SET_ACCESS } from '../features/auth/authActionTypes'
import { TIPS, BASIC_TIPS, tipsForPage, selectTips, resetTips } from '../features/tips/tips'
import translations from '../i18n/translations'
import FeatureTips from '../components/tips/FeatureTips'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const sized = (el) => {
    if (el) el.getBoundingClientRect = () => ({ top: 100, left: 40, right: 140, bottom: 140, width: 100, height: 40, x: 40, y: 100 })
}

function Page({ withFocus = true }) {
    return <>
        <button type="button" data-part="add-fab" ref={sized}>+</button>
        {withFocus && <section data-part="home-focus" ref={sized}>Fokus</section>}
        <nav aria-label="Tabs">
            <a href="/" data-tip="nav-home" ref={sized}>Start</a>
            <a href="/study" data-tip="nav-study" ref={sized}>Lernen</a>
            {/* no size: not on the screen (another width), its tip waits */}
            <div data-tip="tabbar">Tabs</div>
        </nav>
    </>
}

function open({ path = '/', page = <Page />, seen = [], off = false } = {}) {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 't', username: 'ann' } })
    store.dispatch({ type: SET_ACCESS, payload: { isPro: true, tipsSeen: seen, tipsOff: off } })
    render(<Provider store={store}><MemoryRouter initialEntries={[path]}>{page}<FeatureTips /></MemoryRouter></Provider>)
    return store
}
const calls = (url, method) => apiFetch.mock.calls.filter(([u, o]) => u === url && o?.method === method)

beforeEach(() => {
    apiFetch.mockReset()
    apiFetch.mockImplementation(async (url, options) => {
        if (url === '/api/users/tips/seen') return { tipsSeen: JSON.parse(options.body).ids, tipsOff: false }
        if (url === '/api/users/tips' && options.method === 'PUT') return { tipsSeen: [], tipsOff: true }
        if (url === '/api/users/tips' && options.method === 'DELETE') return { tipsSeen: [], tipsOff: false }
        return {}
    })
})
afterEach(() => { cleanup(); localStorage.clear() })

describe('feature tips: the list', () => {
    it('every tip is there once, has a title and a text in both languages; the basics are tips', () => {
        expect(new Set(TIPS.map(tip => tip.id)).size).toBe(TIPS.length)
        for (const { id } of TIPS) {
            for (const language of ['de', 'en']) {
                expect(translations[language][`tip_${id}_title`], `${language} tip_${id}_title`).toBeTruthy()
                expect(translations[language][`tip_${id}_text`], `${language} tip_${id}_text`).toBeTruthy()
            }
        }
        const ids = TIPS.map(tip => tip.id)
        expect(BASIC_TIPS.every(id => ids.includes(id))).toBe(true)
    })

    it('the navigation first, on any page; then the page\'s own', () => {
        const nav = ['navHome', 'navCalendar', 'navFocus', 'navStudy', 'navCommunity', 'navInbox', 'navStats', 'navMore', 'navMoreSocial', 'tabbar']
        expect(tipsForPage('/').map(tip => tip.id).slice(0, nav.length)).toEqual(nav)
        expect(tipsForPage('/').map(tip => tip.id)).toContain('add')
        expect(tipsForPage('/calendar').map(tip => tip.id)).toContain('calendarDrag')
        expect(tipsForPage('/calendar').map(tip => tip.id)).not.toContain('add')
        expect(tipsForPage('/community/friends').map(tip => tip.id)).toContain('community')
    })
})

describe('feature tips: showing them', () => {
    it('a new account: one at a time at controls on the screen; each seen is sent to the server', async () => {
        const store = open()
        expect(await screen.findByRole('dialog', { name: 'Start' })).toBeTruthy()
        fireEvent.click(screen.getByRole('button', { name: 'Weiter' }))
        expect(await screen.findByRole('dialog', { name: 'Lernen' })).toBeTruthy()
        fireEvent.click(screen.getByRole('button', { name: 'Weiter' }))
        expect(await screen.findByRole('dialog', { name: 'Alles Neue fängt hier an' })).toBeTruthy()
        fireEvent.click(screen.getByRole('button', { name: 'Weiter' }))
        expect(await screen.findByRole('dialog', { name: 'Dein Fokus' })).toBeTruthy()
        // the tab bar isn't on the screen: this is the last one for now
        fireEvent.click(screen.getByRole('button', { name: 'Verstanden' }))
        expect(screen.queryByRole('dialog')).toBeNull()
        expect(selectTips(store.getState()).seen).toEqual(['navHome', 'navStudy', 'add', 'focus'])
        expect(calls('/api/users/tips/seen', 'POST').map(([, o]) => JSON.parse(o.body))).toEqual([
            { ids: ['navHome'] }, { ids: ['navStudy'] }, { ids: ['add'] }, { ids: ['focus'] },
        ])
    })

    it('who saw the old tour (the basics seen) only gets the tips about new features', async () => {
        open({ seen: BASIC_TIPS })
        expect(await screen.findByRole('dialog', { name: 'Lernen' })).toBeTruthy()
        fireEvent.click(screen.getByRole('button', { name: 'Verstanden' }))
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    })

    it('a tip seen while the server could not be reached stays seen after a reload, and is sent then', async () => {
        apiFetch.mockImplementation(async (url) => {
            if (url === '/api/users/tips/seen') throw Object.assign(new Error('Not found'), { status: 404 })
            return {}
        })
        open()
        await screen.findByRole('dialog', { name: 'Start' })
        fireEvent.click(screen.getByRole('button', { name: 'Weiter' }))
        await screen.findByRole('dialog', { name: 'Lernen' })
        cleanup()

        // reloaded: the server still knows nothing, this device does
        apiFetch.mockImplementation(async (url, options) => (url === '/api/users/tips/seen'
            ? { tipsSeen: JSON.parse(options.body).ids, tipsOff: false } : {}))
        const store = open()
        expect(await screen.findByRole('dialog', { name: 'Lernen' })).toBeTruthy()
        expect(screen.queryByRole('dialog', { name: 'Start' })).toBeNull()
        await waitFor(() => expect(calls('/api/users/tips/seen', 'POST').some(([, o]) => JSON.parse(o.body).ids.includes('navHome'))).toBe(true))
        expect(selectTips(store.getState()).seen).toContain('navHome')
    })

    it('nothing before the server has said what was seen', () => {
        const store = configureStore({ reducer: rootReducer })
        store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 't', username: 'ann' } })
        render(<Provider store={store}><MemoryRouter><Page /><FeatureTips /></MemoryRouter></Provider>)
        expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('Tipps ausblenden ends them all; Settings brings them back', async () => {
        const store = open()
        await screen.findByRole('dialog', { name: 'Start' })
        fireEvent.click(screen.getByRole('button', { name: 'Tipps ausblenden' }))
        expect(screen.queryByRole('dialog')).toBeNull()
        expect(selectTips(store.getState()).off).toBe(true)
        expect(JSON.parse(calls('/api/users/tips', 'PUT')[0][1].body)).toEqual({ off: true })

        await store.dispatch(resetTips())
        expect(selectTips(store.getState())).toMatchObject({ seen: [], off: false })
        expect(await screen.findByRole('dialog', { name: 'Start' })).toBeTruthy()
    })

    it('while a sheet covers the page, only a control on the sheet gets its tip', async () => {
        open({
            seen: ['navHome', 'navStudy'],
            page: <><Page /><div role="dialog" aria-modal="true" aria-label="Neue Aufgabe">
                <button type="button" data-tip="color-add" ref={sized}>+</button>
            </div></>,
        })
        expect(await screen.findByRole('dialog', { name: 'Eigene Farben' })).toBeTruthy()
        expect(screen.queryByRole('dialog', { name: 'Alles Neue fängt hier an' })).toBeNull()
    })
})
