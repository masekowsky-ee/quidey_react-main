import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'motion/react';
import styles from './CommandPalette.module.css';
import Icon from '../icons';
import { useTranslation } from '../../i18n/useTranslation';
import { fill } from '../../features/helperFunction';
import { showForms } from '../../features/settings/settingsAction';
import { COMMUNITY_PATHS } from '../../features/community/paths';
import { MOTION, useMotionLevel } from '../../features/settings/motion';
import { UI_VARIANT_IDS, setUiVariant, useUiVariant } from '../../features/tester/variants';
import { OPEN_COMMANDS_EVENT } from '../../features/tester/commands';


// "Übung" finds "ubung", "Uebung" too
const normalize = (text) => text.toLocaleLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u')
    .normalize('NFD').replace(/[̀-ͯ]/g, '');

// The command bar of the "Übersicht" variant: Ctrl/⌘ K (or the field in the header) opens it,
// typing narrows the list, arrows choose, Enter runs, Escape closes. Places to jump to first,
// then things to do.
export default function CommandPalette() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const variant = useUiVariant();
    const isAdmin = useSelector(state => state.auth.access.isAdmin);
    const overlayMotion = MOTION.overlay[useMotionLevel()];
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [index, setIndex] = useState(0);
    const inputRef = useRef(null);
    const returnFocus = useRef(null);
    const listId = useId();

    useEffect(() => {
        const show = () => {
            returnFocus.current = document.activeElement;
            setQuery('');
            setIndex(0);
            setOpen(true);
        };
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                show();
            }
        };
        window.addEventListener('keydown', onKey);
        window.addEventListener(OPEN_COMMANDS_EVENT, show);
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener(OPEN_COMMANDS_EVENT, show);
        };
    }, []);

    useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

    const commands = useMemo(() => {
        const go = (to, label, icon) => ({ id: `go:${to}`, group: 'go', label, icon, run: () => navigate(to) });
        return [
            go('/', t('home'), 'home'),
            go('/calendar', t('calendar'), 'calendar'),
            go(COMMUNITY_PATHS.feed, t('community'), 'together'),
            go(COMMUNITY_PATHS.sessions, t('communityTab_sessions'), 'focus'),
            go(COMMUNITY_PATHS.friends, t('communityTab_friends'), 'social'),
            go(COMMUNITY_PATHS.family, t('communityTab_family'), 'family'),
            go('/inbox', t('inbox'), 'inbox'),
            go('/stats', t('history'), 'history'),
            go('/profile', t('profile'), 'profile'),
            go('/settings', t('settings'), 'settings'),
            go('/feedback', t('feedback'), 'feedback'),
            go('/tester', t('testerNav'), 'flask'),
            ...(isAdmin ? [go('/admin', t('admin'), 'admin')] : []),
            { id: 'do:new', group: 'do', label: t('commandNewEntry'), icon: 'plus', run: () => dispatch(showForms(true)) },
            ...UI_VARIANT_IDS.filter(id => id !== variant).map(id => ({
                id: `do:variant:${id}`, group: 'do', icon: 'switch',
                label: fill(t('commandVariant'), { name: t(`uiVariant_${id}`) }),
                run: () => dispatch(setUiVariant(id)),
            })),
        ];
    }, [t, navigate, dispatch, isAdmin, variant]);

    const shown = useMemo(() => {
        const words = normalize(query.trim()).split(/\s+/).filter(Boolean);
        return commands.filter(command => words.every(word => normalize(command.label).includes(word)));
    }, [commands, query]);
    const current = Math.min(index, Math.max(0, shown.length - 1));

    const close = () => {
        setOpen(false);
        returnFocus.current?.focus?.();
    };
    const run = (command) => {
        setOpen(false);
        command.run();
    };

    const onKeyDown = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); close(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => (Math.min(i, shown.length - 1) + 1) % Math.max(1, shown.length)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => (Math.min(i, shown.length - 1) - 1 + shown.length) % Math.max(1, shown.length)); }
        else if (e.key === 'Enter' && shown[current]) { e.preventDefault(); run(shown[current]); }
    };

    const groups = [['go', t('commandGroupGo')], ['do', t('commandGroupDo')]];
    const optionId = (command) => `${listId}-${command.id}`;

    return (
        <AnimatePresence>
            {open && <>
                <motion.div className={styles.overlay} onClick={close} {...overlayMotion} />
                <div className={styles.panel} role="dialog" aria-modal="true" aria-label={t('commandOpen')} data-part="commands">
                    <div className={styles.field}>
                        <Icon name="search" className={styles.fieldIcon} />
                        <input ref={inputRef} className={styles.input} type="text" value={query}
                            placeholder={t('commandPlaceholder')} aria-label={t('commandPlaceholder')}
                            role="combobox" aria-expanded="true" aria-controls={listId} aria-autocomplete="list"
                            aria-activedescendant={shown[current] ? optionId(shown[current]) : undefined}
                            onChange={(e) => { setQuery(e.target.value); setIndex(0); }} onKeyDown={onKeyDown} />
                        <kbd className={styles.kbd}>Esc</kbd>
                    </div>
                    <div id={listId} role="listbox" className={styles.list} aria-label={t('commandOpen')}>
                        {shown.length === 0 && <p className={styles.empty}>{fill(t('commandNoResults'), { query: query.trim() })}</p>}
                        {groups.map(([group, label]) => {
                            const items = shown.filter(command => command.group === group);
                            if (items.length === 0) return null;
                            return (
                                <div key={group} role="group" aria-label={label} className={styles.group}>
                                    <p className={styles.groupLabel} aria-hidden="true">{label}</p>
                                    {items.map(command => {
                                        const selected = shown[current] === command;
                                        return (
                                            <div key={command.id} id={optionId(command)} role="option" aria-selected={selected}
                                                className={`${styles.option} ${selected ? styles.selected : ''}`}
                                                onPointerMove={() => setIndex(shown.indexOf(command))}
                                                onClick={() => run(command)}>
                                                <Icon name={command.icon} className={styles.optionIcon} />
                                                <span>{command.label}</span>
                                                {selected && <Icon name="arrowRight" className={styles.enterIcon} />}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                    <p className={styles.hint}>{t('commandHint')}</p>
                </div>
            </>}
        </AnimatePresence>
    );
}
