import styles from './Calendar.module.css';

export default function Calendar(props){

    const {t, setCustomError} = props;

    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

    function toDateOnly(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    return (
        <div>

            <div className={styles.dayContainer}>
                {

                }
            </div>
        </div>
    )
}