import { render } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { makeStore } from './store'

// Renders ui inside the store and a router; returns the usual render result plus the store
export function renderWithStore(ui, { store = makeStore(), route = '/' } = {}) {
    const result = render(
        <Provider store={store}><MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter></Provider>,
    )
    return { ...result, store }
}
