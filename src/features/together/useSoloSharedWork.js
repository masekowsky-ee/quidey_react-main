import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { startWork, stopWork } from './work';

// While the solo timer runs on a task from a shared session, the team stopwatch runs on it
// too: the time is booked in that session (and the others see me working on it).
// Pausing the timer, switching to an own task or leaving the page stops it again.
// Work I started on the team pages myself is left alone.
export function useSoloSharedWork(activeTask) {
    const dispatch = useDispatch();
    const timerActive = useSelector(state => state.session.timer.active);
    const startedHere = useRef(false);
    const shared = activeTask?.shared;

    useEffect(() => {
        if (timerActive && shared) {
            startedHere.current = true;
            dispatch(startWork(
                { id: shared.sessionId, name: shared.sessionName },
                { id: shared.taskId, name: activeTask.name, myMs: activeTask.myMs ?? 0 },
            ));
        } else if (startedHere.current) {
            startedHere.current = false;
            dispatch(stopWork());
        }
    // the task's name and time change with every poll; only which task and whether the timer runs matter
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timerActive, shared?.sessionId, shared?.taskId, dispatch]);

    // the solo timer only counts while its page is open
    useEffect(() => () => {
        if (startedHere.current) dispatch(stopWork());
    }, [dispatch]);
}
