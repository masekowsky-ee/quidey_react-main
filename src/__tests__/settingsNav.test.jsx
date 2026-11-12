import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter } from 'react-router-dom'
import rootReducer from '../features/rootReducer'
import { setLanguage } from '../features/settings/settingsAction'
import Settings from '../components/Settings'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(() => Promise.resolve({})),
}))

function renderSettings(path = '/settings') {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch(setLanguage('en'))
    render(<Provider store={store}><MemoryRouter initialEntries={[path]}><Settings /></MemoryRouter></Provider>)
}

describe('settings: one page with a list of sections', () => {
    beforeEach(() => { Element.prototype.scrollIntoView = vi.fn() })

    it('shows every section at once, with no tabs', () => {
        renderSettings()
        expect(screen.queryByRole('tab')).not.toBeInTheDocument()
        for (const name of ['Language', 'Appearance', 'Event types', 'Notifications']) {
            expect(screen.getAllByRole('heading', { name }).length).toBeGreaterThan(0)
        }
    })

    it('the list names the sections, grouped, and a click scrolls to one', () => {
        renderSettings()
        const nav = screen.getByRole('navigation', { name: 'Settings' })
        const link = within(nav).getByRole('button', { name: 'Event types' })
        fireEvent.click(link)
        expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
        expect(link).toHaveAttribute('aria-current', 'location')
        expect(window.location.hash).toBe('#event-types')
        window.history.replaceState(null, '', '/')
    })

    it('leaves out sections that do not apply on this device', () => {
        renderSettings()
        const nav = screen.getByRole('navigation', { name: 'Settings' })
        expect(within(nav).queryByRole('button', { name: 'Android app' })).not.toBeInTheDocument()
        expect(within(nav).queryByRole('button', { name: 'Alarm clock reminders' })).not.toBeInTheDocument()
    })

    it('an old area name in the address leads to its first section', () => {
        renderSettings('/settings#plan')
        expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
    })
})
