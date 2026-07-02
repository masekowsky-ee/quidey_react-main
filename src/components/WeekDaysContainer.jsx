import React from 'react';
import styles from './WeekDaysContainer.module.css';

export default function WeekDaysContainer(props){
    const { t, tasks } = props;

    const today = new Date();
    const ttt1 = new Date(+ new Date() + 24 * 60 * 60 * 1000);
    const tt1 = ttt1.getDay()
    const ttt2 = new Date(+ new Date() + 2 * 24 * 60 * 60 * 1000);
    const tt2 = ttt2.getDay()
    const ttt3 = new Date(+ new Date() + 3 * 24 * 60 * 60 * 1000);
    const tt3 = ttt3.getDay()
    const ttt4 = new Date(+ new Date() + 4 * 24 * 60 * 60 * 1000);
    const tt4 = ttt4.getDay()
    const ttt5 = new Date(+ new Date() + 5 * 24 * 60 * 60 * 1000);
    const tt5 = ttt5.getDay()
    const ttt6 = new Date(+ new Date() + 6 * 24 * 60 * 60 * 1000);
    const tt6 = ttt6.getDay()
    const ttt7 = new Date(+ new Date() + 7 * 24 * 60 * 60 * 1000);
    const tt7 = ttt7.getDay()
    const weekDayIndex = today.getDay();
    console.log(tt1, tt2, tt3, tt4, tt5, tt6, tt7);

    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

    const t1 = days[tt1];
    const t2 = days[tt2];
    const t3 = days[tt3];
    const t4 = days[tt4];
    const t5 = days[tt5];
    const t6 = days[tt6];
    const t7 = days[tt7];

    function toDateOnly(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    function dayTaskLis(date){
        const daysTasks = tasks.filter((task)=>{
            const inputDate = toDateOnly(new Date(new Date(task.due).getTime() + 24 * 60 * 60 * 1000));
            const daysDate = toDateOnly(date);
            return inputDate.getTime() === daysDate.getTime();
        })

        if (daysTasks.length === 0){
            return <li>---</li>;
        }

        return daysTasks.map((task) => (
            <li key={task.index} className={`${task.done ? styles.done : styles.notDone}`}>{task.name}</li>
        ));
    }

    return ( 
        <div>
            <div className={styles.weekTable}>
                <div className={styles.weekDayDiv}>
                    <h2>{t('today')}</h2>
                    <ul className={styles.dayList}>
                        {
                            dayTaskLis(today)
                        }
                    </ul>
                </div>
                <div className={styles.weekDayDiv}>
                    <h2>{t(t1) + ' ' + ttt1.getUTCDate() + '.' + ttt1.getUTCMonth()}</h2>
                    <ul className={styles.dayList}>
                        {
                            dayTaskLis(ttt1)
                        }
                    </ul>
                </div>
                <div className={styles.weekDayDiv}>
                    <h2>{t(t2) + ' ' + ttt2.getUTCDate() + '.' + ttt1.getUTCMonth()}</h2>
                    <ul className={styles.dayList}>
                        {
                            dayTaskLis(ttt2)
                        }
                    </ul>
                </div>
                <div className={styles.weekDayDiv}>
                    <h2>{t(t3) + ' ' + ttt3.getUTCDate() + '.' + ttt1.getUTCMonth()}</h2>
                    <ul className={styles.dayList}>
                        {
                            dayTaskLis(ttt3)
                        }
                    </ul>
                </div>
                <div className={styles.weekDayDiv}>
                    <h2>{t(t4) + ' ' + ttt4.getUTCDate() + '.' + ttt1.getUTCMonth()}</h2>
                    <ul className={styles.dayList}>
                        {
                            dayTaskLis(ttt4)
                        }
                    </ul>
                </div>
                <div className={styles.weekDayDiv}>
                    <h2>{t(t5) + ' ' + ttt5.getUTCDate() + '.' + ttt1.getUTCMonth()}</h2>
                    <ul className={styles.dayList}>
                        {
                            dayTaskLis(ttt5)
                        }
                    </ul>
                </div>
                <div className={styles.weekDayDiv}>
                    <h2>{t(t6) + ' ' + ttt6.getUTCDate() + '.' + ttt1.getUTCMonth()}</h2>
                    <ul className={styles.dayList}>
                        {
                            dayTaskLis(ttt6)
                        }
                    </ul>
                </div>
                <div className={styles.weekDayDiv}>
                    <h2>{t(t7) + ' ' + ttt7.getUTCDate() + '.' + ttt1.getUTCMonth()}</h2>
                    <ul className={styles.dayList}>
                        {
                            dayTaskLis(ttt7)
                        }
                    </ul>
                </div>
            </div>
        </div>
    );
}