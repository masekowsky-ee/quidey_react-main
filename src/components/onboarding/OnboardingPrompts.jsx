import styles from './Onboarding.module.css';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { closeOnboarding, sendRating, setOnboardingAccount, useOnboarding } from '../../features/onboarding/onboarding';
import { COMMUNITY_PATHS, friendsPath } from '../../features/community/paths';
import { showForms } from '../../features/settings/settingsAction';
import { fill } from '../../features/helperFunction';
import Icon from '../icons';

// The questions of a new account's first days (features/onboarding/onboarding.js): what first,
// after the tour; install Quidey?, after a few things done; do you like it?, after about ten.
// Mounted once in the app shell. Every yes is the lifted primary, every no grey (ui.module.css).
export default function OnboardingPrompts() {
    const username = useSelector((state) => state.auth.user?.username);
    const { asking } = useOnboarding();

    useEffect(() => { setOnboardingAccount(username); }, [username]);

    if (asking === 'next') return <NextSteps />;
    if (asking === 'install') return <InstallQuestion />;
    if (asking === 'rating') return <RatingQuestion />;
    return null;
}

// The centred card; Escape, a click beside it or the no closes it
function Card({ icon, title, text, children, wide = false }) {
    const titleId = useId();
    const textId = useId();
    const cardRef = useRef(null);

    useEffect(() => {
        const previous = document.activeElement;
        cardRef.current?.querySelector('button, textarea')?.focus();
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            e.preventDefault();
            e.stopPropagation();
            closeOnboarding();
        };
        window.addEventListener('keydown', onKey, true);
        return () => {
            window.removeEventListener('keydown', onKey, true);
            previous?.focus?.();
        };
    }, []);

    return createPortal(
        <div className={styles.backdrop} onPointerDown={(e) => { if (e.target === e.currentTarget) closeOnboarding(); }}>
            <div ref={cardRef} className={`${styles.dialog} ${wide ? styles.wide : ''}`} role="dialog" aria-modal="true"
                aria-labelledby={titleId} aria-describedby={text ? textId : undefined}>
                <span className={styles.badge} aria-hidden="true"><Icon name={icon} size={20} /></span>
                <h2 id={titleId} className={styles.title}>{title}</h2>
                {text && <p id={textId} className={styles.text}>{text}</p>}
                {children}
            </div>
        </div>,
        document.body
    );
}

// what a new account can do first; `newTask` opens the form, `to` a page
const FIRST_THINGS = [
    { id: 'task', icon: 'plus', newTask: true },
    { id: 'friends', icon: 'social', to: friendsPath('add') },
    { id: 'session', icon: 'together', to: COMMUNITY_PATHS.sessions },
    { id: 'calendar', icon: 'calendar', to: '/calendar' },
    { id: 'profile', icon: 'profile', to: '/profile' },
];

function NextSteps() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const pick = (thing) => {
        closeOnboarding();
        if (thing.newTask) dispatch(showForms(true));
        else navigate(thing.to);
    };

    return (
        <Card icon="sprout" title={t('onbNextTitle')} text={t('onbNextText')} wide>
            <ul className={styles.choices}>
                {FIRST_THINGS.map((thing) => (
                    <li key={thing.id}>
                        <button type="button" className={styles.choice} onClick={() => pick(thing)}>
                            <span className={styles.choiceIcon} aria-hidden="true"><Icon name={thing.icon} size={18} /></span>
                            <span className={styles.choiceText}>
                                <span className={styles.choiceLabel}>{t(`onbNext_${thing.id}`)}</span>
                                <span className={styles.choiceHint}>{t(`onbNextHint_${thing.id}`)}</span>
                            </span>
                            <Icon name="arrowRight" size={16} className={styles.choiceArrow} />
                        </button>
                    </li>
                ))}
            </ul>
            <button type="button" className={styles.no} onClick={closeOnboarding}>{t('onbNextLookAround')}</button>
        </Card>
    );
}

function InstallQuestion() {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const yes = () => {
        closeOnboarding();
        navigate('/settings#app');
    };

    return (
        <Card icon="download" title={t('onbInstallTitle')} text={t('onbInstallText')}>
            <div className={styles.answers}>
                <button type="button" className={styles.yes} onClick={yes}>
                    <Icon name="download" size={18} />{t('onbInstallYes')}
                </button>
                <button type="button" className={styles.no} onClick={closeOnboarding}>{t('onbInstallNo')}</button>
            </div>
        </Card>
    );
}

