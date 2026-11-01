import styles from './ProPage.module.css';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { fill, formatDate } from '../../features/helperFunction';
import { fetchAccess } from '../../features/auth/authAction';
import Icon from '../icons.jsx';
import {
    PRICES, YEARLY_PER_MONTH, YEARLY_SAVES, YEARLY_SAVES_PERCENT, buyInPlay, fetchBilling, formatEuro, managePlaySubscription,
    openPortal, playPlans, restorePlayPurchases, sellsThroughPlay, startCheckout,
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
    const [plan, setPlan] = useState('yearly');
    const [play, setPlay] = useState(null);
    const [busy, setBusy] = useState(false);
    // back from Stripe: ?checkout=done | cancelled
    const [checkout] = useState(() => params.get('checkout'));
    const [notice, setNotice] = useState(() => (checkout === 'cancelled' ? { ok: false, text: t('proCheckoutCancelled') }
        : checkout ? { ok: true, text: t('proCheckoutThanks') } : null)); // { ok, text }

    const load = () => fetchBilling().then(setBilling).catch(() => {});
    useEffect(() => { load(); }, []);
    useEffect(() => {
        if (inApp) playPlans().then(setPlay);
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
    const canBuy = inApp ? Boolean(billing?.play && play?.[plan]) : Boolean(billing?.stripe);

    const price = (which) => (inApp ? play?.[which]?.price ?? '…' : formatEuro(PRICES[which], language));

    const buy = async () => {
        setBusy(true);
        setNotice(null);
        try {
            if (inApp) {
                const status = await buyInPlay(plan, play[plan].offerToken, billing.playAccountId);
                if (status) {
                    setBilling(status);
                    setNotice({ ok: true, text: t('proThanksTitle') });
                    await dispatch(fetchAccess()).catch(() => {});
                }
            } else {
                await startCheckout(plan, language);
            }
        } catch {
            setNotice({ ok: false, text: t('proError') });
        } finally {
            setBusy(false);
        }
    };

    const manage = async () => {
        if (subscription?.provider === 'play') return managePlaySubscription();
        setBusy(true);
        try { await openPortal(); } catch { setNotice({ ok: false, text: t('proError') }); setBusy(false); }
    };

    const restore = async () => {
        setBusy(true);
        const found = await restorePlayPurchases();
        await load();
        await dispatch(fetchAccess()).catch(() => {});
        setNotice(found ? { ok: true, text: t('proRestored') } : { ok: false, text: t('proNothingToRestore') });
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
                    <h2 id="proThanks" className={styles.thanksTitle}>{t('proThanksTitle')}</h2>
                    <p className={styles.thanksText}>{t('proThanksText')}</p>
                    {subscription && (
                        <dl className={styles.facts}>
                            <div><dt>{t('proPlan')}</dt><dd>{t(subscription.plan === 'yearly' ? 'proYearly' : 'proMonthly')}</dd></div>
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
                    {subscription && subscription.provider === 'play' && !inApp && <p className={styles.small}>{t('proManageInPlay')}</p>}
                    {subscription && subscription.provider === 'stripe' && inApp && <p className={styles.small}>{t('proManageOnWeb')}</p>}
                </section>
            ) : (
                <section className={styles.plans} aria-label={t('proChoose')}>
                    <div className={styles.planGrid} role="radiogroup" aria-label={t('proChoose')}>
                        <button type="button" role="radio" aria-checked={plan === 'yearly'}
                            className={`${styles.plan} ${styles.planYearly}`} data-selected={plan === 'yearly'} onClick={() => setPlan('yearly')}>
                            <span className={styles.saveBadge}>{fill(t('proSaveBadge'), { percent: YEARLY_SAVES_PERCENT })}</span>
                            <span className={styles.planName}>{t('proYearly')}</span>
                            <span className={styles.price}>{price('yearly')}<small>{t('proPerYear')}</small></span>
                            {!inApp && <span className={styles.perMonth}>{fill(t('proYearlyPerMonth'), { price: formatEuro(YEARLY_PER_MONTH, language) })}</span>}
                            <span className={styles.saveLine}>
                                {inApp ? fill(t('proSaveLineApp'), { percent: YEARLY_SAVES_PERCENT })
                                    : fill(t('proSaveLine'), { amount: formatEuro(YEARLY_SAVES, language), percent: YEARLY_SAVES_PERCENT })}
                            </span>
                        </button>
                        <button type="button" role="radio" aria-checked={plan === 'monthly'}
                            className={styles.plan} data-selected={plan === 'monthly'} onClick={() => setPlan('monthly')}>
                            <span className={styles.planName}>{t('proMonthly')}</span>
                            <span className={styles.price}>{price('monthly')}<small>{t('proPerMonth')}</small></span>
                            <span className={styles.perMonth}>{t('proMonthlyNote')}</span>
                        </button>
                    </div>

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
