import styles from './Calendar.module.css';
import { useState } from 'react';

export default function Calendar(props){

    const {t, setCustomError} = props;

    const [setMonthsFromNow, monthsFromNow] = useState(1);

    const now = new Date();

    const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getDay();

    const monthDays = Array.from(
        { length: daysInCurrentMonth },
        (_, i) => new Date(now.getTime() + i * 24 * 60 * 60 * 1000)
    );

    function toDateOnly(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    return (
        <div>

            <div className={styles.dayContainer}>
                <h2>{t('months', now.getMonth())}</h2>
                <table>
                    <thead>
                        <tr>
                           {Array.from({length: 7}).map((_, index)=>(
                                <td key={`${index}Day`}>{t('weekDays', index)}</td>
                            ))} 
                        </tr>
                    </thead>
                        <tr></tr>
                        {
                            Array
                                .from({ length: 42 })
                                .map((day, index) => {
                                    if(index % 7 === 0){ 
                                        if(index - 6 > daysInCurrentMonth + firstDayOfMonth) return;
                                        return (
                                            <tr>
                                                <td>{(index + 1 - firstDayOfMonth - 6) > 0 && index - 6 < (daysInCurrentMonth + firstDayOfMonth) ? (index + 1 - firstDayOfMonth - 6) : null}</td>
                                                <td>{(index + 1 - firstDayOfMonth - 5) > 0 && index - 5 < (daysInCurrentMonth + firstDayOfMonth) ? (index + 1 - firstDayOfMonth - 5) : null}</td>
                                                <td>{(index + 1 - firstDayOfMonth - 4) > 0 && index - 4 < (daysInCurrentMonth + firstDayOfMonth) ? (index + 1 - firstDayOfMonth - 4) : null}</td>
                                                <td>{(index + 1 - firstDayOfMonth - 3) > 0 && index - 3 < (daysInCurrentMonth + firstDayOfMonth) ? (index + 1 - firstDayOfMonth - 3) : null}</td>
                                                <td>{(index + 1 - firstDayOfMonth - 2) > 0 && index - 2 < (daysInCurrentMonth + firstDayOfMonth) ? (index + 1 - firstDayOfMonth - 2) : null}</td>
                                                <td>{(index + 1 - firstDayOfMonth - 1) > 0 && index - 1 < (daysInCurrentMonth + firstDayOfMonth) ? (index + 1 - firstDayOfMonth - 1) : null}</td>
                                                <td>{(index + 1 - firstDayOfMonth) > 0 && index < (daysInCurrentMonth + firstDayOfMonth) ? (index + 1 - firstDayOfMonth) : null}</td>
                                            </tr>)
                                    }
                                })
                        }
                </table>    
            </div>
        </div>
    )
}