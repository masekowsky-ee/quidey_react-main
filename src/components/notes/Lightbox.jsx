import { useTranslation } from '../../i18n/useTranslation';
import Icon from '../icons.jsx';
import styles from './Lightbox.module.css';

// A note's picture as a small square that opens the big one. size: 'large' for the board.
export function ImageThumb({ item, size, onOpen }) {
    const { t } = useTranslation();
    const name = item.name || t('noteImage');
    return (
        <button type="button" className={styles.thumb} data-size={size} onClick={() => onOpen(item)} aria-label={name}>
            <img src={item.data} alt={name} />
        </button>
    );
}

// The big picture over the page; a click, Escape or (closeButton) the cross closes it.
// layer 'alert' stands above a sheet.
export default function Lightbox({ item, onClose, layer, closeButton = false }) {
    const { t } = useTranslation();
    const name = item.name || t('noteImage');
    return (
        <div className={styles.lightbox} data-layer={layer} role="dialog" aria-label={name} onClick={onClose}
            onKeyDown={e => e.key === 'Escape' && onClose()}>
            <img src={item.data} alt={name} />
            {closeButton &&
                <button type="button" autoFocus className={styles.close} aria-label={t('close')} title={t('close')}><Icon name="close" size={20} /></button>}
        </div>
    );
}
