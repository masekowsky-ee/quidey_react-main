import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import styles from './Legal.module.css';
import { apiFetch } from '../features/helperFunction';

const ERRORS = {
    INVALID_NAME: 'Bitte gib deinen Namen ein (höchstens 100 Zeichen).',
    INVALID_EMAIL: 'Bitte gib eine gültige E-Mail-Adresse ein, damit ich dir antworten kann.',
    INVALID_MESSAGE: 'Die Nachricht muss 10 bis 5000 Zeichen lang sein.',
    RATE_LIMITED: 'Zu viele Nachrichten. Bitte versuche es später noch einmal.',
};
const GENERIC_ERROR = 'Die Nachricht konnte nicht gesendet werden. Bitte versuche es später erneut oder schreib eine E-Mail.';

// name and email: null until typed in, then a signed-in person's own come in by themselves
const empty = { name: null, email: null, message: '', website: '' };

// The contact form: the second quick way to reach the operator that § 5 DDG asks for, next to
// the email address. Works without an account; the server mails the message to the operator.
export default function ContactForm() {
    const [form, setForm] = useState(empty);
    const [state, setState] = useState({ sending: false, sent: false, error: null });
    const user = useSelector(state => state.auth.user);
    const name = form.name ?? user?.display_name ?? '';
    const email = form.email ?? user?.email ?? '';

    const set = (field) => (e) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        setState((prev) => ({ ...prev, error: null }));
    };

    const submit = async (e) => {
        e.preventDefault();
        if (form.message.trim().length < 10) {
            setState({ sending: false, sent: false, error: ERRORS.INVALID_MESSAGE });
            return;
        }
        setState({ sending: true, sent: false, error: null });
        try {
            await apiFetch('/api/contact', { method: 'POST', body: JSON.stringify({ ...form, name, email }) });
            setForm(empty);
            setState({ sending: false, sent: true, error: null });
        } catch (err) {
            setState({ sending: false, sent: false, error: ERRORS[err?.code] ?? GENERIC_ERROR });
        }
    };

    if (state.sent) {
        return (
            <p className={styles.success} role="status">
                Danke! Deine Nachricht ist angekommen. Ich antworte dir an die angegebene E-Mail-Adresse.
            </p>
        );
    }

    return (
        <form className={styles.form} onSubmit={submit}>
            <div className={styles.field}>
                <label htmlFor="contactName">Name</label>
                <input id="contactName" value={name} onChange={set('name')} maxLength={100} autoComplete="name" required />
            </div>
            <div className={styles.field}>
                <label htmlFor="contactEmail">E-Mail-Adresse</label>
                <input id="contactEmail" type="email" value={email} onChange={set('email')} maxLength={254} autoComplete="email" required />
            </div>
            <div className={styles.field}>
                <label htmlFor="contactMessage">Nachricht</label>
                <textarea id="contactMessage" value={form.message} onChange={set('message')} rows={7} maxLength={5000} required />
            </div>
            {/* for bots only: hidden from people and screen readers, see the server */}
            <div className={styles.trap} aria-hidden="true">
                <label htmlFor="contactWebsite">Website</label>
                <input id="contactWebsite" value={form.website} onChange={set('website')} tabIndex={-1} autoComplete="off" />
            </div>
            <p className={styles.formHint}>
                Deine Angaben werden nur zur Bearbeitung deiner Nachricht verwendet, siehe <Link to="/datenschutz">Datenschutzerklärung</Link>.
            </p>
            {state.error && <p className={styles.error} role="alert">{state.error}</p>}
            <button type="submit" className={styles.submit} disabled={state.sending}>
                {state.sending ? 'Wird gesendet…' : 'Nachricht senden'}
            </button>
        </form>
    );
}
