import styles from './Admin.module.css';
import { fetchBroadcasts, sendBroadcast } from '../features/inbox/inbox';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../i18n/useTranslation';
import { displayName, fill, formatDate, formatRelative, getInitials } from '../features/helperFunction';
import { showToast } from '../features/toast/toast';
import {
    fetchAdminOverview, fetchBetaRequests, fetchAdminUsers, fetchAdminUsersExport,
    decideBetaRequest, resetBetaRequest, updateAdminUser, adminErrorText,
} from '../features/admin/adminAction';
import AdminUsage from './admin/AdminUsage';
import AdminUserDetail from './admin/AdminUserDetail';
import { downloadCsv, downloadXlsx } from '../features/admin/exportTable';
import { userSheet, usersFileBase } from '../features/admin/userSheet';
import Icon from './icons.jsx';
import AdminTesterFeedback from './tester/AdminTesterFeedback';
import { removeAvatarOf } from '../features/profile/avatars';
import { Bone, Skeleton, SkeletonRows } from './skeleton/Skeleton.jsx';

const TABS = ['requests', 'users', 'broadcast', 'testers', 'overview', 'usage'];
const SEARCH_DELAY_MS = 300;
const PAGE_SIZE = 50;
const SORTS = ['newest', 'oldest', 'name'];

// run(action, successKey) dispatches, shows a toast either way, resolves to the result or null
function useAdminRun() {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    return useCallback(async (action, successKey, values = {}) => {
        try {
            const result = await dispatch(action);
            if (successKey) dispatch(showToast(fill(t(successKey), values), 'success'));
            return result;
        } catch (err) {
            dispatch(showToast(adminErrorText(t, err), 'error'));
            return null;
        }
    }, [dispatch, t]);
}

// onOpen: the person area becomes a button (the users list opens the detail sheet with it)
function Person({ user, onOpen }) {
    const inner = (
        <>
            <span className={styles.avatar} aria-hidden="true">{getInitials(displayName(user))}</span>
            <span className={styles.who}>
                <span className={styles.name}>{displayName(user)}</span>
                <span className={styles.meta}>@{user.username}{user.email && ` · ${user.email}`}</span>
            </span>
        </>
    );
    return onOpen
        ? <button type="button" className={styles.personBtn} onClick={onOpen}>{inner}</button>
        : <div className={styles.person}>{inner}</div>;
}

function StatusChip({ status, t }) {
    return <span className={styles[`chip_${status}`] ?? styles.chip}>{t(`requestStatus_${status}`)}</span>;
}

// ---------- requests ----------

