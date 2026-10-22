import {useState, useEffect, useRef} from 'react'
import styles from './TimerContainer.module.css'
import { useSelector, useDispatch } from 'react-redux';
import { setSessionParams, setTimer, selectTimerProgress, setTimerMode } from '../features/session/sessionAction';
import {saveSessionData} from '../features/session/sessionAction'
import { addWorkedTask, addTaskTime } from '../features/session/sessionAction.js'
import { formatClock } from '../features/helperFunction';
import { useTranslation } from '../i18n/useTranslation';
import Icon from './icons.jsx';

// The focus timer. inline: a panel in the page (Home's focus column on wide screens); otherwise
// folded into a round button at the bottom right until it's opened (then a small panel there).
// Two modes: "timer" counts the session length down, "stopwatch" counts up
// from zero until stopped. Either way every running second is booked on the task in focus.

export default function TimerContainer(props){
    const { setWorkedTime, setActiveTimer, activeTask, inline = false } = props;

    const {sessionParams, timer, timerMode} = useSelector(state => state.session);
    const percentWidth = useSelector(selectTimerProgress);
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const stopwatch = timerMode === 'stopwatch';

    // folded away at first; it keeps running while folded
    const [open, setOpen] = useState(false);

    // derived from the timer on every render, so it can never lag a tick behind
    const timeToDisplay = formatClock(timer.time);


    const [editTimer, setEditTimer] = useState(false);
    const getEditTime = () => {
        const h = document.getElementById('timerH').value;
        const m = document.getElementById('timerM').value;
        const s = document.getElementById('timerS').value;

        return (h*3600*1000 + m*60*1000 + s*1000);
    }

    const [newS, setNewS] = useState(null);
    const [newM, setNewM] = useState(null);
    const [newH, setNewH] = useState(null);

    const minSetter = (dirAm) => {
        const min = newM;
        if(dirAm > 0){
            if((min + dirAm) < 60){
                setNewM(min + dirAm);
            } else {
                setNewM(0);
                setNewH(prev => prev + 1);
            }
        } else {
            if (newH === 0 && newM + dirAm < 0) return;
            if((min + dirAm) >= 0){
                setNewM(prev => prev + dirAm);
            } else {
                setNewH(prev => prev - 1);
                setNewM(60 + dirAm);
            }
        }
    }

    const secSetter = (dir) => {
        const sec = newS;
        if(dir > 0){
            if((sec + 15) < 60){
                setNewS(sec + 15);
            } else {
                setNewS(0);
                minSetter(dir);
            }
        } else {
            if (newM === 0 && newH === 0 && newS + dir < 0) return;
            if((sec - 15) >= 0){
                setNewS(sec - 15);
            } else {
                setNewS(45);
                minSetter(dir);
            }
        }
    }

    // Opens the editor pre-filled with the given time
    const editTimerFunc = (ms) => {
        setEditTimer(true);
        setNewH(Math.floor(ms / 3600000));
        setNewM(Math.floor((ms % 3600000) / 60000));
        setNewS(Math.floor((ms % 60000) / 1000));
    }

    const timeoutRef = useRef(null);

    // Read inside the tick instead of being an effect dependency: switching tasks must not
    // restart the running second, or the countdown would drift with every drop
    const activeTaskRef = useRef(activeTask);
    useEffect(() => { activeTaskRef.current = activeTask; }, [activeTask]);

    // Ticks the running timer down (a stopwatch up) once per second and books that second on the
    // active task; display and progress are derived above
    useEffect(() => {
        if (timer.active && (stopwatch || timer.time >= 1000)) {
            timeoutRef.current = setTimeout(() => {
                dispatch(setTimer(timer.time + (stopwatch ? 1000 : -1000), timer.active));
                setWorkedTime(prev => prev + 1);
                if (activeTaskRef.current) dispatch(addTaskTime(activeTaskRef.current, 1));
            }, 1000);
        }

        return () => clearTimeout(timeoutRef.current);
    }, [timer, stopwatch, dispatch, setWorkedTime]);

    // started and not stopped yet (also paused): the mode can't be switched now
    const inProgress = timer.active || (stopwatch ? timer.time > 0 : timer.time > 0 && timer.time !== sessionParams.time);

    const timerAction = (action) => {
        if (action === 'start'){
            if (!stopwatch && timer.time <= 1000) return;
            if (editTimer){
                const newTime = getEditTime();
                dispatch(setSessionParams({...sessionParams, time: newTime}));
                dispatch(setTimer(newTime, true));
            } else {
                dispatch(setTimer(timer.time, true));
            }
            setEditTimer(false);
            setActiveTimer(true);
            if (!activeTask) return;
            dispatch(addWorkedTask(activeTask))
        } else if (action === 'pause'){
            dispatch(setTimer(timer.time, false));
        } else if (action === 'terminate'){
            clearTimeout(timeoutRef.current);
            dispatch(setTimer(0, false));
            setActiveTimer(false);

            dispatch(saveSessionData()).catch(err => console.error("Saving session failed:", err));
        }
    }

    const setTimerFunc = () => {
        const newTime = (Number(newS) * 1000 + Number(newM) * 60 * 1000 + Number(newH) * 60 * 60 * 1000);
        // the new time is also the new session length, otherwise the progress bar
        // is measured against the old length (and stays empty if the new one is longer)
        dispatch(setSessionParams({...sessionParams, time: newTime}));
        setEditTimer(false);
    }

    if (!open && !inline) {
        // folded: just the icon, with the time next to it while a session is on
        return (
            <button className={`${styles.fab} ${inProgress ? styles.fabBusy : ''}`} onClick={() => setOpen(true)}
                aria-label={inProgress ? `${t('openTimer')}, ${timeToDisplay}` : t('openTimer')} title={t('openTimer')}>
                <Icon name="timer" className={styles.fabIcon} />
                {inProgress && <span className={styles.fabTime}>{timeToDisplay}</span>}
                {timer.active && <span className={styles.fabDot} aria-hidden="true" />}
            </button>
        );
    }

    return(
        <div className={inline ? styles.inlinePanel : styles.panel}>
            <div className={styles.panelHead}>
                <div className={styles.modeSwitch} role="group" aria-label={t('timerMode')}>
                    {['timer', 'stopwatch'].map(mode =>
                        <button key={mode} type="button" aria-pressed={timerMode === mode} disabled={inProgress && timerMode !== mode}
                            className={timerMode === mode ? styles.modeOn : styles.mode}
                            onClick={() => { if (timerMode !== mode) { setEditTimer(false); dispatch(setTimerMode(mode)); } }}>
                            {t(mode === 'timer' ? 'timerModeTimer' : 'timerModeStopwatch')}
                        </button>)}
                </div>
                {!inline &&
                <button className={styles.foldBtn} onClick={() => setOpen(false)} title={t('collapseTimer')} aria-label={t('collapseTimer')}>
                    <Icon name="chevronDown" className={styles.foldIcon} />
                </button>}
            </div>
            <div className={styles.div}>
                {!editTimer ? 
                    <h2 onClick={stopwatch ? undefined : ()=>{editTimerFunc(timer.time); timerAction('pause')}} className={stopwatch ? styles.stopwatchH2 : styles.timerH2}>{timeToDisplay}</h2>
                    :
                        <div className={styles.editTimerDiv}>
                            <div>
                            <svg className={styles.timerArrow} onClick={()=>setNewH(prev => prev + 1)} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M328-400q-9 0-14.5-6t-5.5-14q0-2 6-14l145-145q5-5 10-7t11-2q6 0 11 2t10 7l145 145q3 3 4.5 6.5t1.5 7.5q0 8-5.5 14t-14.5 6H328Z"/></svg>
                            <h2 className={styles.setTimerH2} id="timerH">{`${String(newH).padStart(2, '0')}`}</h2>
                            <svg className={styles.timerArrow} onClick={()=>{if (newH === 0) return;setNewH(prev => prev - 1)}} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M459-381 314-526q-3-3-4.5-6.5T308-540q0-8 5.5-14t14.5-6h304q9 0 14.5 6t5.5 14q0 2-6 14L501-381q-5 5-10 7t-11 2q-6 0-11-2t-10-7Z"/></svg>
                            </div>

                            <h2 className={styles.timerH2}>:</h2>

                            <div>
                            <svg className={styles.timerArrow} onClick={()=>minSetter(5)} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M328-400q-9 0-14.5-6t-5.5-14q0-2 6-14l145-145q5-5 10-7t11-2q6 0 11 2t10 7l145 145q3 3 4.5 6.5t1.5 7.5q0 8-5.5 14t-14.5 6H328Z"/></svg>
                            <h2 className={styles.setTimerH2} id="timerM">{`${String(newM).padStart(2, '0')}`}</h2>
                            <svg className={styles.timerArrow} onClick={()=>minSetter(-5)} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M459-381 314-526q-3-3-4.5-6.5T308-540q0-8 5.5-14t14.5-6h304q9 0 14.5 6t5.5 14q0 2-6 14L501-381q-5 5-10 7t-11 2q-6 0-11-2t-10-7Z"/></svg>
                            </div>

                            <h2 className={styles.timerH2}>:</h2>

                            <div>
                            <svg className={styles.timerArrow} onClick={()=>secSetter(1)} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M328-400q-9 0-14.5-6t-5.5-14q0-2 6-14l145-145q5-5 10-7t11-2q6 0 11 2t10 7l145 145q3 3 4.5 6.5t1.5 7.5q0 8-5.5 14t-14.5 6H328Z"/></svg>
                            <h2 className={styles.setTimerH2} id="timerS">{`${String(newS).padStart(2, '0')}`}</h2>
                            <svg className={styles.timerArrow} onClick={()=>secSetter(-1)} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M459-381 314-526q-3-3-4.5-6.5T308-540q0-8 5.5-14t14.5-6h304q9 0 14.5 6t5.5 14q0 2-6 14L501-381q-5 5-10 7t-11 2q-6 0-11-2t-10-7Z"/></svg>
                            </div>
                        </div>
                }
                {stopwatch
                    ? <div className={styles.progress} aria-hidden="true"><div className={`${styles.stopwatchLine} ${timer.active ? styles.stopwatchLive : ''}`} /></div>
                    : <div className={styles.progress}>
                        <div style={{width: `${percentWidth}%`}} className={styles.progressFill}></div>
                    </div>}
                <div className={styles.timerNav}>
                    {!timer.active && (stopwatch || timer.time !== 0) && !editTimer &&
                        <button className={styles.btnGo} onClick={()=>timerAction('start')} aria-label="start timer">
                            <Icon name="play" className={styles.ctrlIcon} strokeWidth={2} />
                        </button>
                    }
                    {timer.active &&
                        <button className={styles.btn} onClick={()=>timerAction('pause')} aria-label="pause timer">
                            <Icon name="pause" className={styles.ctrlIcon} strokeWidth={2.2} />
                        </button>
                    }
                    {(timer.active || (stopwatch && timer.time > 0)) &&
                        <button className={styles.btnStop} onClick={()=>timerAction('terminate')} aria-label="stop timer">
                            <Icon name="stop" className={styles.ctrlIcon} strokeWidth={2} />
                        </button>
                    }
                    {!stopwatch && !timer.active && timer.time === 0 && !editTimer &&
                        <button className={styles.btn} onClick={()=>editTimerFunc(sessionParams.time)} aria-label="set timer">
                            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M400-840q-17 0-28.5-11.5T360-880q0-17 11.5-28.5T400-920h160q17 0 28.5 11.5T600-880q0 17-11.5 28.5T560-840H400Zm108.5 428.5Q520-423 520-440v-160q0-17-11.5-28.5T480-640q-17 0-28.5 11.5T440-600v160q0 17 11.5 28.5T480-400q17 0 28.5-11.5Zm-168 303Q275-137 226-186t-77.5-114.5Q120-366 120-440t28.5-139.5Q177-645 226-694t114.5-77.5Q406-800 480-800q62 0 119 20t107 58l28-28q11-11 28-11t28 11q11 11 11 28t-11 28l-28 28q38 50 58 107t20 119q0 74-28.5 139.5T734-186q-49 49-114.5 77.5T480-80q-74 0-139.5-28.5ZM678-242q82-82 82-198t-82-198q-82-82-198-82t-198 82q-82 82-82 198t82 198q82 82 198 82t198-82ZM480-440Z"/></svg>
                        </button>
                    }
                    {editTimer &&
                        <button className={styles.btnGo} onClick={setTimerFunc} aria-label="confirm time">
                            <Icon name="check" className={styles.ctrlIcon} strokeWidth={2.2} />
                        </button>
                    }
                </div>
            </div>
        </div>
    );
}