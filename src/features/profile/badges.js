// Badges earned from the statistics of a profile (see GET /api/profile). Nothing is stored:
// they follow from the numbers, so friends see the same ones the owner does. icon: a name in
// the app's outline icon set (components/icons.jsx).
const HOUR = 60 * 60 * 1000;

export const BADGES = [
    { id: 'firstSession', icon: 'sprout', earned: (s) => s.sessions >= 1 },
    { id: 'tenHours', icon: 'timer', earned: (s) => s.totalMs >= 10 * HOUR },
    { id: 'hundredHours', icon: 'peak', earned: (s) => s.totalMs >= 100 * HOUR },
    { id: 'streak7', icon: 'flame', earned: (s) => s.longestStreak >= 7 },
    { id: 'streak30', icon: 'star', earned: (s) => s.longestStreak >= 30 },
    { id: 'marathon', icon: 'route', earned: (s) => s.longestSessionMs >= 2 * HOUR },
    { id: 'tasks50', icon: 'check', earned: (s) => s.tasksDone >= 50 },
    { id: 'teamPlayer', icon: 'together', earned: (s) => s.sharedSessions >= 5 },
    { id: 'earlyBird', icon: 'sun', earned: (s) => s.favoriteTime === 'morning' && s.sessions >= 5 },
    { id: 'nightOwl', icon: 'moon', earned: (s) => s.favoriteTime === 'night' && s.sessions >= 5 },
];

// All badges, each with `earned`
export function badgesFor(stats) {
    return BADGES.map(badge => ({ id: badge.id, icon: badge.icon, earned: Boolean(stats && badge.earned(stats)) }));
}
