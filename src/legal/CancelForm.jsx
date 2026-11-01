import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import styles from './Legal.module.css';
import { apiFetch } from '../features/helperFunction';

const ERRORS = {
    name: 'Bitte gib deinen Namen ein (höchstens 100 Zeichen).',
    email: 'Bitte gib eine gültige E-Mail-Adresse ein: dorthin geht die Bestätigung.',
    username: 'Der Benutzername darf nur Buchstaben, Ziffern, _ . und - enthalten.',
    explanation: 'Bitte nenne bei einer außerordentlichen Kündigung den wichtigen Grund.',
    RATE_LIMITED: 'Zu viele Anfragen. Bitte versuche es später noch einmal oder schreib eine E-Mail.',
};
const GENERIC_ERROR = 'Die Kündigung konnte nicht gesendet werden. Bitte versuche es gleich noch einmal oder kündige per E-Mail.';

// "Verträge hier kündigen" (§ 312k BGB): cancelling Quidey Pro without signing in. Asks what the
// law asks for (type of cancellation, who, which contract, where the confirmation goes, when) and
// ends with "Jetzt kündigen"; the server confirms by mail right away (POST /api/billing/cancel).
export default function CancelForm() {
    const user = useSelector((state) => state.auth.user);
    const [form, setForm] = useState({ name: null, email: null, username: null, reason: 'ordinary', explanation: '' });
    const [state, setState] = useState({ sending: false, done: null, error: null });
    const name = form.name ?? user?.display_name ?? '';
    const email = form.email ?? user?.email ?? '';
    const username = form.username ?? user?.username ?? '';

    const set = (field) => (e) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        setState((prev) => ({ ...prev, error: null }));
    };

    const submit = async (e) => {
        e.preventDefault();
        setState({ sending: true, done: null, error: null });
        try {
            const result = await apiFetch('/api/billing/cancel', {
                method: 'POST',
                body: JSON.stringify({ name, email, username, reason: form.reason, explanation: form.explanation, language: 'de' }),
            });
            setState({ sending: false, done: new Date(result.receivedAt), error: null });
        } catch (err) {
            setState({ sending: false, done: null, error: ERRORS[err?.field] ?? ERRORS[err?.code] ?? GENERIC_ERROR });
        }
    };

    if (state.done) {
        return (
            <div className={styles.success} role="status">
                <p><strong>Deine Kündigung ist eingegangen</strong> – am {state.done.toLocaleString('de-DE', { dateStyle: 'long', timeStyle: 'short' })} Uhr.</p>
                <p>
                    Eine Bestätigung ist auf dem Weg an {email}. Dein Abo endet zum Ende des bereits bezahlten Zeitraums;
                    danach wird nichts mehr abgebucht. Danke, dass du Quidey unterstützt hast!
                </p>
            </div>
        );
    }

    return (
        <form className={styles.form} onSubmit={submit}>
            <fieldset className={styles.field}>
                <legend>Art der Kündigung</legend>
                <label className={styles.choice}>
                    <input type="radio" name="reason" value="ordinary" checked={form.reason === 'ordinary'} onChange={set('reason')} />
                    Ordentliche Kündigung zum nächstmöglichen Zeitpunkt (Ende des bezahlten Zeitraums)
                </label>
                <label className={styles.choice}>
                    <input type="radio" name="reason" value="extraordinary" checked={form.reason === 'extraordinary'} onChange={set('reason')} />
                    Außerordentliche Kündigung aus wichtigem Grund
                </label>
            </fieldset>
            {form.reason === 'extraordinary' && (
                <div className={styles.field}>
                    <label htmlFor="cancelExplanation">Wichtiger Grund</label>
                    <textarea id="cancelExplanation" value={form.explanation} onChange={set('explanation')} rows={4} maxLength={2000} required />
                </div>
            )}
            <div className={styles.field}>
                <label htmlFor="cancelName">Vor- und Nachname</label>
                <input id="cancelName" value={name} onChange={set('name')} maxLength={100} autoComplete="name" required />
            </div>
            <div className={styles.field}>
                <label htmlFor="cancelEmail">E-Mail-Adresse deines Quidey-Kontos (dorthin geht die Bestätigung)</label>
                <input id="cancelEmail" type="email" value={email} onChange={set('email')} maxLength={254} autoComplete="email" required />
            </div>
            <div className={styles.field}>
                <label htmlFor="cancelUsername">Benutzername (falls du ihn weißt)</label>
                <input id="cancelUsername" value={username} onChange={set('username')} maxLength={30} autoComplete="username" />
            </div>
            <p className={styles.formHint}>
                Vertrag: Quidey Pro (monatlich oder jährlich, über die Website abgeschlossen). Abos, die du in der
                Android-App über Google Play abgeschlossen hast, kündigst du im Play Store unter „Zahlungen &amp; Abos“.
                Deine Angaben werden nur zur Bearbeitung der Kündigung verwendet, siehe <Link to="/datenschutz">Datenschutzerklärung</Link>.
            </p>
            {state.error && <p className={styles.error} role="alert">{state.error}</p>}
            <button type="submit" className={styles.submit} disabled={state.sending}>
                {state.sending ? 'Wird gesendet…' : 'Jetzt kündigen'}
            </button>
        </form>
    );
}
