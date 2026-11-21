import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Home from '../../components/Home.jsx'
import BetaGate from '../../components/BetaGate.jsx'
import TesterOnly from '../../components/TesterOnly.jsx'
import GuestEntry from '../../components/guest/GuestEntry.jsx'
import GuestLocked from '../../components/guest/GuestLocked.jsx'
import { PAGES } from './pages.js'
import { ROUTES, REDIRECTS, ENTRY_ROUTES } from './routeTable.js'

// every page of the table, lazy (Home and the beta screen are part of the first load)
const COMPONENTS = {
  Home,
  BetaGate,
  ...Object.fromEntries(Object.entries(PAGES).map(([name, { load }]) => [name, lazy(load)])),
}
export const LegalPage = () => <COMPONENTS.LegalPage />
export const VerifyEmail = () => <COMPONENTS.VerifyEmail />

const toStart = <Navigate to="/" replace />

// the conditions on top of being signed in: each gets the page's element and answers what to show
const GUARDS = {
  admin: ({ access }, page) => (access.isAdmin ? page : toStart),
  // testers: interface variants and the features in test, with their ratings
  tester: (ctx, page) => <TesterOnly fallback={toStart}>{page}</TesterOnly>,
  // Quidey Pro: supporting the development
  pro: ({ proOn }, page) => (proOn ? page : toStart),
  // the beta screen stays reachable on the trial version: the way to apply
  beta: ({ access }, page) => (access.trial ? page : toStart),
}

const redirects = (search) =>
  REDIRECTS.map(({ from, to, search: keep }) => (
    <Route key={from} path={from} element={<Navigate to={keep ? { pathname: to, search } : to} replace />} />
  ))

// signed out: the start page, calendar and Fokusraum to look at, the rest asks for an account
export function GuestRoutes({ location }) {
  return (
    <Routes location={location}>
      {ROUTES.filter((route) => route.guest).map(({ path, page }) => {
        const Page = COMPONENTS[page]
        return <Route key={path} path={path} element={<Page />} />
      })}
      {ENTRY_ROUTES.map(({ path, mode, googleReturn }) => (
        <Route key={path} path={path}
          element={googleReturn ? <GuestEntry mode={mode} googleReturn><Home /></GuestEntry> : <GuestEntry mode={mode} />} />
      ))}
      <Route path="*" element={<GuestLocked />} />
    </Routes>
  )
}

// signed in with access: the whole app
export function AppRoutes({ location, access, proOn, homeLayout }) {
  const ctx = { access, proOn }
  return (
    <Routes location={location}>
      {ROUTES.map(({ path, page, guard }) => {
        const Page = path === '/' && homeLayout === 'team' ? COMPONENTS.TeamHome : COMPONENTS[page]
        const element = <Page />
        return <Route key={path} path={path} element={guard ? GUARDS[guard](ctx, element) : element} />
      })}
      {redirects(location.search)}
      {ENTRY_ROUTES.map(({ path }) => <Route key={path} path={path} element={toStart} />)}
    </Routes>
  )
}

// signed in without access: the beta screen and its waiting room
export function WaitingRoutes({ proOn, pageLoading }) {
  const ArcadePage = COMPONENTS.ArcadePage
  const ProPage = COMPONENTS.ProPage
  return (
    <Routes>
      <Route path="/beta" element={<BetaGate />} />
      {/* the waiting room: the arcade, while access is still to come */}
      <Route path="/arcade" element={<Suspense fallback={pageLoading}><ArcadePage waiting /></Suspense>} />
      {/* Pro gets into the app during the beta too */}
      {proOn && <Route path="/pro" element={<Suspense fallback={pageLoading}><ProPage /></Suspense>} />}
      <Route path="*" element={<Navigate to="/beta" replace />} />
    </Routes>
  )
}
