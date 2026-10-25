import styles from './PageSkeletons.module.css';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { DESKTOP_QUERY, useMediaQuery } from '../../features/layout/breakpoints';
import { COMMUNITY_PATHS, COMMUNITY_TABS } from '../../features/community/paths';
import { addDays, readStoredCalendarView } from '../../features/calendar/calendar';
import { LegalFooter } from '../../legal/LegalFooter.jsx';
import Logo from '../Logo';
import Icon from '../icons';
import { Bone, Skeleton, SkeletonRows } from './Skeleton.jsx';
import { HomeSkeleton } from '../Home.jsx';

// The shapes of the pages whose code loads when they are first opened (App's lazy PAGES):
// shown by Suspense until it is there, and by the start screen (AppSkeleton). What is known
// before any data (titles, tabs, today's month) is text; the rest grey. Inert: nothing in them
// works yet.

// A tab bar as the page draws it, the active one raised; labels only, nothing to click yet
function Tabs({ className = styles.tabs, labels, active }) {
    return (
        <div className={className}>
            {labels.map(([key, label]) => (
                <button key={key} type="button" tabIndex={-1} className={key === active ? styles.tabActive : undefined}>{label}</button>
            ))}
        </div>
    );
}

// ---------- calendar: title, controls, this month's grid (the days are known, their tasks not) ----------

function MonthGrid({ date }) {
    const { t } = useTranslation();
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const start = addDays(first, -((first.getDay() + 6) % 7));
    const isoWeek = (day) => {
        const thursday = addDays(day, 3 - ((day.getDay() + 6) % 7));
        const yearStart = new Date(thursday.getFullYear(), 0, 1);
        return Math.ceil(((thursday - yearStart) / 86400000 + 1) / 7);
    };
    return (
        <div className={styles.monthCard}>
            <div className={styles.month}>
                <span className={styles.weekNum}>{t('weekShort')}</span>
                {Array.from({ length: 7 }, (_, i) => (
                    <span key={i} className={`${styles.weekdayHead} ${i >= 5 ? styles.weekend : ''}`}>{t('weekDays', i)}</span>
                ))}
                {Array.from({ length: 6 }, (_, row) => {
                    const monday = addDays(start, row * 7);
                    return [
                        <span key={`w${row}`} className={styles.weekNum}>{isoWeek(monday)}</span>,
                        ...Array.from({ length: 7 }, (_, i) => {
                            const day = addDays(monday, i);
                            const outside = day.getMonth() !== date.getMonth();
                            return (
                                <div key={`${row}-${i}`} className={`${styles.cell} ${outside ? styles.outside : ''}`}>
                                    <span className={styles.dayNum}>{day.getDate()}</span>
                                </div>
                            );
                        }),
                    ];
                })}
            </div>
        </div>
    );
}

function CalendarSkeleton() {
    const { t, language } = useTranslation();
    const [params] = useSearchParams();
    const locale = language === 'de' ? 'de-DE' : 'en-GB';
    const view = ['month', 'week', 'agenda'].includes(params.get('view')) ? params.get('view') : readStoredCalendarView();
    const asked = params.get('date') ? new Date(`${params.get('date')}T00:00:00`) : new Date();
    const date = Number.isNaN(asked.getTime()) ? new Date() : asked;
    const labels = { month: 'calendarViewMonth', week: 'calendarViewWeek', agenda: 'calendarViewAgenda' };
    return (
        <div className={styles.wide}>
            <div className={styles.toolbar}>
                <div className={styles.titleRow}>
                    <h1 className={styles.calendarTitle}>
                        {view === 'month' ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date) : <Bone w="14rem" h="1.75rem" />}
                    </h1>
                    <div className={styles.calendarNav}>
                        <Bone pill w="4.75rem" h="2.25rem" style={{ marginRight: '0.35rem' }} />
                        <Bone round w="2.25rem" />
                        <Bone round w="2.25rem" />
                    </div>
                </div>
                <div className={styles.controls}>
                    <Tabs className={styles.segmented} active={view}
                        labels={Object.entries(labels).map(([key, label]) => [key, t(label)])} />
                    <div className={styles.filters}>
                        <Bone w="12rem" h="2.15rem" style={{ borderRadius: 'var(--radius-sm)' }} />
                        <Bone pill w="5.5rem" h="2.15rem" />
                    </div>
                </div>
            </div>
            {view === 'month'
                ? <MonthGrid date={date} />
                : <div className={styles.card}><SkeletonRows count={6} avatar={false} /></div>}
        </div>
    );
}

// ---------- Gemeinschaft: title, tabs, the tab (beside "online now" when I have friends) ----------

