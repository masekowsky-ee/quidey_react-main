import { apiFetch } from '../helperFunction';
import { UI_VARIANT_IDS } from './variants';

// What testers think of what they test: per topic 1-5 stars and/or a comment, saved on the
// server (/api/tester/feedback, only testers and admins) and changed as often as they like.
// Topics: 'ui:<variant>' for the interface variants, 'feature:<id>' for the features below.

// The features in test right now, newest first; the Tester page lists them with a way to try
// each, the admin panel shows what is live for testers (Admin → Tester-Feedback, "Gerade im
// Test"). testerOnly: only testers see it at all (the app hides it from everybody else, the
// server's /api/tester routes are closed to them); otherwise it is out for everybody and testers
// still rate it. since: the day it went to the testers. Add one here when it goes to the testers
// (texts: testerFeature_<id>, _<id>Hint in i18n/testerTexts.js), take it out once it's settled.
// No change on the server needed.
export const TEST_FEATURES = [
    { id: 'avatars', to: '/profile#customize', testerOnly: true, since: '2026-10-28' },
    { id: 'focusroom', to: '/focus', since: '2026-10-28' },
    { id: 'routines', to: '/routines', since: '2026-10-28' },
    { id: 'subgroups', to: '/community/sessions', since: '2026-10-28' },
    { id: 'presence', to: '/community/friends' },
    { id: 'streaks', to: '/' },
    { id: 'progress', to: '/community/progress' },
    { id: 'feed', to: '/community' },
    { id: 'family', to: '/community/family' },
    { id: 'events', to: '/settings#event-types' },
    { id: 'repeats', to: '/calendar' },
];

export const variantTopic = (variant) => `ui:${variant}`;
export const featureTopic = (feature) => `feature:${feature}`;
export const UI_TOPICS = UI_VARIANT_IDS.map(variantTopic);

export const RATING_MAX = 5;
export const COMMENT_MAX = 2000;

// [{ topic, rating, comment, updatedAt }] of mine
export const fetchMyTesterFeedback = () => () => apiFetch('/api/tester/feedback');

// changes: { rating?: 1-5 | null, comment?: string | null }; answers with the saved entry
// (rating and comment null once both are empty: nothing is kept then)
export const saveTesterFeedback = (topic, changes) => () =>
    apiFetch(`/api/tester/feedback/${encodeURIComponent(topic)}`, { method: 'PUT', body: JSON.stringify(changes) });

// admins: { testers, topics: [{ topic, ratings, average, spread: [n1..n5], entries: [...] }] }
export const fetchAllTesterFeedback = () => () => apiFetch('/api/admin/tester-feedback');
