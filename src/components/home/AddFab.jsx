import { useDispatch } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { showForms } from '../../features/settings/settingsAction';
import { showsAddFab } from '../../features/layout/addFab';
import { useTranslation } from '../../i18n/useTranslation';
import Icon from '../icons';
import styles from './AddFab.module.css';

// The most frequent job at the thumb: a new task or event, round at the bottom right (Home's
// folded focus timer has the same shape in the bottom left). Opens the same form as N and the
// command bar. Only on the pages in features/layout/addFab.js.
export default function AddFab() {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const { pathname } = useLocation();
    if (!showsAddFab(pathname)) return null;
    return (
        <button type="button" className={styles.fab} onClick={() => dispatch(showForms(true))}
            aria-label={t('newEntry')} title={t('newEntry')} aria-keyshortcuts="N">
            <Icon name="plus" className={styles.icon} strokeWidth={2} />
        </button>
    );
}
