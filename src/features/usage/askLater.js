// The usage-statistics question was closed without an answer: not asked again until the next start
// (module-level, like analytics.js).
let later = false;

export const usageAskedLater = () => later;
export const askUsageLater = () => { later = true; };
export const resetUsageAskLater = () => { later = false; };
