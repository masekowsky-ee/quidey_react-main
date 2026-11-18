import { describe, it, expect } from 'vitest'
import { routeOf } from '../features/native/deepLinks'
import { setPendingText, takePendingText } from '../features/native/sharedText'

describe('routeOf', () => {
    it('turns a link to the app into a path', () => {
        expect(routeOf('https://app.quidey.com/calendar')).toEqual({ path: '/calendar', openForm: false })
        expect(routeOf('https://app.quidey.com/community/friends?tab=add#x')).toEqual({ path: '/community/friends?tab=add#x', openForm: false })
    })

    it('knows the launcher shortcut for a new task', () => {
        expect(routeOf('https://app.quidey.com/?new=task')).toEqual({ path: '/', openForm: true })
    })

    it('ignores links that are not the app', () => {
        expect(routeOf('https://quidey.com/')).toBeNull()
        expect(routeOf('http://app.quidey.com/')).toBeNull()
        expect(routeOf('https://evil.example/app.quidey.com')).toBeNull()
        expect(routeOf('not a link')).toBeNull()
    })
})

describe('shared text', () => {
    it('is handed over once and trimmed to a line the form can take', () => {
        setPendingText('  Buch abgeben bis Freitag  ')
        expect(takePendingText()).toBe('Buch abgeben bis Freitag')
        expect(takePendingText()).toBe('')
        setPendingText('x'.repeat(900))
        expect(takePendingText()).toHaveLength(500)
    })
})
