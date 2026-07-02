import React, {useState, useEffect, useRef} from 'react'
import styles from './TimerContainer.module.css'

export default function TimerContainer(props){
    const { sessionParams, setSessionParams, timer, setTimer } = props;
    
    let mins;
    let hours;
    let secs;

    console.log(timer);

    const [timeToDisplay, setTimeToDisplay] = useState();
    const [percentWidth, setPercentWidth] = useState(0);

    const [editTimer, setEditTimer] = useState(false);
    const getEditTime = () => {
        const h = document.getElementById('timerH').value;
        const m = document.getElementById('timerM').value;
        const s = document.getElementById('timerS').value;

        return (h*3600*1000 + m*60*1000 + s*1000);
    }

    const timeoutRef = useRef(null);

    useEffect(()=>{
        hours = Math.floor(timer.time / 3600000);
        mins = Math.floor((timer.time - hours * 3600000) / 60000);
        secs = Math.floor((timer.time - hours * 3600000 - mins * 60000) / 1000);
        setTimeToDisplay(`${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);

        if (timer.active && timer.time >= 1000) {
            timeoutRef.current = setTimeout(() => {
                setTimer((prev) => ({ ...prev, time: prev.time - 1000 }));
            }, 1000);
        }
        setPercentWidth((sessionParams.time - timer.time) / sessionParams.time * 100);

        //cleanup räumt effect auf BEVOR nochmal durchläuft
        return () => clearTimeout(timeoutRef.current);
    },[timer]);

    const timerAction = (action) => {
        if (action === 'start'){
            setTimer((prev)=>({ ...prev, active: true}));
            if(editTimer){
                setSessionParams((prev)=>({
                    ...prev, time: getEditTime() 
                }));
                setTimer((prev)=>({...prev, time: getEditTime()}));
            }
            setEditTimer(false);
        } else if (action === 'pause'){
            setTimer((prev)=>({ ...prev, active: false}));
        } else if (action === 'terminate'){
            clearTimeout(timeoutRef.current);
            setTimer({ time: 0, active: false });
        }
    }

    return(
        <div className={styles.div}>
            {!editTimer ? 
                <h2 className={styles.timerH2}>{timeToDisplay}</h2>
                :
                <div className={styles.editTimerDiv}>
                    <input id="timerH" className={styles.input} type="number" placeholder="00" min="0" max="3" />
                    <p className={styles.timerH2}>:</p>
                    <input id="timerM" className={styles.input} type="number" placeholder="00" min="0" max="59" />
                    <p className={styles.timerH2}>:</p>
                    <input id="timerS" className={styles.input} type="number" placeholder="00" min="0" max="59" />
                </div>
            }
            <div className={styles.outerTimer}>
                <div style={{width: `${percentWidth}%`}} className={styles.innerTimer}></div>
            </div>
            <div className={styles.timerNav}>
                {!timer.active && timer.time !== 0 &&
                    <button className={styles.btn} onClick={()=>timerAction('start')}>
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M320-273v-414q0-17 12-28.5t28-11.5q5 0 10.5 1.5T381-721l326 207q9 6 13.5 15t4.5 19q0 10-4.5 19T707-446L381-239q-5 3-10.5 4.5T360-233q-16 0-28-11.5T320-273Zm80-207Zm0 134 210-134-210-134v268Z"/></svg>
                    </button>
                }
                {timer.active && sessionParams.breaks &&
                    <button className={styles.btn} onClick={()=>timerAction('pause')}>
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M600-200q-33 0-56.5-23.5T520-280v-400q0-33 23.5-56.5T600-760h80q33 0 56.5 23.5T760-680v400q0 33-23.5 56.5T680-200h-80Zm-320 0q-33 0-56.5-23.5T200-280v-400q0-33 23.5-56.5T280-760h80q33 0 56.5 23.5T440-680v400q0 33-23.5 56.5T360-200h-80Zm320-80h80v-400h-80v400Zm-320 0h80v-400h-80v400Zm0-400v400-400Zm320 0v400-400Z"/></svg>
                    </button>
                }
                {timer.active &&
                    <button className={styles.btn} onClick={()=>timerAction('terminate')}>
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M240-320v-320q0-33 23.5-56.5T320-720h320q33 0 56.5 23.5T720-640v320q0 33-23.5 56.5T640-240H320q-33 0-56.5-23.5T240-320Zm80 0h320v-320H320v320Zm160-160Z"/></svg>
                    </button>
                }
                {!timer.active && timer.time === 0 &&
                    <button className={styles.btn} onClick={()=>{setEditTimer(!editTimer); setTimer((prev)=>({...prev, time: 10000}))}}>
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M400-840q-17 0-28.5-11.5T360-880q0-17 11.5-28.5T400-920h160q17 0 28.5 11.5T600-880q0 17-11.5 28.5T560-840H400Zm108.5 428.5Q520-423 520-440v-160q0-17-11.5-28.5T480-640q-17 0-28.5 11.5T440-600v160q0 17 11.5 28.5T480-400q17 0 28.5-11.5Zm-168 303Q275-137 226-186t-77.5-114.5Q120-366 120-440t28.5-139.5Q177-645 226-694t114.5-77.5Q406-800 480-800q62 0 119 20t107 58l28-28q11-11 28-11t28 11q11 11 11 28t-11 28l-28 28q38 50 58 107t20 119q0 74-28.5 139.5T734-186q-49 49-114.5 77.5T480-80q-74 0-139.5-28.5ZM678-242q82-82 82-198t-82-198q-82-82-198-82t-198 82q-82 82-82 198t82 198q82 82 198 82t198-82ZM480-440Z"/></svg>
                    </button>
                }
            </div>
        </div>
    );
}