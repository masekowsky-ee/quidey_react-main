import styles from './ProPage.module.css';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { fill, formatDate } from '../../features/helperFunction';
import { fetchAccess } from '../../features/auth/authAction';
import Icon from '../icons.jsx';
import {
    PRICES_BY_TIER, buyInPlay, fetchBilling, formatEuro, managePlaySubscription,
    openPortal, playPlans, playCanReplace, restorePlayPurchases, sellsThroughPlay, startCheckout, upgradeInPlay, yearlyPerMonth, yearlySaves, yearlySavesPercent,
} from '../../features/pro/pro';
import { CANCEL_PATH } from '../../legal/paths';

const FREE_ROWS = ['tasks', 'events', 'groups', 'sessions', 'friends', 'stats'];

// /pro: "Quidey unterstützen". Quidey Pro exists only so the development can go on; the page says
// so first, kindly, and makes clear that the free Quidey stays welcome. Then the two plans (the
// year saves 30 %), what Pro gives, the free plan beside it, and how to cancel.
// Web: Stripe; Android app: Google Play (its prices, its purchase, no word of another way).
export default function ProPage() {
    const { t, language } = useTranslation();
    const dispatch = useDispatch();
    const access = useSelector((state) => state.auth.access);
    const [params, setParams] = useSearchParams();
    const inApp = sellsThroughPlay();

    const [billing, setBilling] = useState(null);
    const [tier, setTier] = useState('pro');
    const [plan, setPlan] = useState('yearly');
    const [play, setPlay] = useState(null);
    const [canReplace, setCanReplace] = useState(false);
    const [busy, setBusy] = useState(false);
    // back from Stripe: ?checkout=done | cancelled
    const [checkout] = useState(() => params.get('checkout'));
    const [notice, setNotice] = useState(() => (checkout === 'cancelled' ? { ok: false, text: t('proCheckoutCancelled') }
        : checkout ? { ok: true, text: t('proCheckoutThanks') } : null)); // { ok, text }

    const load = () => fetchBilling().then(setBilling).catch(() => {});
    useEffect(() => { load(); }, []);
    useEffect(() => {
        if (inApp) playCanReplace().then(setCanReplace);
        if (inApp) Promise.all([playPlans('pro'), playPlans('max')]).then(([pro, max]) => setPlay({ pro, max }));
    }, [inApp]);

    // back from Stripe: the webhook may be a moment behind, so it looks a few times
    useEffect(() => {
        if (!checkout) return;
        setParams({}, { replace: true });
        if (checkout === 'cancelled') return;
        let tries = 0;
        const timer = setInterval(async () => {
            tries += 1;
            const status = await fetchBilling().catch(() => null);
            if (status) setBilling(status);
            if (status?.active || tries >= 10) {
                clearInterval(timer);
                dispatch(fetchAccess()).catch(() => {});
            }
        }, 2000);
        return () => clearInterval(timer);
        // once, for the address it came back with
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [checkout]);

    const active = Boolean(billing?.active ?? access.pro?.active);
    const subscription = billing?.subscription;
    // Max (Pro plus the AI assistant): on the web where Stripe has its prices, in the app where Google Play has its product
    const playMax = Boolean(play?.max && Object.keys(play.max).length > 0);
    const maxOffered = inApp ? playMax : !(billing && !billing.stripeMax);
    const tiers = maxOffered ? ['pro', 'max'] : ['pro'];
    const buyTier = maxOffered ? tier : 'pro';
    const canBuy = inApp ? Boolean(billing?.play && play?.[buyTier]?.[plan]) : Boolean(billing?.stripe && (buyTier === 'pro' || billing.stripeMax));
    const hasMax = billing ? billing.tier === 'max' : Boolean(access.max?.active);
    // a Pro subscriber can go up to Max where the subscription runs: on the web in place at Stripe (or a gift),
    // in the app as a replace purchase in Google Play (a gift: a plain Max purchase)
    const upgradePlan = subscription?.plan === 'monthly' ? 'monthly' : 'yearly';
    const canUpgrade = active && !hasMax && (inApp
        ? Boolean(billing?.play && play?.max?.[upgradePlan]) && (subscription ? subscription.provider === 'play' && canReplace : true)
        : Boolean(billing?.stripeMax) && (!subscription || subscription.provider === 'stripe'));

    const price = (which, forTier = 'pro') => (inApp ? play?.[forTier]?.[which]?.price ?? '…' : formatEuro(PRICES_BY_TIER[forTier][which], language));

    const buy = async () => {
        setBusy(true);
        setNotice(null);
        try {
            if (inApp) {
                const status = await buyInPlay(plan, play[buyTier][plan].offerToken, billing.playAccountId, buyTier);
                if (status) {
                    setBilling(status);
                    setNotice({ ok: true, text: t('proThanksTitle') });
                    await dispatch(fetchAccess()).catch(() => {});
                }
            } else {
                await startCheckout(plan, language, buyTier);
            }
        } catch (err) {
            await checkoutFailed(err);
        } finally {
            setBusy(false);
        }
    };

    // A checkout the server refuses: already subscribed (stale page, second tab) → the page is
    // brought up to date and flips to the thanks view; payments not set up → say so
    const checkoutFailed = async (err) => {
        if (err?.code === 'ALREADY_SUBSCRIBED') {
            await load();
            await dispatch(fetchAccess()).catch(() => {});
            return;
        }
        const key = err?.code === 'BILLING_DISABLED' ? 'proNotYet' : err?.code === 'NO_PRO_TOKEN' ? 'proUpgradeNoToken' : 'proError';
        setNotice({ ok: false, text: t(key) });
    };

    const upgrade = async () => {
        setBusy(true);
        setNotice(null);
        try {
            if (inApp) {
                const status = await upgradeInPlay(upgradePlan, play.max[upgradePlan].offerToken, billing.playAccountId, { hasPlayPro: subscription?.provider === 'play' });
                if (status) {
                    setBilling(status);
                    await dispatch(fetchAccess()).catch(() => {});
                    setNotice({ ok: true, text: t('proUpgradedMax') });
                }
                return;
            }
            const result = await startCheckout(upgradePlan, language, 'max');
            if (result?.upgraded) {
                await load();
                await dispatch(fetchAccess()).catch(() => {});
                setNotice({ ok: true, text: t('proUpgradedMax') });
            }
        } catch (err) {
            await checkoutFailed(err);
        } finally {
            setBusy(false);
        }
    };

    const manage = async () => {
        if (subscription?.provider === 'play') return managePlaySubscription(subscription.tier);
        setBusy(true);
        try { await openPortal(); } catch { setNotice({ ok: false, text: t('proError') }); setBusy(false); }
    };

    const restore = async () => {
        setBusy(true);
        const { found, accepted } = await restorePlayPurchases();
        await load();
        await dispatch(fetchAccess()).catch(() => {});
        setNotice(accepted ? { ok: true, text: t('proRestored') }
            : { ok: false, text: t(found ? 'proError' : 'proNothingToRestore') });
        setBusy(false);
    };

    return (
        <main className={styles.page}>
            <section className={styles.hero} aria-labelledby="proTitle">
                <span className={styles.heartWrap}><Icon name="heart" className={styles.heart} strokeWidth={1.8} /></span>
                <h1 id="proTitle" className={styles.title}>{t('proTitle')}</h1>
                <p className={styles.lead}>{t('proLead')}</p>
                <p className={styles.kind}>{t('proKind')}</p>
            </section>

            {notice && <p className={notice.ok ? styles.noticeOk : styles.noticeErr} role="status">{notice.text}</p>}

            {active ? (
                <section className={styles.thanks} aria-labelledby="proThanks">
                    <Icon name="heart" className={styles.thanksHeart} />
                    <h2 id="proThanks" className={styles.thanksTitle}>{t(hasMax ? 'proThanksMaxTitle' : 'proThanksTitle')}</h2>
                    <p className={styles.thanksText}>{t('proThanksText')}</p>
                    {subscription && (
                        <dl className={styles.facts}>
                            <div><dt>{t('proPlan')}</dt><dd>{`${subscription.tier === 'max' ? 'Max' : 'Pro'} · ${t(subscription.plan === 'yearly' ? 'proYearly' : 'proMonthly')}`}</dd></div>
                            <div>
                                <dt>{t(subscription.cancelAtPeriodEnd ? 'proEndsOn' : 'proRenewsOn')}</dt>
                                <dd>{formatDate(subscription.periodEnd)}</dd>
                            </div>
                        </dl>
                    )}
                    {billing?.gift && !subscription && <p className={styles.thanksText}>{t('proGift')}</p>}
                    {subscription && (subscription.provider === 'play' ? inApp : !inApp) && (
                        <button type="button" className={styles.secondary} onClick={manage} disabled={busy}>{t('proManage')}</button>
                    )}
                    {canUpgrade && (
                        <>
                            <p className={styles.small}>{t('proUpgradeMaxHint')}</p>
                            <button type="button" className={styles.cta} onClick={upgrade} disabled={busy} aria-busy={busy}>
                                {t('proUpgradeMax')} ({inApp ? play.max[upgradePlan].price : formatEuro(PRICES_BY_TIER.max[upgradePlan], language)}{t(upgradePlan === 'yearly' ? 'proPerYear' : 'proPerMonth')})
                            </button>
                        </>
                    )}
                    {subscription && subscription.provider === 'play' && !inApp && <p className={styles.small}>{t('proManageInPlay')}</p>}
                    {subscription && subscription.provider === 'stripe' && inApp && <p className={styles.small}>{t('proManageOnWeb')}</p>}
                </section>
            ) : (
                <section className={styles.plans} aria-label={t('proChoose')}>
                    {tiers.map((tierKey) => {
                        const selected = (which) => buyTier === tierKey && plan === which;
                        const choose = (which) => { setTier(tierKey); setPlan(which); };
                        const percent = yearlySavesPercent(tierKey);
                        const name = tierKey === 'max' ? 'Max' : 'Pro';
                        return (
                            <div key={tierKey} className={styles.tier}>
                                {maxOffered && (
                                    <div className={styles.tierHead}>
                                        <h2 className={styles.tierName}>{name}</h2>
                                        <p className={styles.tierNote}>{t(tierKey === 'max' ? 'proTierMaxNote' : 'proTierProNote')}</p>
                                    </div>
                                )}
                                <div className={styles.planGrid} role="radiogroup" aria-label={name}>
                                    <button type="button" role="radio" aria-checked={selected('yearly')}
                                        className={`${styles.plan} ${styles.planYearly}`} data-selected={selected('yearly')} onClick={() => choose('yearly')}>
                                        <span className={styles.saveBadge}>{fill(t('proSaveBadge'), { percent })}</span>
                                        <span className={styles.planName}>{t('proYearly')}</span>
                                        <span className={styles.price}>{price('yearly', tierKey)}<small>{t('proPerYear')}</small></span>
                                        {!inApp && <span className={styles.perMonth}>{fill(t('proYearlyPerMonth'), { price: formatEuro(yearlyPerMonth(tierKey), language) })}</span>}
                                        <span className={styles.saveLine}>
                                            {inApp ? fill(t('proSaveLineApp'), { percent })
                                                : fill(t('proSaveLine'), { amount: formatEuro(yearlySaves(tierKey), language), percent })}
                                        </span>
                                    </button>
                                    <button type="button" role="radio" aria-checked={selected('monthly')}
                                        className={styles.plan} data-selected={selected('monthly')} onClick={() => choose('monthly')}>
                                        <span className={styles.planName}>{t('proMonthly')}</span>
                                        <span className={styles.price}>{price('monthly', tierKey)}<small>{t('proPerMonth')}</small></span>
                                        <span className={styles.perMonth}>{t('proMonthlyNote')}</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    <ul className={styles.terms}>
                        <li>{t(plan === 'yearly' ? 'proTermRenewYear' : 'proTermRenewMonth')}</li>
                        <li>{t('proTermCancel')}</li>
                        {!inApp && <li>{t('proTermTax')}</li>}
                        <li>
                            {t('proTermLegalBefore')}
                            <Link to="/nutzungsbedingungen#pro">{t('termsLink')}</Link>
                            {t('proTermLegalMiddle')}
                            <Link to="/nutzungsbedingungen#widerruf">{t('proWithdrawalLink')}</Link>
                            {t('proTermLegalAfter')}
                        </li>
                    </ul>

                    <button type="button" className={styles.cta} onClick={buy} disabled={!canBuy || busy} aria-busy={busy}>
                        <Icon name="heart" className={styles.ctaIcon} />
                        {inApp ? t('proBuyPlay') : t('proBuyWeb')}
                    </button>
                    {billing && !canBuy && <p className={styles.small}>{t(inApp ? 'proNotInApp' : 'proNotYet')}</p>}
                    {!inApp && <p className={styles.small}>{t('proStripeNote')}</p>}
                    {inApp && <button type="button" className={styles.linkBtn} onClick={restore} disabled={busy}>{t('proRestore')}</button>}
                </section>
            )}

            <section className={styles.gives} aria-labelledby="proGives">
                <h2 id="proGives" className={styles.h2}>{t('proGivesTitle')}</h2>
                <ul className={styles.givesList}>
                    {access.accessMode === 'beta' && <li><Icon name="star" className={styles.giveIcon} />{t('proGivesBeta')}</li>}
                    <li><Icon name="checklist" className={styles.giveIcon} />{t('proGivesUnlimited')}</li>
                    <li><Icon name="history" className={styles.giveIcon} />{t('proGivesStats')}</li>
                    <li><Icon name="sprout" className={styles.giveIcon} />{t('proGivesFuture')}</li>
                    <li><Icon name="heart" className={styles.giveIcon} />{t('proGivesFeeling')}</li>
                </ul>
                <p className={styles.small}>{t('proNotTester')}</p>
            </section>

            <section className={styles.compare} aria-labelledby="proCompare">
                <h2 id="proCompare" className={styles.h2}>{t('proCompareTitle')}</h2>
                {access.accessMode === 'beta' && <p className={styles.small}>{t('proCompareBeta')}</p>}
                <table className={styles.table}>
                    <thead>
                        <tr><th scope="col"><span className={styles.srOnly}>{t('proCompareWhat')}</span></th><th scope="col">{t('proFree')}</th><th scope="col">Pro</th></tr>
                    </thead>
                    <tbody>
                        {FREE_ROWS.map((row) => (
                            <tr key={row}>
                                <th scope="row">{t(`proRow_${row}`)}</th>
                                <td>{t(`proFree_${row}`)}</td>
                                <td className={styles.proCell}>{t(row === 'stats' ? 'proAllStats' : 'proUnlimited')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            <section className={styles.faq} aria-labelledby="proFaq">
                <h2 id="proFaq" className={styles.h2}>{t('proFaqTitle')}</h2>
                {['money', 'cancel', 'after', 'free'].map((q) => (
                    <details key={q} className={styles.faqItem}>
                        <summary>{t(`proFaqQ_${q}`)}</summary>
                        <p>{t(`proFaqA_${q}`)}</p>
                    </details>
                ))}
            </section>

            {!inApp && (
                <p className={styles.cancelRow}>
                    <Link to={CANCEL_PATH} className={styles.cancelLink}>{t('cancelButtonLabel')}</Link>
                </p>
            )}
        </main>
    );
}
