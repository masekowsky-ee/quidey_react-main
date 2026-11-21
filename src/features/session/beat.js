// A beat twice a second for the focus timer in the tab's title (focusTitle.js) and for the "away"
// check while the page is hidden (focus/useFocusAway.js). A worker keeps its pace in a background
// tab, where the page's own timers are slowed to once a minute after a while; where there is no
// worker the page's own timer does it.
const BEAT_MS = 500; // twice a second: titleTick.worker.js beats at the same rate

export function startBeat(onBeat) {
    if (typeof Worker !== 'undefined') {
        try {
            const worker = new Worker(new URL('./titleTick.worker.js', import.meta.url), { type: 'module' });
            worker.onmessage = onBeat;
            return () => worker.terminate();
        } catch { /* no worker here: the page's own timer below */ }
    }
    const interval = setInterval(onBeat, BEAT_MS);
    return () => clearInterval(interval);
}
