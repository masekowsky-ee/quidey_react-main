import { useState } from 'react';
import styles from './SubGroupBar.module.css';
import { useTranslation } from '../../i18n/useTranslation';
import { fill } from '../../features/helperFunction';
import ConfirmDeleteButton from '../ConfirmDeleteButton.jsx';
import Icon from '../icons';

// Sub-groups of a shared session or a family (experimental, only shown to testers): "All", one
// chip per group, "+" names a new one. The shown group can be deleted; its entries stay.
// value: the shown group's id, or null for all. counts: open entries per group id (and `all`).
// onAdd(name) / onRemove(id) resolve to something truthy once it worked; without them the
// groups can only be picked (e.g. an ended session). className: e.g. other spacing.
export default function SubGroupBar({ groups, value, onChange, onAdd, onRemove, counts, className = '' }) {
    const { t } = useTranslation();
    const [adding, setAdding] = useState(false);
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const shown = groups.find(group => group.id === value);

    const add = async (e) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) { setAdding(false); return; }
        setBusy(true);
        const added = await onAdd(trimmed);
        setBusy(false);
        if (added) {
            setName('');
            setAdding(false);
        }
    };

    const chip = (id, label) => {
        const count = counts?.[id ?? 'all'];
        return (
            <button type="button" key={id ?? 'all'} className={`${styles.chip} ${value === id ? styles.active : ''}`}
                aria-pressed={value === id} onClick={() => onChange(id)}>
                {label}
                {count > 0 && <span className={styles.count}>{count}</span>}
            </button>
        );
    };

    return (
        <div className={`${styles.wrap} ${className}`}>
            <div className={styles.bar} role="group" aria-label={t('subGroups')} data-part="sub-groups">
                <span className={styles.label}>
                    {t('subGroups')}
                    <span className={styles.tag} title={t('subGroupsTesterHint')}>{t('experimental')}</span>
                </span>
                {chip(null, t('all'))}
                {groups.map(group => chip(group.id, group.name))}
                {shown && onRemove &&
                    <ConfirmDeleteButton className={styles.remove} onConfirm={() => onRemove(shown.id)}
                        label={fill(t('subGroupDeleteLabel'), { name: shown.name })} title={t('subGroupDelete')} />}
                {onAdd && (adding
                    ? <form className={styles.addForm} onSubmit={add}>
                        <input value={name} maxLength={40} autoFocus disabled={busy} placeholder={t('subGroupName')} aria-label={t('subGroupName')}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setAdding(false); setName(''); } }}
                            onBlur={() => { if (!name.trim()) setAdding(false); }} />
                    </form>
                    : <button type="button" className={styles.addChip} onClick={() => setAdding(true)}
                        title={t('subGroupAdd')} aria-label={t('subGroupAdd')}>
                        <Icon name="plus" className={styles.addIcon} strokeWidth={2} />
                    </button>)}
            </div>
        </div>
    );
}
