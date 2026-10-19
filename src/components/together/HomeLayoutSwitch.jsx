import styles from '../Together.module.css';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { setHomeLayout } from '../../features/settings/settingsAction';
import { HOME_LAYOUTS } from '../../features/settings/homeLayout';

// Solo | Team, the same choice as in the settings
export default function HomeLayoutSwitch() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const layout = useSelector(state => state.settings.homeLayout);
    return (
        <div className={styles.layoutSwitch} role="group" aria-label={t('homeLayout')}>
            {HOME_LAYOUTS.map(value => (
                <button
                    key={value}
                    className={layout === value ? styles.layoutOn : undefined}
                    aria-pressed={layout === value}
                    onClick={() => dispatch(setHomeLayout(value))}
                >
                    {t(value === 'solo' ? 'homeSolo' : 'homeTeam')}
                </button>
            ))}
        </div>
    );
}
