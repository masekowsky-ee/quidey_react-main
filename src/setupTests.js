// Adds DOM matchers like toBeInTheDocument() to Vitest's expect.
// The /vitest entry registers them without needing global test functions.
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { MotionGlobalConfig } from 'motion/react'

// The app takes the device's language until one is picked; tests run on a German "device"
// (jsdom says en-US), so the app speaks German in them unless a test sets English
Object.defineProperty(window.navigator, 'language', { value: 'de-DE', configurable: true })
Object.defineProperty(window.navigator, 'languages', { value: ['de-DE', 'de'], configurable: true })

// No animations in tests: leaving rows and toasts are gone at once
MotionGlobalConfig.skipAnimations = true

// jsdom has no IntersectionObserver (motion's whileInView needs one): nothing is ever "in view"
if (typeof globalThis.IntersectionObserver === 'undefined') {
    globalThis.IntersectionObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() { return [] }
    }
}

// Unmount rendered components between tests so they don't leak into each other
afterEach(() => cleanup())
