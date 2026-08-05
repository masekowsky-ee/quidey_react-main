import styles from './History.module.css';
import { useSelector } from 'react-redux';

export default function History(props){
    const { t } = props;

    const workedSessionData = useSelector(state => state.session.workedSessionData);

    const browserTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

    console.log(workedSessionData);

    return (
        <div className={styles.div}>
            <h2 className={styles.h2}>{t('history')}</h2>
            <div>
                {workedSessionData[0] ?
                    workedSessionData.map((ws, index)  => {
                        return (
                            <div key={index}>
                                <h3>{`${ws.date.toLocaleDateString()} - ${ws.date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: browserTZ })}`}</h3>
                                <p>{`${t('total')}: ${Math.ceil(ws.time / 60)} min`}</p>
                                <ul>
                                    {
                                        ws.workedTasks[0] && ws.workedTasks.map((t)=>{
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