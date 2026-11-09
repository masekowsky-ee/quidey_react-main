import { describe, it, expect, vi } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { TAB_PATHS, tabIndexOf } from '../features/layout/tabSwipe'
import { keyboardInset } from '../features/layout/keyboardInset'
import { openMenu, setShowMenu } from '../features/settings/settingsAction'

describe('swiping between the tabs (phones)', () => {
    it('knows each tab in the tab bar order, sub pages included, and nothing else', () => {
        expect(TAB_PATHS).toEqual(['/', '/calendar', '/focus', '/community'])
        expect(tabIndexOf('/')).toBe(0)
        expect(tabIndexOf('/calendar')).toBe(1)
        expect(tabIndexOf('/focus')).toBe(2)
        expect(tabIndexOf('/community/friends')).toBe(3)
        expect(tabIndexOf('/u/anna')).toBe(3)
        expect(tabIndexOf('/settings')).toBe(-1)
        expect(tabIndexOf('/calendarx')).toBe(-1)
    })
})

describe('the drawer from either side', () => {
    it('opens from the left as always, and from the right only when asked, taking the side first', () => {
        vi.stubGlobal('requestAnimationFrame', (fn) => { fn(); return 0 })
        const store = configureStore({ reducer: rootReducer })
        expect(store.getState().settings.menuSide).toBe('left')

        store.dispatch(openMenu('right'))
        expect(store.getState().settings).toMatchObject({ showMenu: true, menuSide: 'right' })

        store.dispatch(setShowMenu(false))
        expect(store.getState().settings.menuSide).toBe('right')
        store.dispatch(openMenu())
        expect(store.getState().settings).toMatchObject({ showMenu: true, menuSide: 'left' })
        vi.unstubAllGlobals()
    })
})

describe('the on-screen keyboard', () => {
    const win = (innerHeight, height, offsetTop = 0) => ({ innerHeight, visualViewport: { height, offsetTop } })

    it('is the part of the window the visible area no longer reaches', () => {
        expect(keyboardInset(win(800, 460))).toBe(340)
        // iOS scrolled the visible area down a little to show the field
        expect(keyboardInset(win(800, 460, 40))).toBe(300)
    })

    it('is nothing without one: no keyboard, a browser bar, no visualViewport', () => {
        expect(keyboardInset(win(800, 800))).toBe(0)
        expect(keyboardInset(win(800, 744))).toBe(0)
        expect(keyboardInset({ innerHeight: 800 })).toBe(0)
    })
})