const STARS = [1, 2, 3, 4, 5];

// "Gefällt dir Quidey?" → yes: stars (and a word, if they like); not really: what isn't good yet.
// Sent as feedback (category "rating"), then a thank you.
function RatingQuestion() {
    const { t } = useTranslation();
    // 'ask' | 'stars' | 'feedback' | 'thanks'
    const [step, setStep] = useState('ask');
    const [stars, setStars] = useState(0);
    const [hovered, setHovered] = useState(0);
    const [message, setMessage] = useState('');
    const [state, setState] = useState({ sending: false, error: '' });

    const send = async (e) => {
        e.preventDefault();
        const liked = step === 'stars';
        if (liked && !stars) return;
        if (!liked && message.trim().length < 5) {
            setState({ sending: false, error: t('feedbackError_INVALID_MESSAGE') });
            return;
        }
        setState({ sending: true, error: '' });
        try {
            await sendRating({ liked, stars, message: message.trim() });
            setStep('thanks');
        } catch (err) {
            const key = `feedbackError_${err?.code}`;
            setState({ sending: false, error: t(key) !== key ? t(key) : t('feedbackError_generic') });
        }
    };

    if (step === 'ask') {
        return (
            <Card key="ask" icon="star" title={t('onbRateTitle')} text={t('onbRateText')}>
                <div className={styles.answers}>
                    <button type="button" className={styles.yes} onClick={() => setStep('stars')}>
                        <Icon name="star" size={18} />{t('onbRateYes')}
                    </button>
                    <button type="button" className={styles.no} onClick={() => setStep('feedback')}>{t('onbRateNo')}</button>
                </div>
            </Card>
        );
    }

    if (step === 'thanks') {
        return (
            <Card key="thanks" icon="check" title={t('onbRateThanks')} text={t(stars ? 'onbRateThanksStars' : 'onbRateThanksFeedback')}>
                <div className={styles.answers}>
                    <button type="button" className={styles.yes} onClick={closeOnboarding}>{t('onbRateClose')}</button>
                </div>
            </Card>
        );
    }

    const liked = step === 'stars';
    const shown = hovered || stars;
    return (
        <Card key={step} icon={liked ? 'star' : 'feedback'} title={t(liked ? 'onbStarsTitle' : 'onbFeedbackTitle')}
            text={t(liked ? 'onbStarsText' : 'onbFeedbackText')}>
            <form className={styles.form} onSubmit={send}>
                {liked && (
                    <div className={styles.stars} role="radiogroup" aria-label={t('onbStarsTitle')} onPointerLeave={() => setHovered(0)}>
                        {STARS.map((n) => (
                            <button key={n} type="button" role="radio" aria-checked={stars === n}
                                aria-label={fill(t(n === 1 ? 'onbStar' : 'onbStars'), { n })}
                                className={`${styles.star} ${n <= shown ? styles.starOn : ''}`}
                                onPointerEnter={() => setHovered(n)} onClick={() => setStars(n)}>
                                <Icon name="star" size={30} />
                            </button>
                        ))}
                    </div>
                )}
                <label className={styles.label} htmlFor="onboardingMessage">{t(liked ? 'onbStarsMessage' : 'onbFeedbackMessage')}</label>
                <textarea id="onboardingMessage" className={styles.message} rows={liked ? 3 : 5} maxLength={5000} value={message}
                    onChange={(e) => { setMessage(e.target.value); setState((s) => ({ ...s, error: '' })); }} />
                {state.error && <p className={styles.error} role="alert">{state.error}</p>}
                <div className={styles.answers}>
                    <button type="submit" className={styles.yes} disabled={state.sending || (liked && !stars)}>
                        <Icon name="check" size={18} />{t(state.sending ? 'feedbackSending' : 'onbRateSend')}
                    </button>
                    <button type="button" className={styles.no} onClick={closeOnboarding}>{t('onbRateSkip')}</button>
                </div>
            </form>
        </Card>
    );
}
