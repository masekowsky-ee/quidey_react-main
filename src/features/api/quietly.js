// A refresh whose failure nobody needs to hear about (the list stays as it was, the next
// refresh tries again). Naming it keeps the deliberate ones apart from forgotten error handling.
export const quietly = (promise) => promise.catch(() => {});
