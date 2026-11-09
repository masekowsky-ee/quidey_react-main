// A beat twice a second for the focus timer in the tab's title (focusTitle.js). Timers in a
// worker keep their pace in a background tab, where the page's own timers are slowed to once a
// minute after a while: exactly when the title is the thing being looked at.
setInterval(() => postMessage(0), 500);
