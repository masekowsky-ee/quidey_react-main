import {useState, useEffect, useRef} from 'react'
import styles from './TimerContainer.module.css'
import { useSelector, useDispatch } from 'react-redux';
import { setSessionParams, setTimer } from '../features/session/sessionAction';

export default function TimerContainer(props){
    const { setWorkedTime, percentWidth, setPercentWidth, setActiveTimer } = props;

    const {sessionParams, timer} = useSelector(state => state.session);
    const dispatch = useDispatch();

    console.log(timer);

    const [timeToDisplay, setTimeToDisplay] = useState(null);
    

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
            if(min + dirAm < 60){
                setNewM(min + dirAm);
            } else {
                setNewM(0);
                setNewH(prev => prev + 1);
            }
        } else {
            if(min - dirAm >= 0){
                setNewM(min - dirAm);
            } else {
                setNewH(prev => prev - 1);
                setNewM(60 - dirAm);
            }
        }
    }

    const secSetter = (dir) => {
        const sec = newS;
        if(dir > 0){
            if(sec + 15 < 60){
                setNewS(sec + 15);
            } else {
                setNewS(0);
                minSetter(1)
            }
        } else {
            if(sec - 15 >= 0){
                setNewS(sec - 15);
            } else {
                setNewS(45);
                minSetter(-1)
            }
        }
    }

    const editTimerFunc = () => {
        setEditTimer(true);
        setNewS(Number(timeToDisplay.slice(6,8)));
        setNewM(Number(timeToDisplay.slice(3,5)));
        setNewH(Number(timeToDisplay.slice(0,2)));
    }

    const timeoutRef = useRef(null);

    useEffect(() => {
        // lokale Werte statt State im selben Tick verwenden
        const h = Math.floor(timer.time / 3600000);
        const m = Math.floor((timer.time - h * 3600000) / 60000);
        const s = Math.floor((timer.time - h * 3600000 - m * 60000) / 1000);
        console.log(timer);
        setTimeToDisplay(
            `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        );

        if (timer.active && timer.time >= 1000) {
            timeoutRef.current = setTimeout(() => {
                dispatch(setTimer(timer.time - 1000, timer.active));
                setWorkedTime(prev => prev + 1);
            }, 1000);
        }

        setPercentWidth(sessionParams.time ? ((sessionParams.time - timer.time) / sessionParams.time * 100) : 0);

        return () => clearTimeout(timeoutRef.current);
    }, [timer]); // hours/mins/secs raus aus den Deps — sie werden hier berechnet, nicht gelesen

    const timerAction = (action) => {
        if (action === 'start'){
            if (editTimer){
                const newTime = getEditTime();
                dispatch(setSessionParams({...sessionParams, time: newTime}));
                dispatch(setTimer(newTime, true));
            } else {
                dispatch(setTimer(timer.time, true));
            }
            setEditTimer(false);
            setActiveTimer(true);
        } else if (action === 'pause'){
            dispatch(setTimer(timer.time, false));
        } else if (action === 'terminate'){
            clearTimeout(timeoutRef.current);
            dispatch(setTimer(0, false));
            setActiveTimer(false);
        }
    }

    return(
        <div className={styles.div}>
            {!editTimer ? 
                <h2 onClick={()=>{editTimerFunc(); timerAction('pause')}} className={styles.timerH2}>{timeToDisplay}</h2>
                :
                <div className={styles.editTimerDiv}>
                    <div style={{flexDirection: 'column'}}>
                    <svg onClick={()=>setNewH(prev => prev + 1)} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M328-400q-9 0-14.5-6t-5.5-14q0-2 6-14l145-145q5-5 10-7t11-2q6 0 11 2t10 7l145 145q3 3 4.5 6.5t1.5 7.5q0 8-5.5 14t-14.5 6H328Z"/></svg>
                    <h2 id="timerH">{newH || timeToDisplay.slice(0,2)}</h2>
                    <svg onClick={()=>setNewH(prev => prev - 1)} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M459-381 314-526q-3-3-4.5-6.5T308-540q0-8 5.5-14t14.5-6h304q9 0 14.5 6t5.5 14q0 2-6 14L501-381q-5 5-10 7t-11 2q-6 0-11-2t-10-7Z"/></svg>
                    </div>

                    <h2 className={styles.timerH2}>:</h2>

                    <div style={{flexDirection: 'column'}}>
                    <svg onClick={()=>minSetter(5)} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M328-400q-9 0-14.5-6t-5.5-14q0-2 6-14l145-145q5-5 10-7t11-2q6 0 11 2t10 7l145 145q3 3 4.5 6.5t1.5 7.5q0 8-5.5 14t-14.5 6H328Z"/></svg>
                    <h2 id="timerM">{newM || timeToDisplay.slice(3,5)}</h2>
                    <svg onClick={()=>minSetter(-5)} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M459-381 314-526q-3-3-4.5-6.5T308-540q0-8 5.5-14t14.5-6h304q9 0 14.5 6t5.5 14q0 2-6 14L501-381q-5 5-10 7t-11 2q-6 0-11-2t-10-7Z"/></svg>
                    </div>

                    <h2 className={styles.timerH2}>:</h2>

                    <div style={{flexDirection: 'column'}}>
                    <svg onClick={()=>secSetter(1)} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M328-400q-9 0-14.5-6t-5.5-14q0-2 6-14l145-145q5-5 10-7t11-2q6 0 11 2t10 7l145 145q3 3 4.5 6.5t1.5 7.5q0 8-5.5 14t-14.5 6H328Z"/></svg>
                    <h2 id="timerS">{newS || timeToDisplay.slice(6,8)}</h2>
                    <svg onClick={()=>secSetter(-1)} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M459-381 314-526q-3-3-4.5-6.5T308-540q0-8 5.5-14t14.5-6h304q9 0 14.5 6t5.5 14q0 2-6 14L501-381q-5 5-10 7t-11 2q-6 0-11-2t-10-7Z"/></svg>
                    </div>

                    <button onClick={() => setTimer()}>
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="m382-354 339-339q12-12 28-12t28 12q12 12 12 28.5T777-636L410-268q-12 12-28 12t-28-12L182-440q-12-12-11.5-28.5T183-497q12-12 28.5-12t28.5 12l142 143Z"/></svg>
                    </button>
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
                    <button className={styles.btn} onClick={()=>{setEditTimer(!editTimer); dispatch(setTimer({...timer, time: 10000}))}}>
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M400-840q-17 0-28.5-11.5T360-880q0-17 11.5-28.5T400-920h160q17 0 28.5 11.5T600-880q0 17-11.5 28.5T560-840H400Zm108.5 428.5Q520-423 520-440v-160q0-17-11.5-28.5T480-640q-17 0-28.5 11.5T440-600v160q0 17 11.5 28.5T480-400q17 0 28.5-11.5Zm-168 303Q275-137 226-186t-77.5-114.5Q120-366 120-440t28.5-139.5Q177-645 226-694t114.5-77.5Q406-800 480-800q62 0 119 20t107 58l28-28q11-11 28-11t28 11q11 11 11 28t-11 28l-28 28q38 50 58 107t20 119q0 74-28.5 139.5T734-186q-49 49-114.5 77.5T480-80q-74 0-139.5-28.5ZM678-242q82-82 82-198t-82-198q-82-82-198-82t-198 82q-82 82-82 198t82 198q82 82 198 82t198-82ZM480-440Z"/></svg>
                    </button>
                }
            </div>
        </div>
    );
}