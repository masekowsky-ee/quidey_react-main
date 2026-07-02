import React, {useState} from "react";
import styles from './History.module.css';

export default function History(props){
    const { t, workedSessions, tasks, groups, setCustomError } = props;


    return (
        <div className={styles.div}>
            <h2 className={styles.h2}>{t('history')}</h2>
            <div>
                {workedSessions[0] ?
                    workedSessions.map((ws)  => {
                        return (
                            <div>
                                <h3>{`${ws.date.toLocaleDateString()} - ${ws.date.toLocaleTimeString().slice(0,5)}`}</h3>
                                <p>{`${t('total')}: ${Math.ceil(ws.time / 60)} min`}</p>
                                <ul>
                                    {
                                        ws.workedTasks.map((t)=>{
                                            let time = Math.floor(t.time / 60);
                                            if(time < 1){
                                                time = '>1'
                                            }
                                            return(
                                                <li>
                                                    <p>{`"${t.name}", ${time} min`}</p>
                                                </li>
                                            )
                                        })
                                    }
                                </ul>
                            </div>
                        )
                    }) : <p>{t('noSessionsYet')}</p>
                }
            </div>
        </div>
    );
}