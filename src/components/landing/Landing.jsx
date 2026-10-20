import styles from './Landing.module.css';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'motion/react';
import { LANDING_COPY } from './landingCopy';
import { setLanguage } from '../../features/settings/settingsAction';
import { useMotionLevel } from '../../features/settings/motion';
import { COPYRIGHT_YEAR } from '../../legal/owner';
import Logo from '../Logo';
import Profile from '../profile';

// The Remotion player only loads with the page's first screen, not with the app
const FocusLoopPlayer = lazy(() => import('./FocusLoopPlayer'));

const EASE = [0.32, 0.72, 0, 1];

// The app's colour themes (dark mode values), for the colour picker in the last feature
const ACCENTS = {
    sunset: ['#fb923c', '#2a1305'],
    green: ['#4ade80', '#052e16'],
    ocean: ['#38bdf8', '#082f49'],
    rose: ['#fb7185', '#2b0a12'],
    gold: ['#facc15', '#2a2100'],
};

// Parts of a section come in one after another as it scrolls into view: heading, text, picture.
// On "minimal" motion everything is simply there.
function useReveal() {
    const level = useMotionLevel();
    return (order = 0) => level === 'minimal' ? {} : {
        initial: { opacity: 0, y: level === 'extreme' ? 48 : 24 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '0px 0px -12% 0px' },
        transition: { duration: level === 'extreme' ? 0.8 : 0.55, ease: EASE, delay: order * 0.075 },
    };
}

// a live countdown for the pieces of the app, looping
function useCountdown(start) {
    const [seconds, setSeconds] = useState(start);
    useEffect(() => {
        const timer = setInterval(() => setSeconds(s => (s <= 0 ? 25 * 60 : s - 1)), 1000);
        return () => clearInterval(timer);
    }, []);
    return seconds;
}

const clock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// ---------- hero: the sentence with the timer in it ----------

function Hero({ c, still }) {
    const reveal = useReveal();
    // the loop runs on and on, so it can be stopped (WCAG 2.2.2)
    const [paused, setPaused] = useState(false);
    const stopped = still || paused;
    return (
        <section className={styles.hero} data-tone="dark" aria-labelledby="landing-title">
            <div className={styles.heroLower} aria-hidden="true" />
            {/* the first line stands on the dark field, the second wholly on the orange one */}
            <motion.h1 id="landing-title" className={styles.headline} {...reveal(0)}>
                <span className={`${styles.line} ${styles.lineTop}`}>
                    {c.hero.before}{' '}
                    <span className={styles.slot} aria-hidden="true">
                        <Suspense fallback={null}><FocusLoopPlayer key={stopped ? 'still' : 'play'} still={stopped} doneLabel={c.hero.done} /></Suspense>
                    </span>
                </span>
                <span className={`${styles.line} ${styles.lineBottom}`}>{c.hero.after}</span>
            </motion.h1>
            <motion.p className={styles.heroSub} {...reveal(2)}>{c.hero.sub}</motion.p>
            {!still && (
                <button type="button" className={styles.pauseBtn} aria-pressed={paused} onClick={() => setPaused(p => !p)}>
                    {paused ? c.hero.play : c.hero.pause}
                </button>
            )}
        </section>
    );
}

// ---------- the four features: a statement and the piece of the app that shows it ----------

const Icon = {
    check: <svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="m382-354 339-339q12-12 28-12t28 12q12 12 12 28.5T777-636L410-268q-12 12-28 12t-28-12L182-440q-12-12-11.5-28.5T183-497q12-12 28.5-12t28.5 12l142 143Z" /></svg>,
    back: <svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M280-200v-80h284q63 0 109.5-40T720-420q0-60-46.5-100T564-560H312l104 104-56 56-200-200 200-200 56 56-104 104h252q97 0 166.5 63T800-420q0 94-69.5 157T564-200H280Z" /></svg>,
    bell: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16zM10 20.5a2 2 0 0 0 4 0" /></svg>,
};