function RequestsTab() {
    const { t, language } = useTranslation();
    const dispatch = useDispatch();
    const run = useAdminRun();
    const locale = language === 'de' ? 'de-DE' : 'en-GB';
    const [scope, setScope] = useState('pending');
    const [requests, setRequests] = useState(null);
    const [busyId, setBusyId] = useState(null);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        let cancelled = false;
        dispatch(fetchBetaRequests(scope))
            .then(list => { if (!cancelled) { setRequests(list); setNow(Date.now()); } })
            .catch(err => { if (!cancelled) { setRequests([]); dispatch(showToast(adminErrorText(t, err), 'error')); } });
        return () => { cancelled = true; };
    // t only changes with the language
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, scope]);

    // replaces the user in the list, or drops them when only open requests are shown
    const apply = (updated) => setRequests(list => scope === 'pending' && updated.request?.status !== 'pending'
        ? list.filter(u => u.id !== updated.id)
        : list.map(u => (u.id === updated.id ? updated : u)));

    const act = async (user, action, successKey) => {
        setBusyId(user.id);
        const updated = await run(action, successKey, { name: displayName(user) });
        if (updated) apply(updated);
        setBusyId(null);
    };

    return (
        <section className={styles.card} role="tabpanel" aria-label={t('adminRequests')}>
            <div className={styles.cardHead}>
                <h2 className={styles.cardTitle}>{t('adminRequests')}</h2>
                <div className={styles.segmented} role="group" aria-label={t('filter')}>
                    {['pending', 'all'].map(key => (
                        <button key={key} className={scope === key ? styles.segmentActive : undefined} aria-pressed={scope === key} onClick={() => setScope(key)}>
                            {t(key === 'pending' ? 'adminOpenRequests' : 'adminAllRequests')}
                        </button>
                    ))}
                </div>
            </div>
            {requests === null ? <SkeletonRows count={3} />
                : requests.length === 0 ? <p className={styles.empty}>{t(scope === 'pending' ? 'adminNoOpenRequests' : 'adminNoRequests')}</p>
                    : (
                        <ul className={styles.list}>
                            {requests.map(user => (
                                <li key={user.id} className={styles.request}>
                                    <div className={styles.requestHead}>
                                        <Person user={user} />
                                        <StatusChip status={user.request.status} t={t} />
                                    </div>
                                    <blockquote className={styles.reason}>{user.request.reason}</blockquote>
                                    <div className={styles.requestFoot}>
                                        <span className={styles.meta}>
                                            {t('adminAsked')} {formatRelative(user.request.createdAt, now, locale)}
                                            {user.isPro && ` · ${t('adminHasPro')}`}
                                        </span>
                                        <div className={styles.actions}>
                                            {user.request.status === 'pending' ? (
                                                <>
                                                    <button className={styles.quietDanger} disabled={busyId === user.id}
                                                        onClick={() => act(user, decideBetaRequest(user.id, 'decline'), 'adminToastDeclined')}>
                                                        {t('decline')}
                                                    </button>
                                                    <button className={styles.primaryBtn} disabled={busyId === user.id}
                                                        onClick={() => act(user, decideBetaRequest(user.id, 'approve'), 'adminToastApproved')}>
                                                        {t('adminApprove')}
                                                    </button>
                                                </>
                                            ) : (
                                                <button className={styles.quietBtn} disabled={busyId === user.id} title={t('adminResetHint')}
                                                    onClick={() => act(user, resetBetaRequest(user.id), 'adminToastReset')}>
                                                    {t('adminReset')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
        </section>
    );
}

// ---------- users ----------

function UsersTab() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const run = useAdminRun();
    const myName = useSelector(state => state.auth.user?.username);
    const { language } = useTranslation();
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState('newest');
    const [users, setUsers] = useState(null);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loadingMore, setLoadingMore] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [detail, setDetail] = useState(null);
    const [busyId, setBusyId] = useState(null);
    const [confirm, setConfirm] = useState(null); // { id, isAdmin } waiting for "really?"

    // searches as you type, a moment after the last key; a new search or sort starts at page 1
    useEffect(() => {
        let cancelled = false;
        const timeout = setTimeout(() => {
            dispatch(fetchAdminUsers({ q: query, sort, page: 1, pageSize: PAGE_SIZE }))
                .then(result => { if (!cancelled) { setUsers(result.users); setTotal(result.total); setPage(1); } })
                .catch(err => { if (!cancelled) { setUsers([]); setTotal(0); dispatch(showToast(adminErrorText(t, err), 'error')); } });
        }, query ? SEARCH_DELAY_MS : 0);
        return () => { cancelled = true; clearTimeout(timeout); };
    // t only changes with the language
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, query, sort]);

    const loadMore = async () => {
        setLoadingMore(true);
        try {
            const result = await dispatch(fetchAdminUsers({ q: query, sort, page: page + 1, pageSize: PAGE_SIZE }));
            setUsers(list => [...list, ...result.users.filter(u => !list.some(x => x.id === u.id))]);
            setTotal(result.total);
            setPage(page + 1);
        } catch (err) {
            dispatch(showToast(adminErrorText(t, err), 'error'));
        } finally {
            setLoadingMore(false);
        }
    };

    // every account, not only the pages loaded; the sheet has no secrets (userSheet.js)
    const exportUsers = async (kind) => {
        setExporting(true);
        try {
            const { users: all } = await dispatch(fetchAdminUsersExport());
            const sheet = userSheet(all, t);
            const base = usersFileBase();
            if (kind === 'xlsx') await downloadXlsx([sheet], `${base}.xlsx`);
            else downloadCsv(sheet, language, `${base}.csv`);
        } catch (err) {
            dispatch(showToast(adminErrorText(t, err), 'error'));
        } finally {
            setExporting(false);
        }
    };

    const change = async (user, changes, successKey) => {
        setConfirm(null);
        setBusyId(user.id);
        const updated = await run(updateAdminUser(user.id, changes), successKey, { name: displayName(user) });
        if (updated) setUsers(list => list.map(u => (u.id === updated.id ? updated : u)));
        setBusyId(null);
    };

    return (
        <section className={styles.card} role="tabpanel" aria-label={t('adminUsers')}>
            <div className={styles.cardHead}>
                <h2 className={styles.cardTitle}>{t('adminUsers')}</h2>
                <input
                    type="search"
                    className={styles.search}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('adminSearch')}
                    aria-label={t('adminSearch')}
                />
            </div>
            <div className={styles.userTools}>
                <select className={styles.sortSelect} value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t('adminSort')}>
                    {SORTS.map(key => <option key={key} value={key}>{t(`adminSort${key[0].toUpperCase()}${key.slice(1)}`)}</option>)}
                </select>
                {users !== null && <span className={styles.meta}>{fill(t('adminCount'), { n: total })}</span>}
                <div className={styles.exports} role="group" aria-label={t('adminUsageExport')}>
                    <button type="button" className={styles.exportBtn} disabled={exporting} onClick={() => exportUsers('xlsx')}>
                        <Icon name="download" size={16} />{t('adminUsageExcel')}
                    </button>
                    <button type="button" className={styles.exportBtn} disabled={exporting} onClick={() => exportUsers('csv')}>
                        {t('adminUsageCsv')}
                    </button>
                </div>
            </div>
            {users === null ? <SkeletonRows count={5} />
                : users.length === 0 ? <p className={styles.empty}>{t('adminNoUsers')}</p>
                    : (
                        <ul className={styles.list}>
                            {users.map(user => {
                                const isMe = user.username === myName;
                                const busy = busyId === user.id;
                                return (
                                    <li key={user.id} className={styles.userRow}>
                                        <Person user={user} onOpen={() => setDetail(user)} />
                                        <div className={styles.userInfo}>
                                            {user.isAdmin && <span className={styles.chip_admin}>{t('adminRoleAdmin')}</span>}
                                            {user.isTester && <span className={styles.chip_tester}>{t('adminRoleTester')}</span>}
                                            {user.request && <StatusChip status={user.request.status} t={t} />}
                                            {user.hasAvatar &&
                                                <button type="button" className={styles.quietBtn} disabled={busy}
                                                    onClick={() => run(async () => { await removeAvatarOf(user.id); setUsers(prev => prev.map(u => u.id === user.id ? { ...u, hasAvatar: false } : u)); }, 'adminToastAvatarRemoved')}>
                                                    {t('adminRemoveAvatar')}
                                                </button>}
                                            <span className={styles.meta}>{t('adminJoined')} {formatDate(user.createdAt)}</span>
                                        </div>
                                        {isMe ? <span className={styles.meta}>{t('adminThisIsYou')}</span> : confirm?.id === user.id ? (
                                            <div className={styles.actions}>
                                                <span className={styles.confirmText}>{t(confirm.isAdmin ? 'adminConfirmMakeAdmin' : 'adminConfirmRemoveAdmin')}</span>
                                                <button className={styles.dangerBtn} disabled={busy}
                                                    onClick={() => change(user, { isAdmin: confirm.isAdmin }, confirm.isAdmin ? 'adminToastAdminGranted' : 'adminToastAdminRevoked')}>
                                                    {t('adminYes')}
                                                </button>
                                                <button className={styles.quietBtn} onClick={() => setConfirm(null)}>{t('cancel')}</button>
                                            </div>
                                        ) : (
                                            <div className={styles.actions}>
                                                <button
                                                    role="switch"
                                                    aria-checked={user.isPro}
                                                    className={user.isPro ? styles.toggleOn : styles.toggle}
                                                    disabled={busy}
                                                    onClick={() => change(user, { isPro: !user.isPro }, user.isPro ? 'adminToastProRevoked' : 'adminToastProGranted')}
                                                >
                                                    <span className={styles.toggleKnob} aria-hidden="true" /> {t('adminProGift')}
                                                </button>
                                                {/* a paid subscription (Stripe / Google Play), not switchable here */}
                                                {user.proUntil && new Date(user.proUntil) > new Date() && (
                                                    <span className={styles.meta}>{fill(t('adminProPaidUntil'), { date: formatDate(user.proUntil) })}</span>
                                                )}
                                                <button
                                                    role="switch"
                                                    aria-checked={user.isTester}
                                                    className={user.isTester ? styles.toggleOn : styles.toggle}
                                                    disabled={busy}
                                                    onClick={() => change(user, { isTester: !user.isTester }, user.isTester ? 'adminToastTesterRevoked' : 'adminToastTesterGranted')}
                                                >
                                                    <span className={styles.toggleKnob} aria-hidden="true" /> Tester
                                                </button>
                                                <button
                                                    role="switch"
                                                    aria-checked={user.isAdmin}
                                                    className={user.isAdmin ? styles.toggleOn : styles.toggle}
                                                    disabled={busy}
                                                    onClick={() => setConfirm({ id: user.id, isAdmin: !user.isAdmin })}
                                                >
                                                    <span className={styles.toggleKnob} aria-hidden="true" /> Admin
                                                </button>
                                                {user.request && user.request.status !== 'pending' && (
                                                    <button className={styles.quietBtn} disabled={busy} title={t('adminResetHint')}
                                                        onClick={async () => {
                                                            setBusyId(user.id);
                                                            const updated = await run(resetBetaRequest(user.id), 'adminToastReset', { name: displayName(user) });
                                                            if (updated) setUsers(list => list.map(u => (u.id === updated.id ? updated : u)));
                                                            setBusyId(null);
                                                        }}>
                                                        {t('adminReset')}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
            {users !== null && users.length < total && (
                <button type="button" className={styles.loadMore} disabled={loadingMore} onClick={loadMore}>{t('adminLoadMore')}</button>
            )}
            <p className={styles.footnote}>{t('adminSelfNote')}</p>
            {detail && <AdminUserDetail user={detail} onClose={() => setDetail(null)} />}
        </section>
    );
}

// ---------- overview ----------

function OverviewTab() {
    const { t, language } = useTranslation();
    const dispatch = useDispatch();
    const locale = language === 'de' ? 'de-DE' : 'en-GB';
    const [data, setData] = useState(null);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        let cancelled = false;
        dispatch(fetchAdminOverview())
            .then(overview => { if (!cancelled) { setData(overview); setNow(Date.now()); } })
            .catch(err => { if (!cancelled) dispatch(showToast(adminErrorText(t, err), 'error')); });
        return () => { cancelled = true; };
    // t only changes with the language
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch]);

    if (!data) {
        return (
            <Skeleton style={{ display: 'contents' }}>
                <div className={styles.stats}>
                    {[0, 1, 2, 3, 4, 5].map(i => (
                        <div key={i} className={styles.stat}><Bone w="2.5rem" h="1.6rem" /><Bone w="60%" h="0.8rem" style={{ marginTop: '0.35rem' }} /></div>
                    ))}
                </div>
                <section className={styles.card}><Bone w="8rem" h="1.1rem" /><SkeletonRows count={4} avatar={false} /></section>
            </Skeleton>
        );
    }

    const stats = [
        ['users', data.users], ['adminStatAccess', data.withAccess], ['adminStatPending', data.pendingRequests],
        ['adminStatNew', data.newThisWeek], ['adminStatAdmins', data.admins], ['adminStatTesters', data.testers],
        ['adminStatSessions', data.openSharedSessions],
    ];
    return (
        <>
            <div className={styles.stats} role="tabpanel" aria-label={t('adminOverview')}>
                {stats.map(([label, value]) => (
                    <div key={label} className={styles.stat}>
                        <span className={styles.statValue}>{value}</span>
                        <span className={styles.statLabel}>{t(label === 'users' ? 'adminStatUsers' : label)}</span>
                    </div>
                ))}
            </div>
            <section className={styles.card}>
                <h2 className={styles.cardTitle}>{t('adminLog')}</h2>
                {data.actions.length === 0 ? <p className={styles.empty}>{t('adminNoActions')}</p> : (
                    <ol className={styles.log}>
                        {data.actions.map(entry => (
                            <li key={entry.id}>
                                <span>{fill(t(`adminAction_${entry.action}`), { admin: entry.admin, target: entry.target })}</span>
                                <time className={styles.meta} dateTime={entry.createdAt}>{formatRelative(entry.createdAt, now, locale)}</time>
                            </li>
                        ))}
                    </ol>
                )}
            </section>
        </>
    );
}

// A notice to every account, or only to the testers (and admins): it lands in their inbox under
// "Notices". Written, then confirmed in a second step, because it can't be taken back.
const AUDIENCES = ['all', 'testers'];
const AUDIENCE_KEYS = {
    all: { label: 'adminAudienceAll', hint: 'adminBroadcastHint', send: 'adminBroadcastSend', confirm: 'adminBroadcastConfirm' },
    testers: { label: 'adminAudienceTesters', hint: 'adminBroadcastHintTesters', send: 'adminBroadcastSendTesters', confirm: 'adminBroadcastConfirmTesters' },
};

function BroadcastTab() {
    const { t, language } = useTranslation();
    const dispatch = useDispatch();
    const locale = language === 'de' ? 'de-DE' : 'en-GB';
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [audience, setAudience] = useState('all');
    const [confirming, setConfirming] = useState(false);
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(null);

    useEffect(() => {
        fetchBroadcasts().then(setSent).catch(err => dispatch(showToast(adminErrorText(t, err), 'error')));
    // t only changes with the language
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch]);

    const ready = title.trim() && body.trim();
    const send = async () => {
        setSending(true);
        try {
            const result = await sendBroadcast(title.trim(), body.trim(), audience);
            dispatch(showToast(fill(t('adminBroadcastSent'), { count: result.recipientCount }), 'success'));
            setSent(prev => [{ id: result.id, title: title.trim(), body: body.trim(), audience, recipientCount: result.recipientCount, createdAt: result.createdAt }, ...(prev ?? [])]);
            setTitle('');
            setBody('');
            setConfirming(false);
        } catch (err) {
            dispatch(showToast(adminErrorText(t, err), 'error'));
        } finally {
            setSending(false);
        }
    };

    return (
        <>
            <section className={styles.card} role="tabpanel" aria-label={t('adminBroadcast')}>
                <h2 className={styles.cardTitle}>{t('adminBroadcast')}</h2>
                <p className={styles.meta}>{t(AUDIENCE_KEYS[audience].hint)}</p>
                <form className={styles.broadcastForm} onSubmit={(e) => { e.preventDefault(); if (ready) setConfirming(true); }}>
                    <div className={styles.field}>
                        <span id="broadcast-audience">{t('adminBroadcastTo')}</span>
                        <div className={styles.segmented} role="group" aria-labelledby="broadcast-audience">
                            {AUDIENCES.map(key => (
                                <button key={key} type="button" className={audience === key ? styles.segmentActive : undefined} aria-pressed={audience === key}
                                    onClick={() => { setAudience(key); setConfirming(false); }}>
                                    {t(AUDIENCE_KEYS[key].label)}
                                </button>
                            ))}
                        </div>
                    </div>
                    <label className={styles.field}>
                        <span>{t('adminBroadcastTitle')}</span>
                        <input value={title} maxLength={120} onChange={(e) => { setTitle(e.target.value); setConfirming(false); }} />
                    </label>
                    <label className={styles.field}>
                        <span>{t('adminBroadcastBody')}</span>
                        <textarea rows={5} value={body} maxLength={2000} onChange={(e) => { setBody(e.target.value); setConfirming(false); }} />
                    </label>
                    {confirming ? (
                        <div className={styles.actions}>
                            <span className={styles.confirmText}>{t(AUDIENCE_KEYS[audience].confirm)}</span>
                            <button type="button" className={styles.primaryBtn} disabled={sending} onClick={send}>{t('adminBroadcastSendNow')}</button>
                            <button type="button" className={styles.quietBtn} onClick={() => setConfirming(false)}>{t('cancel')}</button>
                        </div>
                    ) : (
                        <div className={styles.actions}>
                            <button type="submit" className={styles.primaryBtn} disabled={!ready}>{t(AUDIENCE_KEYS[audience].send)}</button>
                        </div>
                    )}
                </form>
            </section>
            <section className={styles.card}>
                <h2 className={styles.cardTitle}>{t('adminBroadcastsSent')}</h2>
                {!sent ? <SkeletonRows count={3} avatar={false} />
                    : sent.length === 0 ? <p className={styles.empty}>{t('adminNoBroadcasts')}</p> : (
                        <ul className={styles.list}>
                            {sent.map(item => (
                                <li key={item.id} className={styles.broadcast}>
                                    <span className={styles.broadcastHead}>
                                        <span className={styles.name}>{item.title}</span>
                                        {item.audience === 'testers' && <span className={styles.chip_tester}>{t('adminAudienceTesters')}</span>}
                                    </span>
                                    <span className={styles.meta}>
                                        {new Date(item.createdAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}
                                        {' · '}{fill(t('adminBroadcastReach'), { count: item.recipientCount })}
                                        {item.admin && ` · ${item.admin}`}
                                    </span>
                                    <p className={styles.broadcastBody}>{item.body}</p>
                                </li>
                            ))}
                        </ul>
                    )}
            </section>
        </>
    );
}

// Admins only (the route checks isAdmin; the server checks it again on every request)
export default function Admin() {
    const { t } = useTranslation();
    const pendingCount = useSelector(state => state.auth.access.adminPendingCount);
    const [searchParams, setSearchParams] = useSearchParams();
    const tab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'requests';
    const setTab = (next) => setSearchParams(next === 'requests' ? {} : { tab: next }, { replace: true });
    // on a phone the tabs scroll sideways: the open one is moved into view
    const tabList = useRef(null);
    useEffect(() => {
        tabList.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }, [tab]);

    return (
        <div className={styles.page}>
            <h1 className={styles.title}>{t('admin')}</h1>
            <div className={styles.tabs} role="tablist" aria-label={t('admin')} ref={tabList}>
                {TABS.map(key => (
                    <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? styles.tabActive : undefined} onClick={() => setTab(key)}>
                        {t({ requests: 'adminRequests', users: 'adminUsers', broadcast: 'adminBroadcast', testers: 'adminTesterFeedback', overview: 'adminOverview', usage: 'adminUsage' }[key])}
                        {key === 'requests' && pendingCount > 0 && <span className={styles.badge}>{pendingCount}</span>}
                    </button>
                ))}
            </div>
            {tab === 'requests' && <RequestsTab />}
            {tab === 'users' && <UsersTab />}
            {tab === 'broadcast' && <BroadcastTab />}
            {tab === 'testers' && <AdminTesterFeedback />}
            {tab === 'overview' && <OverviewTab />}
            {tab === 'usage' && <AdminUsage />}
        </div>
    );
}
