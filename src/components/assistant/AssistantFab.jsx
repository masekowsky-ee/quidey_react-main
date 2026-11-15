import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { selectHasMax } from '../../features/pro/pro';
import { stopSpeaking } from '../../features/voice/speak';
import { showsAddFab } from '../../features/layout/addFab';
import { useTranslation } from '../../i18n/useTranslation';
import Icon from '../icons';
import AssistantSheet from './AssistantSheet.jsx';
import styles from './AssistantSheet.module.css';

// The AI assistant (Quidey Max): round at the bottom left, the add button's mirror, on the same
// pages (features/layout/addFab.js). Only for Max accounts (admins count): everybody else gets
// nothing, no button and no pitch. Opens the chat sheet over the page. An open sheet stays until
// it is closed, also when Max ends meanwhile (it says so there); the button is gone at once.
export default function AssistantFab() {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const hasMax = useSelector(selectHasMax);
    const [open, setOpen] = useState(false);
    // another page: nothing is read on over it
    useEffect(() => () => stopSpeaking(), [pathname]);
    return (
        <>
            {hasMax && showsAddFab(pathname) && (
                <button type="button" className={styles.fab} onClick={() => setOpen(true)}
                    aria-label={t('assistant')} title={t('assistant')} aria-haspopup="dialog" data-part="assistant-fab">
                    <Icon name="sparkle" className={styles.fabIcon} />
                </button>
            )}
            {open && <AssistantSheet onClose={() => setOpen(false)} />}
        </>
    );
}
