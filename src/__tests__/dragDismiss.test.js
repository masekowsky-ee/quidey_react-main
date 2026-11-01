import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { project, rubberband, shouldDismiss, useSheet, velocityOf } from '../features/layout/dragDismiss'
import { spring } from '../features/settings/motion'

describe('sheet and drawer gestures', () => {
    it('projects a flick forward like scrolling slows down', () => {
        expect(project(0)).toBe(0)
        // 1000 px/s carries on for about half a metre of screen: 499 px
        expect(project(1000)).toBeCloseTo(499, 0)
        expect(project(-1000)).toBeCloseTo(-499, 0)
        // a snappier deceleration carries less far
        expect(project(1000, 0.99)).toBeLessThan(project(1000))
    })

    it('resists more the further it is pulled past the edge, and never reaches the edge', () => {
        const small = rubberband(20, 600)
        const big = rubberband(400, 600)
        expect(small).toBeGreaterThan(0)
        expect(small).toBeLessThan(20)
        expect(big / 400).toBeLessThan(small / 20)
        expect(rubberband(100000, 600)).toBeLessThan(600)
        expect(rubberband(-50, 600)).toBe(-rubberband(50, 600))
    })

    it('measures the speed over the last moment only', () => {
        expect(velocityOf([])).toBe(0)
        expect(velocityOf([{ at: 0, t: 0 }])).toBe(0)
        // 50 px in 50 ms
        expect(velocityOf([{ at: 0, t: 0 }, { at: 25, t: 25 }, { at: 50, t: 50 }])).toBeCloseTo(1000)
        // an old sample from before the finger stopped doesn't count
        expect(velocityOf([{ at: 0, t: 0 }, { at: 200, t: 300 }, { at: 200, t: 390 }])).toBe(0)
    })

    it('dismisses past half the panel, or on a flick from anywhere', () => {
        expect(shouldDismiss(100, 0, 600)).toBe(false)
        expect(shouldDismiss(320, 0, 600)).toBe(true)
        // a short pull, thrown down
        expect(shouldDismiss(60, 800, 600)).toBe(true)
        // pulled far but thrown back up: it stays
        expect(shouldDismiss(320, -400, 600)).toBe(false)
    })
})

describe('putting a sheet away', () => {
    it('closes at once when there is nothing laid out to animate, and can close another way', () => {
        const onClose = vi.fn()
        const { result } = renderHook(() => useSheet(onClose))
        expect(result.current.backdrop).toHaveProperty('data-sheet-backdrop')
        expect(result.current.panel).toHaveProperty('data-sheet')
        result.current.dismiss()
        expect(onClose).toHaveBeenCalledTimes(1)
        const instead = vi.fn()
        result.current.dismiss(instead)
        expect(instead).toHaveBeenCalledTimes(1)
        expect(onClose).toHaveBeenCalledTimes(1)
    })
})

describe('springs in Apple\'s terms', () => {
    it('turns response and damping ratio into stiffness and damping', () => {
        const settle = spring(0.4, 1)
        expect(settle.type).toBe('spring')
        expect(settle.mass).toBe(1)
        expect(settle.stiffness).toBeCloseTo((2 * Math.PI / 0.4) ** 2)
        // critically damped: damping = 2 * sqrt(stiffness * mass)
        expect(settle.damping).toBeCloseTo(2 * Math.sqrt(settle.stiffness))
        // a lower ratio bounces: less damping for the same stiffness
        expect(spring(0.4, 0.8).damping).toBeLessThan(settle.damping)
        // a quicker response is stiffer
        expect(spring(0.2, 1).stiffness).toBeGreaterThan(settle.stiffness)
    })
})
