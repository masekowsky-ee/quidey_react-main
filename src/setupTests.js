// Adds DOM matchers like toBeInTheDocument() to Vitest's expect.
// The /vitest entry registers them without needing global test functions.
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { MotionGlobalConfig } from 'motion/react'

// No animations in tests: leaving rows and toasts are gone at once
MotionGlobalConfig.skipAnimations = true

// Unmount rendered components between tests so they don't leak into each other
afterEach(() => cleanup())
