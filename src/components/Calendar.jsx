import styles from './Calendar.module.css';
import { useState } from 'react';

export default function Calendar(props){

    const {t, tasks} = props;

    const [monthsFromNow, setMonthsFromNow] = useState(0);

    const [activeDayId, setActiveDayId] = useState(null);

    const now = new Date();

    const displayDate = new Date(now.getFullYear(), now.getMonth() + monthsFromNow, 1);

    const dateFormatter = (date) => {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    const daysInCurrentMonth = (date) => {return (new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate())}

    const firstDayOfMonth = (date) => {return (new Date(date.getFullYear(), date.getMonth(), 1).getDay())}

    const monthsNavFunction = (direction) => {
        setMonthsFromNow((prev)=>{
            return prev + direction
        })
    }

    const getDayOfMonth = (indexDate, date) => {
        return (indexDate) > 0 
            && indexDate < (daysInCurrentMonth(date) + 1) 
            ? indexDate 
            : null
    }

    const getTasksForDate = (dayOfMonth, monthAdd = monthsFromNow) => {
        const dayDate = dateFormatter(
            new Date(displayDate.getFullYear(), now.getMonth() + monthAdd, dayOfMonth)
        );
        return tasks
            .filter(task => {
                const taskDate = dateFormatter(new Date(task.due));
                return taskDate.getTime() === dayDate.getTime();
            })
    }

    const dayNavFunction = (direction) => {
        if (activeDayId.date + direction >= 1 && activeDayId.date + direction <= daysInCurrentMonth(displayDate)){
            setActiveDayId((prev) => ({...prev, date: prev.date + direction, tasks: getTasksForDate(prev.date + direction)}));
        } else if (activeDayId.date === 1 && direction < 0) {
            setMonthsFromNow(prev => prev - 1);
            setActiveDayId(prev => ({...prev, date: daysInCurrentMonth(displayDate), tasks: getTasksForDate(daysInCurrentMonth(displayDate), monthsFromNow -1)}));
        } else if (activeDayId.date === daysInCurrentMonth(displayDate) && direction > 0){
            setMonthsFromNow(prev => prev + 1);
            setActiveDayId(prev=> ({...prev, date: 1, tasks: getTasksForDate(1, monthsFromNow + 1)}));
        } else if (direction === 'now') {
            setMonthsFromNow(0);
            setActiveDayId(prev => ({...prev, date: now.getDate(), tasks: getTasksForDate(now.getDate(), 0)}));
        }
        console.log(direction);
    }

    const taskLiReturner = (dayOfMonth) => {
        return getTasksForDate(dayOfMonth)
            .map(task => (
                <li key={task.index}>{task.name}</li>
            ));
    }

    const returnDayTd = (index, subFromIndex) => {
        const dateIndex = index - subFromIndex - firstDayOfMonth(displayDate) + 1;
        if (!getDayOfMonth(dateIndex, displayDate)) return <td key={dateIndex}></td>;
        return (
            <td key={dateIndex} 
                className={styles.td}
                onClick={!activeDayId ? ()=>setActiveDayId({date: dateIndex, tasks: getTasksForDate(dateIndex)}) : null}>
                <h3 key={`${dateIndex}h3`}>
                    {getDayOfMonth(dateIndex, displayDate)}
                </h3>
                <div key={`${dateIndex}div`}>
                    <ul key={`${dateIndex}ul`}>
                        {taskLiReturner(dateIndex)}
                    </ul>       
                </div>
            </td>
        )
    }

    const skipToCurrent = () => {
        setMonthsFromNow(0);
    }

    return (
        <div>
        <div className={styles.div}>
            <div className={styles.dayContainer}>
                <div className={styles.navDiv}>
                    {monthsFromNow > 0 && <button onClick={skipToCurrent} className={`${styles.navBtn} ${styles.skipNavBtnL}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M251.5-251.5Q240-263 240-280v-400q0-17 11.5-28.5T280-720q17 0 28.5 11.5T320-680v400q0 17-11.5 28.5T280-240q-17 0-28.5-11.5ZM552-480l156 156q11 11 11 28t-11 28q-11 11-28 11t-28-11L468-452q-6-6-8.5-13t-2.5-15q0-8 2.5-15t8.5-13l184-184q11-11 28-11t28 11q11 11 11 28t-11 28L552-480Z"/></svg>
                    </button>}
                    <button onClick={activeDayId ? ()=>dayNavFunction(-1) : ()=>monthsNavFunction(-1)} className={styles.navBtn}>
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="m432-480 156 156q11 11 11 28t-11 28q-11 11-28 11t-28-11L348-452q-6-6-8.5-13t-2.5-15q0-8 2.5-15t8.5-13l184-184q11-11 28-11t28 11q11 11 11 28t-11 28L432-480Z"/></svg>
                    </button>
                    <h2 className={styles.monthH2}>{`${t('months', (displayDate.getMonth()))} ${displayDate.getFullYear()}`}</h2>
                    <button onClick={activeDayId ? ()=>dayNavFunction(+1) : ()=>monthsNavFunction(+1)} className={styles.navBtn}>
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M504-480 348-636q-11-11-11-28t11-28q11-11 28-11t28 11l184 184q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L404-268q-11 11-28 11t-28-11q-11-11-11-28t11-28l156-156Z"/></svg>
                    </button>
                    {monthsFromNow < 0 && <button onClick={activeDayId ? () => dayNavFunction('now') : skipToCurrent} className={`${styles.navBtn} ${styles.skipNavBtnR}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M408-480 252-636q-11-11-11-28t11-28q11-11 28-11t28 11l184 184q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L308-268q-11 11-28 11t-28-11q-11-11-11-28t11-28l156-156Zm300.5-228.5Q720-697 720-680v400q0 17-11.5 28.5T680-240q-17 0-28.5-11.5T640-280v-400q0-17 11.5-28.5T680-720q17 0 28.5 11.5Z"/></svg>
                    </button>}
                </div>
                {activeDayId && <div id='dayFocusDiv' className={styles.dayFocusDiv}>
                    <h2>{`${activeDayId.date}. ${t('months',displayDate.getMonth())}`}</h2>
                    <ul>
                        {activeDayId.tasks?.map((task => (
                            <li>{task.name} {task.due}</li>
                        )))}
                    </ul>
                </div>}
                <table className={styles.calendarTable}>
                    <thead>
                        <tr>
                           {Array.from({length: 7}).map((_, index)=>(
                                <td key={`${index}Day`}>{t('weekDays', index)}</td>
                            ))} 
                        </tr>
                    </thead>
                    <tbody>
                        {
                            Array
                                .from({ length: 43 })
                                .map((day, index) => {
                                    if(index % 7 === 0){ 
                                        if(index - 6 > daysInCurrentMonth(displayDate) + firstDayOfMonth(displayDate)) return;
                                        return (
                                            <tr key={`${index / 7}tr`}>
                                                {Array.from({ length: 7 }).map((_, subIndex) => 
                                                    {return returnDayTd(index, 6 - subIndex)}
                                                )}
                                            </tr>)
                                    }
                                })
                        }
                    </tbody>
                </table>    
            </div>
        </div>
        </div>
    )
}