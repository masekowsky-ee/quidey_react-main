import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { setLanguage } from '../features/settings/settingsAction'
import TopNav from '../components/variants/TopNav'

describe('the desktop header\'s tabs', () => {
    it('hold Notizen instead of Postfach (the inbox stays an icon beside them)', () => {
        const store = configureStore({ reducer: rootReducer })
        store.dispatch(setLanguage('de'))
        render(<Provider store={store}><MemoryRouter><TopNav inline /></MemoryRouter></Provider>)
        const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' })
        const names = within(nav).getAllByRole('link').map(link => link.textContent)
        expect(names).toEqual(['Start', 'Kalender', 'Fokusraum', 'Lernen', 'Sozial', 'Notizen', 'Statistiken'])
        expect(within(nav).getByRole('link', { name: 'Notizen' })).toHaveAttribute('href', '/notes')
    })
})
