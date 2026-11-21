import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { useSlidingActive } from '../features/layout/slidingActive'

function Group({ active }) {
    useSlidingActive()
    return (
        <div data-testid="group">
            {['a', 'b', 'c'].map(id => (
                <button key={id} data-id={id} className={id === active ? 'x_segmentActive_1' : 'x_option_1'}>{id}</button>
            ))}
        </div>
    )
}

// jsdom has no layout: the options are 100px wide side by side
const sizes = () => {
    const index = (el) => Number(el.dataset.id?.charCodeAt(0) - 97) || 0
    vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function () { return index(this) * 100 })
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100)
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(30)
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockReturnValue(0)
}
const frame = () => act(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 20)))))

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('the chosen option slides', () => {
    it('puts the mark behind the chosen option and moves it when another is chosen', async () => {
        sizes()
        const { getByTestId, rerender } = render(<Group active="a" />)
        await frame()
        const group = getByTestId('group')
        expect(group.style.getPropertyValue('--seg-x')).toBe('0px')
        expect(group.style.getPropertyValue('--seg-w')).toBe('100px')
        expect(group.dataset.slide).toBe('on')
        rerender(<Group active="c" />)
        await frame()
        expect(group.style.getPropertyValue('--seg-x')).toBe('200px')
    })

    it('has no mark while the chosen option is not on screen', async () => {
        vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(0)
        const { getByTestId } = render(<Group active="b" />)
        await frame()
        expect(getByTestId('group').dataset.slide).toBeUndefined()
    })
})
