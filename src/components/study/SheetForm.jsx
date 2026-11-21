import { useId } from 'react';
import SheetGrabber from '../SheetGrabber.jsx';
import { useTranslation } from '../../i18n/useTranslation';
import Icon from '../icons.jsx';
import styles from './Study.module.css';
import own from './GoalSheet.module.css';

// The panel of a study sheet (render prop of FormSheet): grabber, close cross, head with the title.
// `aside` sits beside the title (the step of the goal sheet); children are the body.
export function SheetPanel({ sheet, close, title, aside, children }) {
    const { t } = useTranslation();
    const titleId = useId();
    return (
        <div className={own.panel} role="dialog" aria-modal="true" aria-labelledby={titleId} {...sheet.panel}>
            <SheetGrabber />
            <button type="button" className={own.close} onClick={() => close()} aria-label={t('close')} title={t('close')}><Icon name="close" size={18} /></button>
            <div className={own.head} data-sheet-drag>
                <h2 id={titleId} className={own.title}>{title}</h2>
                {aside}
            </div>
            {children}
        </div>
    );
}

// A SheetPanel around a <form>: the fields as children, then the error line and the footer
// (cancel + save). `extra`: more footer buttons before cancel; `cancelLabel`: default "Abbrechen".
export default function SheetForm({ sheet, close, title, onSubmit, error, busy, cancelLabel, extra, children }) {
    const { t } = useTranslation();
    return (
        <SheetPanel sheet={sheet} close={close} title={title}>
            <form className={own.form} noValidate onSubmit={onSubmit}>
                {children}
                {error && <p className={own.error} role="alert">{error}</p>}
                <div className={own.footer}>
                    {extra}
                    <button type="button" className={styles.btn} disabled={busy} onClick={() => close()}>{cancelLabel ?? t('studyCancel')}</button>
                    <button type="submit" className={styles.btnPrimary} disabled={busy}>{t('studySave')}</button>
                </div>
            </form>
        </SheetPanel>
    );
}
