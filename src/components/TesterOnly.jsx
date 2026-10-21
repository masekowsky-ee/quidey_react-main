import { useIsTester } from '../features/auth/tester';

// Wraps something that only testers (and admins) see for now:
//   <TesterOnly><NewThing /></TesterOnly>
//   <TesterOnly fallback={<OldThing />}><NewThing /></TesterOnly>
// A whole page in App.jsx (others land on Home):
//   <Route path="/new" element={<TesterOnly fallback={<Navigate to="/" replace />}><New /></TesterOnly>} />
// The data behind it belongs under /api/tester/..., which the server keeps closed to everyone else.
export default function TesterOnly({ children, fallback = null }) {
    return useIsTester() ? children : fallback;
}
