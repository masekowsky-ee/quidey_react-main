import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'motion/react';
import styles from './CommandPalette.module.css';
import Icon from '../icons';
import { useTranslation } from '../../i18n/useTranslation';
import { dueText, fill, parseDate } from '../../features/helperFunction';
import { setShowTutorial, setTheme, showForms } from '../../features/settings/settingsAction';
import { COMMUNITY_PATHS } from '../../features/community/paths';
import { MOTION, useMotionLevel } from '../../features/settings/motion';
import { UI_VARIANT_IDS, setUiVariant, useUiVariant } from '../../features/tester/variants';
import { useIsTester } from '../../features/auth/tester';
import { OPEN_COMMANDS_EVENT } from '../../features/tester/commands';
import { openShortcuts } from '../../features/shortcuts/shortcuts';
import { placeList } from '../../features/search/places';
import { useInstallState } from '../../features/pwa/install';
import TaskEditDialog from '../task/TaskEditDialog.jsx';

// how many tasks a search shows at most
const TASKS_SHOWN = 6;

// "Übung" finds "ubung", "Uebung" too
const normalize = (text) => text.toLocaleLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u')
    .normalize('NFD').replace(/[̀-ͯ]/g, '');

const matches = (words, text) => words.every(word => normalize(text).includes(word));

