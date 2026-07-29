import styles from './Calendar.module.css';
import { useState } from 'react';

export default function Calendar(props){

    const {t} = props;

    const [monthsFromNow, setMonthsFromNow] = useState(0);

    const now = new Date();

    const displayDate = new Date(now.getFullYear(), now.getMonth() + monthsFromNow, 1);

    const daysInCurrentMonth = (date) => {return (new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate())}

    const firstDayOfMonth = (date) => {return (new Date(date.getFullYear(), date.getMonth(), 1).getDay())}

    const monthsNavFunction = (direction) => {
        setMonthsFromNow((prev)=>{
            return prev + direction
        })
    }

    const getDayOfMonth = (index, date) => {
        return (index + 1 - firstDayOfMonth(date)) > 0 
            && index < (daysInCurrentMonth(date) + firstDayOfMonth(date)) 
            ? (index + 1 - firstDayOfMonth(date)) 
            : null
    }

    const returnDayTd = (index, subFromIndex) => {
        if (!getDayOfMonth(index - subFromIndex, displayDate)) return <td></td>;
        return (
            <td key={`${index - subFromIndex}td`} className={styles.td}>
                <h3 key={`${index - subFromIndex}h3`}>
                    {getDayOfMonth(index - subFromIndex, displayDate)}
                </h3>
                <div key={`${index - subFromIndex}div`}>

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
                    <button onClick={()=>monthsNavFunction(-1)} className={styles.navBtn}>
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="m432-480 156 156q11 11 11 28t-11 28q-11 11-28 11t-28-11L348-452q-6-6-8.5-13t-2.5-15q0-8 2.5-15t8.5-13l184-184q11-11 28-11t28 11q11 11 11 28t-11 28L432-480Z"/></svg>
                    </button>
                    <h2 className={styles.monthH2}>{`${t('months', (displayDate.getMonth()))} ${displayDate.getFullYear()}`}</h2>
                    <button onClick={()=>monthsNavFunction(+1)} className={styles.navBtn}>
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M504-480 348-636q-11-11-11-28t11-28q11-11 28-11t28 11l184 184q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L404-268q-11 11-28 11t-28-11q-11-11-11-28t11-28l156-156Z"/></svg>
                    </button>
                    {monthsFromNow < 0 && <button onClick={skipToCurrent} className={`${styles.navBtn} ${styles.skipNavBtnR}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M408-480 252-636q-11-11-11-28t11-28q11-11 28-11t28 11l184 184q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L308-268q-11 11-28 11t-28-11q-11-11-11-28t11-28l156-156Zm300.5-228.5Q720-697 720-680v400q0 17-11.5 28.5T680-240q-17 0-28.5-11.5T640-280v-400q0-17 11.5-28.5T680-720q17 0 28.5 11.5Z"/></svg>
                    </button>}
                </div>
                <table className={styles.calendarTable}>
                    <thead>
                        <tr>
                           {Array.from({length: 7}).map((_, index)=>(
                                <td key={`${index}Day`}>{t('weekDays', index)}</td>
                            ))} 
                        </tr>
                    </thead>
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
                </table>    
            </div>
        </div>
        </div>
    )
}