function CommunitySkeleton() {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const hasFriends = useSelector(state => state.friends.friends.length > 0);
    const tab = COMMUNITY_TABS.find(key => COMMUNITY_PATHS[key] === pathname) ?? 'feed';
    const rail = tab !== 'progress' && hasFriends;
    return (
        <div className={styles.community}>
            <header className={styles.head}>
                <div className={styles.headText}>
                    <h1 className={styles.headTitle}>{t('community')}</h1>
                    <Bone w="16rem" h="0.9375rem" />
                </div>
                {tab !== 'sessions' && <Bone pill w="8.5rem" h="2.25rem" />}
            </header>
            <Tabs className={styles.communityTabs} active={tab}
                labels={COMMUNITY_TABS.map(key => [key, t(`communityTab_${key}`)])} />
            <div className={styles.layout} data-tab={tab} data-rail={rail || undefined}>
                {rail && (
                    <div className={styles.rail}>
                        <div className={styles.card}><Bone w="7rem" h="1rem" /><SkeletonRows count={2} /></div>
                    </div>
                )}
                {tab === 'progress'
                    ? <div className={styles.twoCols}>
                        {[0, 1].map(i => (
                            <div key={i} className={styles.card}>
                                <Bone w="6rem" h="1rem" />
                                <div className={styles.levelTop}><Bone round w="4rem" /><Bone w="5rem" h="2rem" /></div>
                                <Bone w="100%" h="0.5rem" />
                                <Bone w="70%" /><Bone w="85%" /><Bone w="60%" />
                            </div>
                        ))}
                    </div>
                    : <div className={styles.card}>
                        {tab === 'feed' &&
                            <div className={styles.composer}>
                                <Bone w="7rem" h="1rem" />
                                <Bone w="100%" h="4.4rem" style={{ borderRadius: 'var(--radius-sm)' }} />
                                <div className={styles.cardHead}><Bone w="12rem" h="0.8125rem" /><Bone pill w="7rem" h="2.25rem" /></div>
                            </div>}
                        <SkeletonRows count={4} />
                    </div>}
            </div>
        </div>
    );
}

// ---------- inbox: title, tabs, the conversations (beside the open one on a wide screen) ----------

const INBOX_TABS = ['messages', 'requests', 'notices', 'reminders'];

function InboxSkeleton() {
    const { t } = useTranslation();
    const [params] = useSearchParams();
    const tab = INBOX_TABS.includes(params.get('tab')) ? params.get('tab') : 'messages';
    const split = useMediaQuery(DESKTOP_QUERY) && tab === 'messages';
    return (
        <div className={split ? styles.medium : styles.column}>
            <h1 className={styles.title}>{t('inbox')}</h1>
            <Tabs active={tab} labels={INBOX_TABS.map(key => [key, t(`inboxTab_${key}`)])} />
            {split
                ? <div className={styles.split}>
                    <div className={styles.card}><SkeletonRows count={4} /></div>
                    <div className={styles.card}><Bone w="70%" h="1.1rem" /><Bone w="8rem" /><Bone pill w="9rem" h="2.25rem" /></div>
                </div>
                : <div className={styles.card}><SkeletonRows count={5} avatar={tab === 'messages' || tab === 'requests'} /></div>}
        </div>
    );
}

// ---------- statistics: title, tabs, period, tiles, the chart, two lists ----------

const STATS_TABS = ['overview', 'sessions', 'done'];
const RANGES = ['week', 'month', 'year', 'all'];

function StatsSkeleton() {
    const { t } = useTranslation();
    const [params] = useSearchParams();
    const tab = STATS_TABS.includes(params.get('tab')) ? params.get('tab') : 'overview';
    const range = RANGES.includes(params.get('range')) ? params.get('range') : 'week';
    return (
        <div className={styles.stats}>
            <h1 className={styles.title}>{t('history')}</h1>
            <Tabs active={tab} labels={STATS_TABS.map(key => [key, t(`statsTab_${key}`)])} />
            {tab !== 'done' &&
                <div className={styles.periodBar}>
                    <Tabs className={styles.segmented} active={range} labels={RANGES.map(key => [key, t(`range_${key}`)])} />
                    <div className={styles.stepper}>
                        <Icon name="prev" size={20} />
                        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', minWidth: '9.5rem' }}>
                            <Bone w="6.5rem" h="0.9375rem" /><Bone w="7.5rem" h="0.7rem" />
                        </span>
                        <Icon name="next" size={20} />
                    </div>
                </div>}
            {tab === 'overview'
                ? <>
                    <div className={styles.tiles}>
                        {[0, 1, 2, 3].map(i => <div key={i} className={styles.tile}><Bone w="60%" h="0.8125rem" /><Bone w="3.5rem" h="1.375rem" /></div>)}
                    </div>
                    <div className={styles.card}>
                        <Bone w="9rem" h="1rem" />
                        <Bone w="100%" h="15rem" style={{ marginTop: '0.5rem' }} />
                    </div>
                    <div className={styles.twoCols}>
                        {[0, 1].map(i => (
                            <div key={i} className={styles.card}>
                                <Bone w="8rem" h="1rem" />
                                {['80%', '55%', '35%'].map(w => <Bone key={w} w={w} h="0.75rem" style={{ marginTop: '0.4rem' }} />)}
                            </div>
                        ))}
                    </div>
                </>
                : <div className={styles.card}><SkeletonRows count={6} avatar={false} /></div>}
        </div>
    );
}

// ---------- profiles: the card (banner, avatar over its edge, name), more cards below ----------

