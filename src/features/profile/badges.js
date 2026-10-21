// Badges earned from the statistics of a profile (see GET /api/profile). Nothing is stored:
// they follow from the numbers, so friends see the same ones the owner does.
const HOUR = 60 * 60 * 1000;

export const BADGES = [
    { id: 'firstSession', icon: '🌱', earned: (s) => s.sessions >= 1 },
    { id: 'tenHours', icon: '⏱️', earned: (s) => s.totalMs >= 10 * HOUR },
    { id: 'hundredHours', icon: '🏔️', earned: (s) => s.totalMs >= 100 * HOUR },
    { id: 'streak7', icon: '🔥', earned: (s) => s.longestStreak >= 7 },
    { id: 'streak30', icon: '☄️', earned: (s) => s.longestStreak >= 30 },
    { id: 'marathon', icon: '🏃', earned: (s) => s.longestSessionMs >= 2 * HOUR },
    { id: 'tasks50', icon: '✅', earned: (s) => s.tasksDone >= 50 },
    { id: 'teamPlayer', icon: '🤝', earned: (s) => s.sharedSessions >= 5 },
    { id: 'earlyBird', icon: '🐦', earned: (s) => s.favoriteTime === 'morning' && s.sessions >= 5 },
    { id: 'nightOwl', icon: '🦉', earned: (s) => s.favoriteTime === 'night' && s.sessions >= 5 },
];

// All badges, each with `earned`
export function badgesFor(stats) {
    return BADGES.map(badge => ({ id: badge.id, icon: badge.icon, earned: Boolean(stats && badge.earned(stats)) }));
}