function FocusUI({ ui }) {
    const seconds = useCountdown(18 * 60 + 42);
    const progress = 1 - seconds / (25 * 60);
    const ring = 2 * Math.PI * 34;
    return (
        <div className={`${styles.ui} ${styles.focusUI}`} data-ui>
            <div className={styles.uiHead}>
                <span className={styles.uiLabel}>{ui.label}</span>
                <span className={styles.uiIcons}>
                    <span className={styles.uiIconMuted}>{Icon.back}</span>
                    <span className={styles.accentText}>{Icon.check}</span>
                </span>
            </div>
            <div className={styles.focusMain}>
                <svg className={styles.focusRing} viewBox="0 0 80 80" aria-hidden="true">
                    <circle cx="40" cy="40" r="34" className={styles.ringTrack} />
                    <circle cx="40" cy="40" r="34" className={styles.ringFill}
                        strokeDasharray={ring} strokeDashoffset={ring * (1 - progress)} transform="rotate(-90 40 40)" />
                </svg>
                <div className={styles.focusText}>
                    <span className={styles.focusTask}>{ui.task}</span>
                    <span className={styles.uiMeta}>{ui.session}: <strong className={styles.accentText}>{clock(25 * 60 - seconds)}</strong></span>
                </div>
            </div>
            <div className={styles.focusNotes}>
                <span className={styles.uiLabel}>{ui.notes}</span>
                <span className={styles.noteLine}>{ui.note}</span>
            </div>
        </div>
    );
}

function PlanUI({ ui }) {
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i));
    // a calm week: which entry sits on which day (index into ui.chips); 1 repeats, 2 has a reminder
    const plan = [[2], [], [1], [], [0], [1], []];
    return (
        <div className={`${styles.ui} ${styles.planUI}`} data-ui>
            <ol className={styles.weekGrid}>
                {days.map((day, i) => (
                    <li key={i} className={styles.weekDay}>
                        <span className={styles.weekName}>{ui.weekdays[day.getDay()]}</span>
                        <span className={`${styles.weekNum} ${i === 0 ? styles.weekNumToday : ''}`}>{day.getDate()}</span>
                        {plan[i].map(chip => (
                            <span key={chip} className={styles.weekPill}>
                                {chip === 1 && <span className={styles.accentText} aria-hidden="true">↻</span>}
                                {chip === 2 && <span className={`${styles.chipIcon} ${styles.accentText}`}>{Icon.bell}</span>}
                                {ui.chips[chip]}
                            </span>
                        ))}
                    </li>
                ))}
            </ol>
            <div className={styles.planLegend}>
                <span><span className={styles.accentText} aria-hidden="true">↻</span> {ui.repeat}</span>
                <span><span className={`${styles.chipIcon} ${styles.accentText}`}>{Icon.bell}</span> {ui.reminder}</span>
            </div>
        </div>
    );
}

function TogetherUI({ ui }) {
    const seconds = useCountdown(28 * 60 + 52);
    const elapsed = 25 * 60 - seconds + 31 * 60;
    const people = [['A', ui.tasks[0], true, 82], ['B', ui.tasks[1], true, 61], ['C', ui.tasks[2], false, 40]];
    return (
        <div className={`${styles.ui} ${styles.togetherUI}`} data-ui>
            <div className={styles.uiHead}>
                <span className={styles.uiTitle}>{ui.title}</span>
                <span className={styles.liveTime}><b className={styles.liveDot} />{clock(elapsed)}</span>
            </div>
            {people.map(([initial, task, live, share]) => (
                <div key={initial} className={styles.member}>
                    <span className={styles.avatar}>{initial}</span>
                    <span className={styles.memberText}>
                        <span className={styles.memberName}>{task}</span>
                        <span className={live ? styles.accentText : styles.uiMeta}>{live ? ui.live : ui.pause}</span>
                    </span>
                    <span className={styles.memberBar}><span style={{ width: `${share}%` }} /></span>
                </div>
            ))}
        </div>
    );
}

function StyleUI({ ui, accent, onAccent }) {
    return (
        <div className={`${styles.ui} ${styles.styleUI}`} data-ui>
            <span className={styles.uiLabel}>{ui.colours}</span>
            <div className={styles.swatches} role="group" aria-label={ui.colours}>
                {Object.entries(ACCENTS).map(([key, [colour]]) => (
                    <button key={key} type="button" aria-pressed={accent === key}
                        className={`${styles.swatch} ${accent === key ? styles.swatchOn : ''}`} onClick={() => onAccent(key)}>
                        <span className={styles.swatchDot} style={{ background: colour }} />
                        <span>{ui.names[key]}</span>
                    </button>
                ))}
            </div>
            <span className={styles.uiLabel}>{ui.theme}</span>
            <div className={styles.segments}>
                {ui.themes.map((label, i) => <span key={label} className={i === 0 ? styles.segmentOn : undefined}>{label}</span>)}
            </div>
            <span className={styles.uiLabel}>{ui.motion}</span>
            <div className={styles.segments}>
                {ui.motions.map((label, i) => <span key={label} className={i === 1 ? styles.segmentOn : undefined}>{label}</span>)}
            </div>
        </div>
    );
}