// The command bar, for everybody: Ctrl/⌘ K, "/" or the search button in the header opens it,
// typing narrows the list, arrows choose, Enter runs, Escape or the cross closes. Typed words
// find my open tasks first (Enter opens the task's editor), then places to jump to, then the
// pages' tabs and settings (`placeList`, beside each where it sits), then things to do. The
// tabs, settings and windows ("deep") only show once something is typed.
// "Übersicht" also shows it as a field in the header.
export default function CommandPalette() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const variant = useUiVariant();
    const isTester = useIsTester();
    const isAdmin = useSelector(state => state.auth.access.isAdmin);
    const tasks = useSelector(state => state.task.tasks);
    const installable = useInstallState() !== 'unavailable';
    const overlayMotion = MOTION.overlay[useMotionLevel()];
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [index, setIndex] = useState(0);
    // the task whose editor a search opened
    const [editTaskId, setEditTaskId] = useState(null);
    const editTask = tasks.find(task => task.id === editTaskId);
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
        const dark = document.documentElement.dataset.theme !== 'light';
        return [
            go('/', t('home'), 'home'),
            go('/calendar', t('calendar'), 'calendar'),
            go('/focus', t('focusRoom'), 'focus'),
            go('/routines', t('routines'), 'routine'),
            go(COMMUNITY_PATHS.feed, t('community'), 'together'),
            go(COMMUNITY_PATHS.sessions, t('communityTab_sessions'), 'focus'),
            go(COMMUNITY_PATHS.friends, t('communityTab_friends'), 'social'),
            go(COMMUNITY_PATHS.family, t('communityTab_family'), 'family'),
            go('/inbox', t('inbox'), 'inbox'),
            go('/stats', t('history'), 'history'),
            go('/profile', t('profile'), 'profile'),
            go('/settings', t('settings'), 'settings'),
            go('/feedback', t('feedback'), 'feedback'),
            ...(isTester ? [go('/tester', t('testerNav'), 'flask')] : []),
            ...(isAdmin ? [go('/admin', t('admin'), 'admin')] : []),
            ...placeList({ isAdmin, installable }).map(place => ({
                id: `place:${place.to}:${place.label}`, group: 'places', deep: true, icon: place.icon,
                label: t(place.label), meta: place.parent.map(key => t(key)).join(' · '),
                run: () => navigate(place.to),
            })),
            { id: 'do:new', group: 'do', label: t('commandNewEntry'), icon: 'plus', run: () => dispatch(showForms(true)) },
            {
                id: 'do:theme', group: 'do', label: t(dark ? 'commandThemeLight' : 'commandThemeDark'), icon: dark ? 'sun' : 'moon',
                run: () => dispatch(setTheme(dark ? 'light' : 'dark')),
            },
            { id: 'do:shortcuts', group: 'do', label: t('commandShortcuts'), icon: 'tutorial', run: openShortcuts },
            { id: 'do:tour', group: 'do', deep: true, label: t('settingsTourStart'), icon: 'route', run: () => dispatch(setShowTutorial(true)) },
            { id: 'do:customize', group: 'do', deep: true, label: t('profileCustomize'), icon: 'edit', run: () => navigate('/profile#customize') },
            ...(isTester ? UI_VARIANT_IDS.filter(id => id !== variant).map(id => ({
                id: `do:variant:${id}`, group: 'do', icon: 'switch',
                label: fill(t('commandVariant'), { name: t(`uiVariant_${id}`) }),
                run: () => dispatch(setUiVariant(id)),
            })) : []),
        ];
    // the theme is read when the bar opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [t, navigate, dispatch, isAdmin, isTester, installable, variant, open]);

    const shown = useMemo(() => {
        const words = normalize(query.trim()).split(/\s+/).filter(Boolean);
        // tasks only once something is typed: the open ones, soonest day first
        const found = words.length === 0 ? [] : tasks
            .filter(task => !task.done && matches(words, task.name))
            .sort((a, b) => (parseDate(a.due)?.getTime() ?? Infinity) - (parseDate(b.due)?.getTime() ?? Infinity))
            .slice(0, TASKS_SHOWN)
            .map(task => ({
                id: `task:${task.id}`, group: 'tasks', label: task.name, icon: 'tasks',
                meta: task.due ? dueText(task.due, t) : t('commandTaskNoDay'),
                run: () => setEditTaskId(task.id),
            }));
        const places = commands.filter(command => (words.length > 0 || !command.deep)
            && matches(words, `${command.label} ${command.meta ?? ''}`));
        return [...found, ...places];
    }, [commands, query, tasks, t]);
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

    const groups = [['tasks', t('commandGroupTasks')], ['go', t('commandGroupGo')], ['places', t('commandGroupPlaces')], ['do', t('commandGroupDo')]];
    const optionId = (command) => `${listId}-${command.id}`;

    return (
        <>
            <AnimatePresence>
                {open && <>
                    <motion.div className={styles.overlay} onClick={close} {...overlayMotion} />
                    <div className={styles.panel} role="dialog" aria-modal="true" aria-label={t('commandOpen')} data-part="commands">
                        <div className={styles.field}>
                            <Icon name="search" className={styles.fieldIcon} />
                            <input ref={inputRef} className={styles.input} type="text" value={query}
                                placeholder={t('commandPlaceholder')} aria-label={t('commandPlaceholder')}
                                autoComplete="off" spellCheck={false}
                                role="combobox" aria-expanded="true" aria-controls={listId} aria-autocomplete="list"
                                aria-activedescendant={shown[current] ? optionId(shown[current]) : undefined}
                                onChange={(e) => { setQuery(e.target.value); setIndex(0); }} onKeyDown={onKeyDown} />
                            <button type="button" className={styles.close} onClick={close} aria-label={t('close')} title={`${t('close')} (Esc)`}>
                                <Icon name="close" size={18} />
                            </button>
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
                                                    aria-label={command.meta ? `${command.label}, ${command.meta}` : undefined}
                                                    className={`${styles.option} ${selected ? styles.selected : ''}`}
                                                    onPointerMove={() => setIndex(shown.indexOf(command))}
                                                    onClick={() => run(command)}>
                                                    <Icon name={command.icon} className={styles.optionIcon} />
                                                    <span className={styles.optionLabel}>{command.label}</span>
                                                    {command.meta && <span className={styles.optionMeta}>{command.meta}</span>}
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
            {editTask && <TaskEditDialog task={editTask} onClose={() => setEditTaskId(null)} />}
        </>
    );
}
