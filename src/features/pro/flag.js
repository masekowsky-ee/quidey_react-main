// Quidey Pro (the subscription, features/pro/pro.js) is built and ready, but switched off until it
// is turned on by hand. Two switches, turned on together:
//   VITE_PRO=on     at build time (.env.production.local, the Android repo's .env.android): the app
//                   shows the page /pro, the menu entry, the cards on the profile and the beta screen,
//                   and the legal texts get their parts on Pro (terms § 8–9, privacy § 7, /kuendigen).
//   PRO_BILLING=on  on the server: the billing routes answer and /api/me says proSales: true.
// The app shows Pro only when both are on (useProOn); the legal texts follow the build alone, so they
// are in place from the first sale. Off (the default), nothing about Pro or prices is shown anywhere.
import { useSelector } from 'react-redux';

export const proBuilt = () => import.meta.env.VITE_PRO === 'on';

export function useProOn() {
    const sales = useSelector((state) => state.auth.access.proSales);
    return proBuilt() && Boolean(sales);
}