// the fields of the four rows; 'deep' is the dark one step up, so two dark rows never run together
const TONES = ['light', 'dark', 'accent', 'deep'];
const ANCHORS = { focus: 'fokus', plan: 'planen', together: 'zusammen', style: 'stil' };

function Features({ c, accent, onAccent }) {
    const reveal = useReveal();
    return c.features.map((feature, i) => (
        <section key={feature.id} id={ANCHORS[feature.id]}
            className={`${styles.feature} ${styles[`feature_${TONES[i]}`]} ${i % 2 ? styles.featureFlip : ''}`}
            data-tone={TONES[i] === 'deep' ? 'dark' : TONES[i]} aria-labelledby={`feature-${feature.id}`}>
            <div className={styles.featureText}>
                <motion.h2 id={`feature-${feature.id}`} className={styles.featureTitle} {...reveal(0)}>{feature.heading}</motion.h2>
                <motion.p className={styles.featureBody} {...reveal(1)}>{feature.text}</motion.p>
            </div>
            <motion.div className={styles.featureUI} {...reveal(2)}>
                {feature.id === 'focus' && <FocusUI ui={feature.ui} />}
                {feature.id === 'plan' && <PlanUI ui={feature.ui} />}
                {feature.id === 'together' && <TogetherUI ui={feature.ui} />}
                {feature.id === 'style' && <StyleUI ui={feature.ui} accent={accent} onAccent={onAccent} />}
            </motion.div>
        </section>
    ));
}

// ---------- questions ----------

function Faq({ c }) {
    const reveal = useReveal();
    return (
        <section id="fragen" className={styles.faq} data-tone="light" aria-labelledby="faq-title">
            <motion.h2 id="faq-title" className={styles.faqTitle} {...reveal(0)}>{c.faq.heading}</motion.h2>
            <div className={styles.faqList}>
                {c.faq.items.map(([question, answer], i) => (
                    <motion.details key={question} className={styles.question} {...reveal(1 + i * 0.5)}>
                        <summary>{question}<span className={styles.chevron} aria-hidden="true" /></summary>
                        <p>{answer}</p>
                    </motion.details>
                ))}
            </div>
        </section>
    );
}

// ---------- the email line, then the real form ----------

function Cta({ c, onStart }) {
    const reveal = useReveal();
    const [email, setEmail] = useState('');
    return (
        <section className={styles.cta} data-tone="accent" aria-labelledby="cta-title">
            <motion.h2 id="cta-title" className={styles.ctaTitle} {...reveal(0)}>{c.cta.heading}</motion.h2>
            <motion.form className={styles.ctaSentence} {...reveal(0)}
                onSubmit={(e) => { e.preventDefault(); onStart(email.trim()); }}>
                <span className={styles.ctaLine}>
                    <input type="email" name="email" value={email} placeholder={c.cta.placeholder} aria-label={c.cta.emailLabel}
                        autoComplete="email" spellCheck={false} onChange={(e) => setEmail(e.target.value)} />
                    <button type="submit">{c.cta.button}</button>
                </span>
            </motion.form>
            <motion.p className={styles.ctaNote} {...reveal(1)}>{c.cta.note}</motion.p>
        </section>
    );
}

function Start({ c, startWith }) {
    return (
        <section id="start" className={styles.start} data-tone="dark" aria-labelledby="start-title">
            <h2 id="start-title" className={styles.startTitle}>{c.start.heading}</h2>
            {/* a new key opens it fresh on "sign up" with the address from the line above */}
            <div className={styles.startForm}>
                <Profile key={startWith.key} initialSignState={startWith.signUp ? 1 : 0} initialEmail={startWith.email} />
            </div>
        </section>
    );
}

function Footer({ c, onStart }) {
    const reveal = useReveal();
    return (
        <footer className={styles.footer} data-tone="light">
            <div className={styles.footerTop}>
                <motion.div {...reveal(0)}>
                    <h2 className={styles.footerInvite}>{c.footer.invitation}</h2>
                    <button type="button" className={styles.darkBtn} onClick={() => onStart('')}>{c.footer.button}</button>
                </motion.div>
                <motion.ul className={styles.footerLinks} {...reveal(1)}>
                    {c.footer.links.map(([label, to]) => <li key={to}><Link to={to}>{label}</Link></li>)}
                </motion.ul>
            </div>
            <div className={styles.footerLegal}>
                <span>© {COPYRIGHT_YEAR} Quidey</span>
            </div>
            <div className={styles.wordmark} aria-hidden="true" translate="no">Quidey</div>
        </footer>
    );
}

