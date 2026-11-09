import { useEffect, useRef } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { startWork, stopWork, selectWork } from './work';
import { SHARED_TASK_PREFIX, timeOf } from './togetherAction';
import { selectFocusTask, setFocusTask, catchUpClock, startFocus } from '../session/sessionAction';

// One timer for both: the focus timer is the clock, and a shared session's stopwatch only
// follows it. While the focus timer runs on a session task (and it isn't a Pomodoro break),
// the stopwatch runs on that task, so the others see me on it and the time is booked there;
// anything else stops it. The session page's buttons go through the focus timer
// (workOnSharedTask, pauseFocus), so the two never count different things at once.

const keyOf = (shared) => (shared ? `${shared.sessionId}:${shared.taskId}` : null);

// My time on the session task so far: from my sessions' list, else from the open session page
function myMsOn(state, shared) {
    const listed = selectFocusTask(state);
    if (listed?.myMs !== undefined) return listed.myMs;
    const page = state.together.current;
    const task = page?.id === shared.sessionId ? page.tasks.find(t => t.id === shared.taskId) : null;
    return task?.time ? timeOf(task, page.me) : 0;
}

// Mounted once (App)
export function useLinkedWork() {
    const dispatch = useDispatch();
    const store = useStore();
    // the task as chosen (also when my sessions' list hasn't loaded it)
    const task = useSelector(state => state.session.focusTask);
    const active = useSelector(state => state.session.timer.active);
    const focusing = useSelector(state => state.session.timerMode !== 'pomodoro' || state.session.pomodoro.phase === 'focus');
    const work = useSelector(selectWork);
    const want = active && focusing && task?.shared ? task.shared : null;
    const wantKey = keyOf(want);
    // what this hook started last: a stopwatch that stopped by itself since (the tab was closed,
    // the session ended, the task was removed) isn't started again for the same task
    const started = useRef(null);

    useEffect(() => {
        if (!want) {
            started.current = null;
            if (work.taskId) dispatch(stopWork());
            return;
        }
        const running = work.sessionId === want.sessionId && work.taskId === want.taskId;
        if (running) return;
        if (started.current === wantKey) {
            // stopped by itself: the focus timer runs on; only another stopwatch is ended
            if (work.taskId) dispatch(stopWork());
            return;
        }
        started.current = wantKey;
        dispatch(startWork(
            { id: want.sessionId, name: want.sessionName },
            { id: want.taskId, name: task.name, myMs: myMsOn(store.getState(), want) },
        ));
    // the task's name and time change with every poll; only which task, and what runs, matter
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wantKey, work.sessionId, work.taskId, dispatch, store]);
}

// "Daran arbeiten" on a session task: it becomes the task in focus and the focus timer runs.
// session: { id, name }, task: { id, name }. Time the timer already counted stays on the task
// it was counted for.
export const workOnSharedTask = (session, task) => (dispatch, getState) => {
    dispatch(catchUpClock());
    dispatch(setFocusTask({
        id: `${SHARED_TASK_PREFIX}${task.id}`,
        name: task.name,
        shared: { sessionId: session.id, sessionName: session.name, taskId: task.id },
    }));
    if (!getState().session.timer.active) dispatch(startFocus());
};

// A session task in focus is ticked off or removed (taskId), or I left the session (no taskId):
// the focus timer lets go of it and runs on without a task
export const dropSharedFocus = (sessionId, taskId) => (dispatch, getState) => {
    const shared = getState().session.focusTask?.shared;
    if (!shared || shared.sessionId !== sessionId) return;
    if (taskId !== undefined && shared.taskId !== taskId) return;
    dispatch(catchUpClock());
    dispatch(setFocusTask(null));
};