function ProfileCardSkeleton() {
    return (
        <div className={styles.profileCard}>
            <div className={styles.banner} />
            <div className={styles.profileBody}>
                <div className={styles.profileTop}><Bone round w="5.5rem" className={styles.avatar} /></div>
                <Bone w="11rem" h="1.375rem" style={{ marginTop: '0.25rem' }} />
                <Bone w="6rem" />
                <Bone w="9rem" h="2rem" style={{ marginTop: '0.25rem' }} />
                <Bone w="10rem" h="0.8125rem" />
            </div>
        </div>
    );
}

// mine (/profile) with its title, or somebody else's (/u/:username)
function ProfileSkeleton({ own }) {
    const { t } = useTranslation();
    return (
        <div className={styles.column}>
            {own ? <h1 className={styles.title}>{t('profile')}</h1> : <div className={styles.pageTop} />}
            <ProfileCardSkeleton />
            <div className={styles.card}>
                <Bone w="8rem" h="1rem" />
                <div className={styles.levelTop}><Bone round w="10rem" /><div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', flex: 1 }}><Bone w="9rem" h="1.5rem" /><Bone w="4rem" /><Bone w="80%" /></div></div>
            </div>
        </div>
    );
}

// ---------- settings: title and areas, then a label column beside a panel per section ----------

const AREAS = ['look', 'plan', 'app'];

function SettingsSkeleton() {
    const { t } = useTranslation();
    const { hash } = useLocation();
    const name = hash.slice(1);
    const area = name === 'event-types' ? 'plan' : AREAS.includes(name) ? name : 'look';
    return (
        <div className={styles.medium}>
            <header className={styles.settingsHead}>
                <h1 className={styles.title}>{t('settings')}</h1>
                <Tabs active={area} labels={AREAS.map(key => [key, t(`settingsArea_${key}`)])} />
            </header>
            <div>
                {[2, 4, 3].map((rows, i) => (
                    <section key={i} className={styles.section}>
                        <div className={styles.sectionText}><Bone w="7rem" h="1rem" /><Bone w="90%" h="0.8125rem" /><Bone w="60%" h="0.8125rem" /></div>
                        <div className={styles.sectionPanel}>
                            {Array.from({ length: rows }, (_, row) => (
                                <div key={row} className={styles.settingRow}><Bone w="8rem" h="0.9375rem" /><Bone pill w="11rem" h="2.25rem" /></div>
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}

// ---------- anything else (sessions, families, admin, feedback, …): a title and a card of rows ----------

function ColumnSkeleton() {
    return (
        <div className={styles.column}>
            <Bone w="12rem" h="1.6rem" style={{ margin: '2.5rem 0 0.5rem' }} />
            <div className={styles.card}><Bone w="9rem" h="1rem" /><SkeletonRows count={4} /></div>
            <div className={styles.card}><Bone w="7rem" h="1rem" /><Bone w="100%" h="6rem" /></div>
        </div>
    );
}

const PAGE_SKELETONS = [
    [/^\/calendar$/, CalendarSkeleton],
    [(path) => Object.values(COMMUNITY_PATHS).includes(path), CommunitySkeleton],
    [/^\/inbox$/, InboxSkeleton],
    [/^\/(stats|history)$/, StatsSkeleton],
    [/^\/profile$/, () => <ProfileSkeleton own />],
    [/^\/u\/[^/]+$/, () => <ProfileSkeleton />],
    [/^\/settings$/, SettingsSkeleton],
];

// The page at this address as a skeleton. fade: comes in after a moment (Suspense, where a quick
// load shouldn't flash it); the start screen shows it at once, after the HTML's own skeleton.
export function RouteSkeleton({ pathname, fade = false }) {
    // Home is in the app from the start; its "team" layout loads like the other pages
    const soloHome = useSelector(state => state.settings.homeLayout) !== 'team';
    const Page = pathname === '/' && soloHome ? HomeSkeleton
        : PAGE_SKELETONS.find(([path]) => (typeof path === 'function' ? path(pathname) : path.test(pathname)))?.[1] ?? ColumnSkeleton;
    return <Skeleton fade={fade} inert><Page /></Skeleton>;
}

// Signed out: the sign-in screen's shape (wordmark, the card with sign in | sign up, the footer)
export function GateSkeleton() {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    return (
        <Skeleton className={styles.screen} inert>
            <header className={styles.brand}>
                <span className={styles.wordmark}><Logo className={styles.logo} /> <span translate="no">Quidey</span></span>
                <span className={styles.about}>{t('whatIsQuidey')}</span>
            </header>
            <div className={styles.gateColumn}>
                <section className={styles.authCard}>
                    <Tabs active={pathname === '/signup' ? 'signUp' : 'signIn'} labels={[['signIn', t('signIn')], ['signUp', t('signUp')]]} />
                    {[0, 1].map(i => (
                        <div key={i} className={styles.field}><Bone w="9rem" h="0.75rem" /><Bone w="100%" className={styles.input} /></div>
                    ))}
                    <Bone pill w="100%" h="2.25rem" />
                </section>
            </div>
            <LegalFooter />
        </Skeleton>
    );
}