// ---------- the page ----------

// What signed-out visitors see: what Quidey is, its pieces, and the way in (sign in / sign up)
export default function Landing() {
    const dispatch = useDispatch();
    const language = useSelector(state => state.settings.language);
    const c = LANDING_COPY[language] ?? LANDING_COPY.de;
    const level = useMotionLevel();
    const [startWith, setStartWith] = useState({ key: 0, signUp: false, email: '' });
    const [tone, setTone] = useState('dark');
    // the colour picked in the last feature recolours every piece of the app on the page
    const [accent, setAccent] = useState('sunset');
    const pageRef = useRef(null);

    const goToStart = () => requestAnimationFrame(() =>
        document.getElementById('start')?.scrollIntoView({ behavior: level === 'minimal' ? 'auto' : 'smooth' }));
    const start = (email) => { setStartWith(prev => ({ key: prev.key + 1, signUp: true, email })); goToStart(); };
    const signIn = () => { setStartWith(prev => ({ key: prev.key + 1, signUp: false, email: '' })); goToStart(); };

    // the page always opens at the top: no restored scroll position, no jump to an old #anchor
    useEffect(() => {
        const previous = 'scrollRestoration' in history ? history.scrollRestoration : null;
        if (previous) history.scrollRestoration = 'manual';
        if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search);
        window.scrollTo(0, 0);
        return () => { if (previous) history.scrollRestoration = previous; };
    }, []);

    // the bar's links scroll to their section without putting an #anchor into the address
    const scrollTo = (e, id) => {
        e.preventDefault();
        document.getElementById(id)?.scrollIntoView({ behavior: level === 'minimal' ? 'auto' : 'smooth' });
    };

    // the bar takes the colours of the chapter under it
    useEffect(() => {
        // without the observer (old browsers) the bar simply stays dark
        if (typeof IntersectionObserver === 'undefined') return;
        const sections = [...(pageRef.current?.querySelectorAll('[data-tone]') ?? [])];
        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) if (entry.isIntersecting) setTone(entry.target.dataset.tone);
        }, { rootMargin: '0px 0px -94% 0px' });
        sections.forEach(section => observer.observe(section));
        return () => observer.disconnect();
    }, [language]);

    const nav = useMemo(() => [['fokus', c.nav.focus], ['planen', c.nav.plan], ['zusammen', c.nav.together], ['fragen', c.nav.faq]], [c]);
    const [uiAccent, uiAccentInk] = ACCENTS[accent];

    return (
        <div className={styles.page} ref={pageRef} style={{ '--ui-accent': uiAccent, '--ui-accent-ink': uiAccentInk }}>
            <header className={`${styles.bar} ${styles[`bar_${tone}`] ?? ''}`}>
                <a href="/" className={styles.wordmarkSmall} aria-label="Quidey"
                    onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: level === 'minimal' ? 'auto' : 'smooth' }); }}>
                    <Logo className={styles.barLogo} /> <span translate="no">Quidey</span>
                </a>
                <nav className={styles.barLinks} aria-label="Quidey">
                    {nav.map(([id, label]) => <a key={id} href={`#${id}`} onClick={(e) => scrollTo(e, id)}>{label}</a>)}
                </nav>
                <div className={styles.barActions}>
                    <button type="button" className={styles.langBtn} onClick={() => dispatch(setLanguage(c.nav.languageCode))}
                        lang={c.nav.languageCode}>{c.nav.language}</button>
                    <button type="button" className={styles.textBtn} onClick={signIn}>{c.nav.signIn}</button>
                    <button type="button" className={styles.actionBtn} onClick={() => start('')}>{c.nav.cta}</button>
                </div>
            </header>
            <main>
                <Hero c={c} still={level === 'minimal'} />
                <Features c={c} accent={accent} onAccent={setAccent} />
                <Faq c={c} />
                <Cta c={c} onStart={start} />
                <Start c={c} startWith={startWith} />
            </main>
            <Footer c={c} onStart={start} />
        </div>
    );
}
