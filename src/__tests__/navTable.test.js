import { describe, it, expect } from 'vitest'
import { NAV, paths, TAB_IDS, tabIds, FAB_IDS, GO_IDS } from '../features/app/navTable'
import { ROUTES } from '../features/app/routeTable'
import { COMMUNITY_PATHS } from '../features/community/paths'

const routePaths = ROUTES.map((route) => route.path)
const known = (path) => routePaths.includes(path) || path === COMMUNITY_PATHS.feed || routePaths.includes('/community/:tab')

describe('nav table', () => {
    it('every destination is a route of the app', () => {
        for (const [id, entry] of Object.entries(NAV)) {
            expect(known(entry.path), id).toBe(true)
            expect(paths[id]).toBe(entry.path)
        }
        for (const path of ['/', '/calendar', '/focus', '/study', '/notes', '/stats']) expect(routePaths).toContain(path)
    })

    it('every surface list only holds table ids', () => {
        for (const list of [TAB_IDS, tabIds(true), tabIds(false), FAB_IDS, GO_IDS]) {
            for (const id of list) expect(NAV[id], id).toBeDefined()
        }
    })

    it('the "go to" keys are single and unique', () => {
        const keys = GO_IDS.map((id) => NAV[id].go.key)
        expect(new Set(keys).size).toBe(keys.length)
    })
})
