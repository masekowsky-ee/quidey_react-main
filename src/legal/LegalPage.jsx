import { Link, useLocation } from 'react-router-dom';
import styles from './Legal.module.css';
import { OWNER, PROCESSORS, LEGAL_VERSION_DATE, isPlaceholder } from './owner';
import { useTranslation } from '../i18n/useTranslation';
import ContactForm from './ContactForm';
import CancelForm from './CancelForm';
import { LegalFooter } from './LegalFooter';
import { proBuilt } from '../features/pro/flag';

// The legal pages. German law, so the texts are German; English readers get a short note.
// Reachable signed in and signed out (App.jsx renders them before any sign-in check);
// the addresses are listed in paths.js too.
const LEGAL_PAGES = {
    '/impressum': { title: 'Impressum', Body: Imprint },
    '/datenschutz': { title: 'Datenschutzerklärung', Body: Privacy },
    '/nutzungsbedingungen': { title: 'Nutzungsbedingungen', Body: Terms },
    '/kontakt': { title: 'Kontakt', Body: Contact },
    // only while Quidey Pro is built in (features/pro/flag.js)
    ...(proBuilt() ? { '/kuendigen': { title: 'Verträge hier kündigen', Body: Cancel } } : {}),
};

// Section numbers: the parts on Quidey Pro (privacy § 7, terms § 8–9) are only there while it is
// built in; the sections after them move up when they aren't. n(number as with Pro).
const PRIVACY_PRO = 7;
const TERMS_PRO = 8;
const privacyNo = (no) => (proBuilt() || no < PRIVACY_PRO ? no : no - 1);
const termsNo = (no) => (proBuilt() || no < TERMS_PRO ? no : no - 2);

// A value from owner.js; unfilled placeholders stand out so they can't slip through
function V({ children }) {
    return isPlaceholder(children) ? <mark className={styles.todo}>{children}</mark> : children;
}

function Address() {
    return (
        <p>
            <V>{OWNER.name}</V><br />
            {OWNER.careOf && <>{OWNER.careOf}<br /></>}
            <V>{OWNER.street}</V><br />
            <V>{OWNER.city}</V><br />
            <V>{OWNER.country}</V>
        </p>
    );
}

// phone is optional in owner.js (then a second quick way to reach you is needed, see there)
const hasPhone = (phone) => phone && !/^[-\s]*$/.test(phone);

// email plus a second quick way (phone if set, the contact form always)
function ContactLines() {
    return (
        <p>
            E-Mail: <V>{OWNER.email}</V>
            {hasPhone(OWNER.phone) && <><br />Telefon: <V>{OWNER.phone}</V></>}
            <br />Kontaktformular: <Link to="/kontakt">app.quidey.com/kontakt</Link>
        </p>
    );
}

function Contact() {
    return (
        <>
            <p>
                Fragen, Hinweise oder ein Problem mit Quidey? Schreib mir hier; ich antworte in der Regel
                innerhalb von 1–2 Werktagen. Du erreichst mich auch per E-Mail an <V>{OWNER.email}</V>.
            </p>
            <ContactForm />
        </>
    );
}

// § 312k BGB: Quidey Pro can be cancelled here, without signing in
function Cancel() {
    return (
        <>
            <p>
                Hier kündigst du dein Abo von Quidey Pro, das du über die Website abgeschlossen hast – ohne
                Anmeldung. Du bekommst sofort eine Bestätigung per E-Mail mit Datum und Uhrzeit des Eingangs.
                Angemeldet geht es auch über „Abo verwalten“ auf der Seite <Link to="/pro">Quidey unterstützen</Link>.
            </p>
            <CancelForm />
        </>
    );
}

export default function LegalPage() {
    const { pathname } = useLocation();
    const { language } = useTranslation();
    const page = LEGAL_PAGES[pathname];
    if (!page) return null;
    const { title, Body } = page;

    return (
        <main className={styles.page}>
            <Link to="/" className={styles.back}>← Quidey</Link>
            <h1 className={styles.title}>{title}</h1>
            {language !== 'de' && (
                <p className={styles.note} lang="en">This legal information is provided in German, as required by German law.</p>
            )}
            <article className={styles.text}>
                <Body />
            </article>
            <LegalFooter />
        </main>
    );
}

// Small links at the bottom of every screen
// the footer lives in its own file (loaded with the app); still importable from here
export { LegalFooter };

function Imprint() {
    return (
        <>
            <h2>Angaben gemäß § 5 DDG</h2>
            <Address />

            <h2>Kontakt</h2>
            <ContactLines />

            <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
            <Address />

            <h2>Verbraucherstreitbeilegung</h2>
            <p>
                Ich bin nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
                Verbraucherschlichtungsstelle teilzunehmen.
            </p>

            <h2>Haftung für Inhalte und Links</h2>
            <p>
                Die Inhalte dieser Anwendung werden mit Sorgfalt erstellt. Für Inhalte, die Nutzerinnen und Nutzer
                selbst eingeben (z. B. Aufgaben, Nachrichten in gemeinsamen Sitzungen), sind diese selbst verantwortlich.
                Nach §§ 8 bis 10 DDG bin ich nicht verpflichtet, fremde gespeicherte Informationen zu überwachen; sobald
                mir eine Rechtsverletzung bekannt wird, entferne ich die betreffenden Inhalte umgehend.
                Für Inhalte verlinkter fremder Seiten sind ausschließlich deren Betreiber verantwortlich.
            </p>

            <h2>Urheberrecht</h2>
            <p>
                Quidey – insbesondere Name, Logo, Gestaltung, Texte und Quellcode – ist urheberrechtlich und
                kennzeichenrechtlich geschützt. Alle Rechte liegen bei <V>{OWNER.name}</V>. Jede Vervielfältigung,
                Bearbeitung, Verbreitung oder sonstige Verwertung außerhalb der Grenzen des Urheberrechts bedarf der
                vorherigen schriftlichen Zustimmung. Näheres regeln die <Link to="/nutzungsbedingungen">Nutzungsbedingungen</Link>.
            </p>
        </>
    );
}

function Privacy() {
    return (
        <>
            <p className={styles.meta}>Stand: {LEGAL_VERSION_DATE}</p>

            <h2>1. Verantwortlicher</h2>
            <p>Verantwortlich für die Verarbeitung personenbezogener Daten in Quidey (Art. 4 Nr. 7 DSGVO) ist:</p>
            <Address />
            <ContactLines />
            <p>Ein Datenschutzbeauftragter ist nicht bestellt, da keine gesetzliche Pflicht dazu besteht.</p>

            <h2>2. Das Wichtigste in Kürze</h2>
            <ul>
                <li>Quidey verarbeitet nur die Daten, die für die App nötig sind.</li>
                <li>Es gibt keine Werbung und keine Cookies. Im Browser gibt es kein Tracking und keine Analyse-Tools;
                    in der Android-App nutze ich Google Analytics für Firebase, aber nur, wenn du einwilligst (Abschnitt 3).</li>
                <li>Schriften und alle Dateien der App werden von Quidey selbst ausgeliefert, nicht von Dritten.</li>
                <li>Du kannst dein Konto jederzeit im Profil selbst löschen. Dabei werden deine Daten gelöscht.</li>
                {proBuilt() && <li>Bezahlst du für Quidey Pro, läuft das über Stripe bzw. Google Play; deine Karten- oder Kontodaten
                    sehe ich nicht (Abschnitt 7).</li>}
                <li>Mit Google anmelden ist freiwillig; ein Konto mit E-Mail-Adresse und Passwort geht genauso.</li>
            </ul>

            <h2>3. Aufruf der Website (Hosting)</h2>
            <p>
                Quidey besteht aus der Startseite quidey.com und der App app.quidey.com. Beide werden über
                {' '}{PROCESSORS.frontendHost} („Cloudflare“) ausgeliefert. Beim Aufruf verarbeitet
                Cloudflare technisch notwendige Verbindungsdaten: IP-Adresse, Zeitpunkt, aufgerufene Adresse,
                Browser-Kennung (User-Agent) sowie Daten zur Abwehr von Angriffen. Rechtsgrundlage ist Art. 6 Abs. 1
                lit. f DSGVO; mein berechtigtes Interesse ist eine sichere, schnelle und stabile Auslieferung.
                Mit Cloudflare besteht ein Auftragsverarbeitungsvertrag (Art. 28 DSGVO). Cloudflare kann Daten in den
                USA verarbeiten; Cloudflare ist unter dem EU-US Data Privacy Framework zertifiziert
                (Angemessenheitsbeschluss der EU-Kommission, Art. 45 DSGVO), ergänzend gelten
                Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO).
            </p>
            <p>
                Die Startseite quidey.com setzt keine Cookies, lädt nichts von Dritten und sendet keine Daten an die
                API. Sie zeigt sich in der Sprache deines Geräts (Deutsch, sonst Englisch); dafür liest dein Browser
                die eingestellte Sprache, gespeichert wird dabei nichts. Nur wenn du die Sprache selbst umschaltest,
                merkt sich dein Browser diese Wahl im lokalen Speicher (localStorage, „quidey-lang“), damit die
                Startseite dich nicht wieder umleitet; das ist für diese von dir gewünschte Funktion unbedingt
                erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG) und verlässt dein Gerät nicht. Anmelden und Registrieren finden in der App statt. Gibst du
                auf der Startseite deine E-Mail-Adresse ein, reicht dein Browser sie nur an das Registrierungsformular
                der App weiter (im Teil der Adresse nach „#“, der nicht an einen Server übertragen wird); gespeichert
                wird sie erst, wenn du dich registrierst.
            </p>
            <p>
                <strong>Android-App:</strong> Die Android-App „Quidey“ enthält die Dateien der App selbst und spricht
                nur mit der API (unten); Cloudflare ist dabei nicht beteiligt. Du bekommst sie über Google Play oder als
                Datei (APK) direkt von app.quidey.com („Einstellungen“ → „App“); was Google beim Herunterladen und
                Aktualisieren über Google Play verarbeitet, regelt Google in eigener Verantwortung (Datenschutzerklärung
                von Google), das Herunterladen der Datei läuft wie jeder Aufruf der Website über Cloudflare (oben). In der App gelten dieselben Abschnitte wie im Browser; was nur in
                der App anders ist, steht jeweils dabei.
            </p>
            <p>
                <strong>Google Analytics für Firebase (nur Android-App):</strong> Die Android-App kann über Google
                Analytics für Firebase von <V>{PROCESSORS.google}</V> mitzählen, wie sie genutzt wird, damit ich sehe,
                was gut funktioniert und was ich verbessern sollte. Das geschieht nur, wenn du zustimmst: Die App fragt
                dich einmal danach (beide Antworten gleich einfach), und unter „Einstellungen“ → „App“ →
                „Nutzungsdaten“ kannst du deine Entscheidung jederzeit ändern. Bis zu deiner Zustimmung ist die
                Erfassung ausgeschaltet und es wird nichts übertragen.
            </p>
            <p>
                Mit deiner Zustimmung erfasst werden: eine zufällige Kennung der App-Installation, Gerätemodell,
                Android-Version, App-Version, Sprache, ungefähre Region (von Google aus der IP-Adresse abgeleitet, die
                Google dafür nicht speichert), wann und wie lange die App genutzt wird, welche Bereiche der App du
                öffnest (als Name des Bereichs, ohne Benutzernamen oder Nummern) und welche Aktionen du ausführst, nur
                als Art der Aktion (Aufgabe angelegt oder erledigt, Gruppe angelegt, Freundschaftsanfrage gesendet,
                Freund hinzugefügt, gemeinsame Sitzung oder Family angelegt, Fokus gestartet oder beendet mit der Art
                des Timers). Nicht erfasst werden deine Inhalte (Aufgaben, Notizen, Nachrichten), dein Name, deine
                E-Mail-Adresse, dein Quidey-Konto, die Werbe-ID und die Android-ID; die Daten werden nicht mit deinem
                Konto verknüpft und nicht für Werbung genutzt (Werbe-Signale sind ausgeschaltet). Die Kennung und die
                noch nicht übertragenen Ereignisse liegen im Speicher der App.
            </p>
            <p>
                Rechtsgrundlage ist deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO, für das Speichern und Auslesen auf
                deinem Gerät § 25 Abs. 1 TDDDG). Du kannst sie jederzeit mit Wirkung für die Zukunft widerrufen; dabei
                löscht die App auch die auf dem Gerät gesammelten Daten und verwirft die Kennung. Google verarbeitet
                die Daten als Auftragsverarbeiter, auch in den USA (Google LLC ist unter dem EU-US Data Privacy
                Framework zertifiziert, Art. 45 DSGVO, ergänzend Standardvertragsklauseln), und löscht sie nach
                2 Monaten. Im Browser wird Google Analytics nicht verwendet.
            </p>
            <p>
                Die Programmierschnittstelle (API) und die Datenbank laufen auf einem Server bei <V>{PROCESSORS.backendHost}</V>.
                Auch mit diesem Anbieter besteht ein Auftragsverarbeitungsvertrag. Zum Schutz vor Missbrauch (z. B. zu
                vielen Anmeldeversuchen) zählt der Server Anfragen je IP-Adresse; diese Zähler liegen nur im
                Arbeitsspeicher und verfallen nach spätestens 15 Minuten. Falls der Server Zugriffsprotokolle führt,
                werden sie nach spätestens 14 Tagen gelöscht. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO
                (Sicherheit des Dienstes).
            </p>
            <p>
                <strong>Live-Verbindung:</strong> Solange du angemeldet bist und die App geöffnet hast, hält dein Browser
                eine dauerhafte Verbindung (WebSocket) zum Server, damit Nachrichten, Sitzungs- und Family-Chats und Meldungen sofort
                ankommen. Dafür prüft der Server dein Anmelde-Token und merkt sich nur im Arbeitsspeicher, welche
                Verbindung zu welchem Konto und welcher gemeinsamen Sitzung gehört. Über die Verbindung wird nur
                übertragen, was ohnehin gespeichert ist; zusätzlich gespeichert wird nichts. Mit dem Schließen der App
                oder der Abmeldung endet sie. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
            </p>

            <h2>4. Dein Konto</h2>
            <p>Für die Registrierung verarbeite ich:</p>
            <ul>
                <li><strong>Benutzername und Anzeigename</strong> – zur Anmeldung und damit Freunde dich finden und erkennen können;</li>
                <li><strong>E-Mail-Adresse</strong> – zur Anmeldung, zur Bestätigung deines Kontos und für wichtige Nachrichten zum Konto;</li>
                <li><strong>Geburtsdatum</strong> – um zu prüfen, dass du mindestens 14 Jahre alt bist;</li>
                <li><strong>Passwort</strong> – nur als sicherer Hash (bcrypt) gespeichert, nie im Klartext;</li>
                <li>Zeitpunkt der Registrierung, Bestätigungsstatus der E-Mail-Adresse und Zugangsstatus (Beta,
                    Tester – Tester sehen neue Funktionen vor allen anderen und erhalten eigene Meldungen);</li>
                <li>wann du die Einführung geschlossen hast – damit sie neuen Konten einmal von selbst erscheint,
                    auf keinem Gerät ein zweites Mal;</li>
                <li><strong>Sprache und Zeitzone</strong> deines Geräts (z. B. „Europe/Berlin“) – die App meldet sie beim
                    Öffnen, damit Mails in deiner Sprache kommen und Erinnerungen zur richtigen Uhrzeit;</li>
                <li><strong>Uhrzeit für Erinnerungen ohne Uhrzeit</strong> (Einstellungen, anfangs 12:00) – zu ihr
                    erinnert Quidey an Aufgaben und Termine, die keine Uhrzeit haben.</li>
            </ul>
            <p>
                Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Bereitstellung der App, die du nutzen möchtest).
                Ohne diese Angaben kann kein Konto angelegt werden.
            </p>
            <p>
                <strong>E-Mail-Bestätigung:</strong> Nach der Registrierung und nach einer Änderung der Adresse sende ich
                einen Bestätigungslink. Er ist 24 Stunden gültig; gespeichert wird nur ein Hash des Links. Der Versand
                erfolgt über <V>{PROCESSORS.mailProvider}</V> („Resend“) als Auftragsverarbeiter; dabei werden
                deine E-Mail-Adresse und der Inhalt der Mail verarbeitet. Resend kann Daten in den USA verarbeiten;
                Grundlage dafür sind die EU-Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO) im
                Auftragsverarbeitungsvertrag mit Resend.
            </p>
            <p>
                <strong>Anmelden mit Google:</strong> Statt mit Passwort kannst du dich mit deinem Google-Konto anmelden
                oder registrieren. Im Browser führt dich Quidey dazu auf die Anmeldeseite von Google und zurück; in der
                Android-App wählst du das Konto in der Kontoauswahl deines Handys. Quidey lädt dafür keine Skripte von
                Google. Google (<V>{PROCESSORS.google}</V>) teilt Quidey dabei nur mit: eine eindeutige Kennung deines
                Google-Kontos, deine E-Mail-Adresse, ob Google sie bestätigt hat, und deinen Namen. Gespeichert werden
                die Kennung (damit Google dich beim nächsten Mal wiedererkennt) und, bei einem neuen Konto, die
                E-Mail-Adresse als bestätigte Adresse deines Kontos; der Name wird dir nur als Anzeigename
                vorgeschlagen. Benutzername, Geburtsdatum und deine Zustimmungen fragt Quidey wie bei jeder Registrierung
                selbst ab. Gibt es schon ein Konto mit dieser E-Mail-Adresse, wird Google damit verbunden. Google erfährt,
                dass du dich bei Quidey anmeldest; das regelt Google in eigener Verantwortung. Google kann Daten auch in
                den USA verarbeiten (Google LLC ist unter dem EU-US Data Privacy Framework zertifiziert, Art. 45 DSGVO).
                Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO; die Anmeldung mit Google ist freiwillig.
            </p>
            <p>
                <strong>Beta-Zugang:</strong> Während der geschlossenen Beta kannst du Zugang beantragen. Dabei speichere
                ich deine Begründung und die Entscheidung. Administratoren sehen dafür Benutzername, Anzeigename und
                E-Mail-Adresse; Entscheidungen werden protokolliert (Art. 6 Abs. 1 lit. b und f DSGVO).
            </p>

            <h2>5. Deine Inhalte</h2>
            <p>
                Gespeichert wird, was du in Quidey anlegst: Aufgaben und Events (mit Tag, Uhrzeit, geplanter Zeit bzw.
                Dauer, Erinnerung, Wiederholung, Farbe, Ort, Link, Beschreibung und Notizen sowie dem Zeitpunkt, zu dem
                sie erledigt bzw. vorbei waren – für die Statistiken und den Ordner „Erledigt“), deine Event-Typen
                (Name, Farbe, Reihenfolge, z. B. „Arbeit“), Gruppen, Arbeitssitzungen und die gemessene Fokuszeit.
                Ein Event gilt als erledigt, sobald es vorbei ist; der Server prüft das dazu regelmäßig anhand deiner
                Zeitzone. Bei wiederkehrenden Aufgaben und Events legt Quidey dann automatisch das nächste an. Aus
                diesen Daten berechnet Quidey deine Statistiken für Woche, Monat, Jahr oder insgesamt (Fokuszeit,
                Event-Zeit pro Typ, Fokuszeit pro Gruppe, erledigte Aufgaben); sie werden bei jedem Aufruf berechnet
                und nicht zusätzlich gespeichert. Die Event-Zeit pro Typ siehst nur du, auch deine Freunde nicht.
                Diese Inhalte sieht nur du – außer du teilst sie bewusst (Abschnitt 6). Rechtsgrundlage ist Art. 6
                Abs. 1 lit. b DSGVO. Bitte gib in Aufgaben, Events, Event-Typen, Notizen und Bildern keine besonders
                sensiblen Daten ein (z. B. Gesundheitsdaten), die die App nicht braucht.
            </p>
            <p>
                <strong>Fokusraum, Notizbuch und Routinen:</strong> Im Notizbuch speichert Quidey deine Notizen mit
                Titel, Text, ob sie angeheftet sind, zu welcher deiner Aufgaben sie gehören, wann sie angelegt und
                zuletzt geändert wurden, und ihre Anhänge: Links (Adresse und Titel) und Bilder, die du einfügst oder
                auswählst. Bilder werden vorher auf deinem Gerät verkleinert und dann als Teil der Notiz auf dem Server
                gespeichert; achte darauf, keine Bilder mit Daten anderer Personen hochzuladen, die das nicht möchten.
                Von deinen Routinen speichert Quidey Name, Symbol, die Schritte (Text und Minuten), an welchen
                Wochentagen und zu welcher Uhrzeit du sie eingeplant hast, ob du erinnert werden möchtest und an welchem
                Tag zuletzt erinnert wurde, sowie jeden Durchgang (Beginn, Ende, wie viele Schritte geschafft wurden und
                wie lange es dauerte). Läuft der Fokus-Timer, speichert der Server, wann er endet und welche Phase
                (Timer, Fokus, kurze oder lange Pause) es ist, damit er dir dann eine Benachrichtigung schicken kann,
                auch wenn dein Handy aus ist; der Eintrag wird beim Pausieren, Beenden oder nach der Benachrichtigung
                gelöscht. Diese Inhalte sieht nur du. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
            </p>

            <h2>6. Freunde und gemeinsame Funktionen</h2>
            <p>
                Wenn du Freundschaftsanfragen sendest oder annimmst, sehen deine Freunde deinen Benutzernamen und
                Anzeigenamen. In gemeinsamen Sitzungen sehen alle Mitglieder deinen Namen, die Aufgaben der Sitzung
                mit allem, was ihr dazu eintragt (z. B. Tag, Uhrzeit, Priorität, Dauer, Ort, Link, Beschreibung, weitere
                Infos, Farbe, wer die Aufgabe wann angelegt hat, Untergruppe), Nachrichten, wer woran wie lange
                gearbeitet hat und den Verlauf der Sitzung. Untergruppen speichern ihren Namen,
                wer sie angelegt hat und wann. Fügst du
                eine eigene Aufgabe zu einer Sitzung hinzu, werden diese Angaben in die Sitzung übernommen; deine
                Erinnerungen, Wiederholungen und Gruppen bleiben privat. Aufgaben, die du mit
                Freunden teilst, sehen diese Freunde. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
                Verlässt du eine Sitzung oder löschst du dein Konto, bleibt im Verlauf der Sitzung nur ein Eintrag
                ohne Bezug zu deinem Konto. Jede Sitzung hat einen gemeinsamen Kalender: Er zeigt die Aufgaben der
                Sitzung an ihren Tagen, alle Mitglieder können dort planen; zusätzliche Daten entstehen dabei nicht.
            </p>
            <p>
                <strong>Quidey Family</strong>: Eine Family ist eine feste Gruppe, zu der du
                Freunde einlädst. Gespeichert werden Name der Family, wer sie gegründet hat, wer eingeladen wurde
                (von wem, wann) und wer beigetreten ist. Alle Mitglieder sehen die Namen der anderen Mitglieder, den
                gemeinsamen Kalender mit allem, was ihr eintragt (z. B. Tag, Uhrzeit, Priorität, Dauer, Ort, Link,
                Beschreibung, weitere Infos, Farbe, erledigt, wer den Eintrag wann angelegt hat, Untergruppe – diese
                speichern ihren Namen, wer sie angelegt hat und wann), und den Chat der Family
                (Text, Absender, Zeitpunkt). Dazu kommen die Pinnwand der Family (ein kurzer Text, den alle Mitglieder
                ändern können, mit wer ihn zuletzt geändert hat und wann), Emoji und Farbe der Family, die Liste
                (Einträge ohne Tag) und bei Einträgen, wer sie übernimmt. Mitglieder, die ihre Statistiken im Profil
                zeigen, sehen die anderen außerdem mit ihrer Fokuszeit, ihren XP und ihrer Serie der laufenden Woche;
                diese Werte werden nicht gespeichert, sondern bei jedem Aufruf berechnet. Eingeladene sehen nur Name,
                Gründer und Mitgliederzahl, bis sie beitreten. Verlässt du eine Family, bleiben deine Einträge und
                Nachrichten für die anderen sichtbar; was dir zugeteilt war, ist danach niemandem zugeteilt.
                Löscht die gründende Person die Family, werden Kalender und Chat für alle gelöscht. Rechtsgrundlage ist
                Art. 6 Abs. 1 lit. b DSGVO.
            </p>
            <p>
                <strong>Profil:</strong> Angemeldete Nutzer können dein Profil über deinen Benutzernamen aufrufen,
                sehen dort aber nur Benutzernamen und Anzeigenamen. Freiwillig kannst du dein Profil gestalten:
                Avatar (ein Emoji), Profilfarbe, Banner, Status, „Über mich“, Schule/Studium und bis zu sechs
                Interessen. Diese Angaben sehen nur deine Freunde – zusammen mit deinem Registrierungsdatum, dem Datum
                eurer Freundschaft und euren gemeinsamen Freunden. Aus deinen Sitzungen und Aufgaben berechnet Quidey
                Statistiken (z. B. Fokuszeit, Serien, Fokuszeit pro Tag und Wochentag, liebste Tageszeit, deine
                meistgenutzten Gruppen, Anzahl erledigter Aufgaben und gemeinsamer Sitzungen sowie daraus folgende
                Abzeichen). Sie werden nicht zusätzlich gespeichert, sondern bei jedem Aufruf berechnet; deine Freunde
                sehen sie, solange du das im Profil nicht ausschaltest. Alle freiwilligen Angaben kannst du jederzeit
                ändern oder löschen; bitte trage dort keine besonders sensiblen Daten ein. Rechtsgrundlage ist
                Art. 6 Abs. 1 lit. b DSGVO.
            </p>
            <p>
                <strong>Profilbild</strong> (derzeit nur für Tester): Lädst du freiwillig ein Profilbild hoch, wird es
                auf deinem Gerät quadratisch zugeschnitten und verkleinert (dabei fallen Angaben wie Aufnahmeort und
                Kamera weg) und dann mit dem Zeitpunkt der letzten Änderung zu deinem Konto gespeichert. Es sehen nur
                Personen, die auch deinen Online-Status sehen können: deine Freunde und die Mitglieder deiner laufenden
                gemeinsamen Sitzungen und Families; solange die Funktion im Test ist, wird es nur Testern angezeigt.
                Du kannst es jederzeit unter „Profil gestalten“ entfernen; es wird auch gelöscht, wenn du dein Konto
                löschst. Verstößt ein Bild gegen die Nutzungsbedingungen, kann der Betreiber es entfernen (das wird
                im Admin-Protokoll vermerkt). Lade bitte nur Bilder hoch, an denen du die Rechte hast, und keine Bilder
                anderer Personen ohne deren Einverständnis. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
            </p>
            <p>
                <strong>Level, XP und Challenges:</strong> Aus deiner Fokuszeit (eigene und gemeinsame Sitzungen,
                dafür wird deine Zeit in gemeinsamen Sitzungen auch pro Tag gespeichert), deinen erledigten Aufgaben
                und geschafften Challenges berechnet Quidey Erfahrungspunkte (XP) und dein Level. Gespeichert werden
                nur, welche Tages- oder Wochen-Challenge du wann geschafft hast (mit ihren XP) und das höchste Level,
                das du erreicht hast; die XP selbst werden bei jedem Aufruf neu berechnet. Mit dem Level schaltest du
                weitere Gestaltungsmöglichkeiten frei (Avatar-Rahmen, Titel, bis zu drei angeheftete Abzeichen), die
                deine Freunde auf deinem Profil sehen. Dein Level sehen deine Freunde in ihrer Freundesliste und im
                Feed. In der Wochenübersicht „Diese Woche unter Freund:innen“ erscheinen deine XP seit Montag nur,
                wenn du deine Statistiken im Profil zeigst, zusammen mit deiner aktuellen Serie (Tage mit Fokus in
                Folge). Deine eigene Serie, dein Rekord und die letzten sieben Tage werden ebenfalls nur berechnet,
                nicht gespeichert. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
            </p>
            <p>
                <strong>Online-Status:</strong> Solange du Quidey geöffnet hast, besteht eine Live-Verbindung zum
                Server. Daraus zeigt Quidey deinen Freunden und den Mitgliedern deiner laufenden gemeinsamen Sitzungen
                und deiner Families, dass du gerade online bist (ein grüner Punkt), und sagt ihnen Bescheid, wenn du
                kommst oder gehst. Gespeichert wird dabei nichts: Der Server kennt nur die gerade offenen Verbindungen,
                es gibt keinen Verlauf und kein „zuletzt online“. Im Profil unter „Profil gestalten“ kannst du das mit
                „Zeigen, wenn ich online bin“ jederzeit abschalten; dann erscheinst du für niemanden online.
                Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
            </p>
            <p>
                <strong>Feed:</strong> Im Feed unter „Gemeinschaft“ sehen deine Freunde – und nur sie – was du teilst:
                deine Fokuszeit und erledigten Aufgaben des Tages, geschaffte Challenges, neue Level und Lernserien,
                sowie kurze Beiträge (bis zu 280 Zeichen), die du selbst schreibst. Die automatischen Einträge kannst
                du im Profil unter „Profil gestalten“ mit „Meine Erfolge im Feed teilen“ abschalten; deine Beiträge
                teilst du immer selbst. Jeden deiner Einträge kannst du aus dem Feed nehmen. Freunde können Einträge
                „anfeuern“; gespeichert wird, wer welchen Eintrag wann angefeuert hat. Wer deine Einträge angefeuert
                hat, siehst nur du, andere sehen nur die Anzahl. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
            </p>
            <p>
                <strong>Nachrichten im Postfach:</strong> Du kannst deinen Freunden direkt schreiben. Gespeichert werden
                Absender, Empfänger, Text, Zeitpunkt und ob die Nachricht gelesen wurde. Eine Nachricht sehen nur ihr
                beide; ich lese sie nicht, außer es ist zur Abwehr von Missbrauch oder wegen einer gesetzlichen Pflicht
                nötig. Schreiben ist nur zwischen Freunden möglich. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
            </p>
            <p>
                <strong>Meldungen:</strong> Hinweise vom Quidey-Team (z. B. zu Neuerungen oder Wartungen) werden für
                jedes Konto gespeichert, mit dem Zeitpunkt, zu dem du sie gelesen hast. Du kannst sie im Postfach
                löschen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b und f DSGVO (Information über den Dienst).
                Weist dir jemand in einer gemeinsamen Sitzung eine Aufgabe zu, bekommst du dazu eine Meldung; gespeichert
                werden der Name der Aufgabe und der Sitzung, wer sie dir zugewiesen hat und wann. Sie bleibt, bis du sie
                löschst oder dein Konto löschst (Art. 6 Abs. 1 lit. b DSGVO).
                Erinnerungen im Postfach werden nur auf deinem Gerät aus deinen Aufgaben berechnet.
            </p>
            <p>
                <strong>Erinnerungen per E-Mail:</strong> Schaltest du bei einer Aufgabe „Auch per E-Mail erinnern“ ein,
                schickt dir Quidey zur eingestellten Zeit eine Mail an deine E-Mail-Adresse. Sie enthält den Namen der
                Aufgabe, Tag und Uhrzeit sowie – falls angegeben – Ort, Link und Beschreibung. Der Versand erfolgt über
                {' '}<V>{PROCESSORS.mailProvider}</V> als Auftragsverarbeiter (siehe Abschnitt 4). Gespeichert wird nur,
                für welchen Zeitpunkt die Erinnerung schon verschickt wurde, damit sie nicht doppelt kommt. Bei geteilten
                Aufgaben bekommt nur die Person die Mail, der die Aufgabe gehört. Du kannst die Mail-Erinnerung jederzeit
                in der Aufgabe wieder ausschalten. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
            </p>
            <p>
                <strong>Benachrichtigungen auf deinem Gerät (Push):</strong> Nur wenn du sie einschaltest (in den
                Einstellungen unter „App“ oder auf die Frage nach deiner ersten Aufgabe) und dein Browser es erlaubt,
                meldet sich Quidey auch bei geschlossener App: zu den Erinnerungen deiner Aufgaben und Termine (neue
                bekommen dann von selbst eine zum Beginn), wenn dein Fokus-Timer oder eine Pomodoro-Pause abgelaufen ist,
                zur geplanten Uhrzeit deiner Routinen, morgens mit einem Überblick über deinen Tag, bei Nachrichten, Freundschaftsanfragen,
                Einladungen, geteilten oder zugewiesenen Aufgaben und Meldungen des Quidey-Teams. Welche Arten du
                bekommst, stellst du je Gerät ein. Dafür erzeugt dein Browser bei seinem Push-Dienst eine Adresse; welcher
                Dienst das ist, bestimmt der Hersteller deines Browsers bzw. Betriebssystems (z. B. Google bei Chrome und
                Android, Apple bei Safari und auf iPhone/iPad, Mozilla bei Firefox), nicht Quidey. Gespeichert werden je
                Gerät diese Adresse, zwei Schlüssel zum Verschlüsseln, die gewählten Arten und wann das Gerät angemeldet
                bzw. zuletzt bestätigt wurde, zusammen mit deinem Konto; außerdem, für welchen Zeitpunkt eine Aufgabe schon
                gemeldet wurde und an welchem Tag der Tagesüberblick kam, damit nichts doppelt kommt. Eine Benachrichtigung
                enthält je nach Art den Namen und die Uhrzeit der Aufgabe (und den Ort), den Namen der Person, die dir
                schreibt oder dich einlädt, den Anfang der Nachricht bzw. den Namen der Sitzung, Family oder Aufgabe. Sie
                wird Ende-zu-Ende verschlüsselt (RFC 8291) übermittelt: Der Push-Dienst sieht nur verschlüsselte Daten
                und technische Angaben wie Adresse, Zeitpunkt und Größe; er kann sie auch in den USA verarbeiten.
                Benachrichtigungen erscheinen je nach Einstellung deines Geräts auch auf dem Sperrbildschirm. Ausschalten
                kannst du sie jederzeit in den Einstellungen oder in deinem Browser; der Eintrag des Geräts wird gelöscht,
                wenn du sie ausschaltest, dich abmeldest, dein Passwort änderst, dich überall abmeldest, dein Konto
                löschst oder der Push-Dienst die Adresse für ungültig erklärt. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b
                DSGVO; das Speichern auf deinem Gerät ist für diese von dir ausdrücklich gewünschte Funktion unbedingt
                erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG).
            </p>
            <p>
                <strong>Benachrichtigungen in der Android-App:</strong> In der App laufen Benachrichtigungen über Firebase
                Cloud Messaging von <V>{PROCESSORS.google}</V> („FCM“). Schaltest du sie ein (und erlaubst sie Android),
                vergibt FCM deinem Gerät eine Kennung (Token), die Quidey wie oben die Adresse eines Browsers speichert;
                Quidey legt außerdem je Art einen Benachrichtigungskanal an, den du in den Android-Einstellungen einzeln
                stummschalten kannst. Anders als im Browser ist der Inhalt dabei nicht Ende-zu-Ende verschlüsselt: Er wird
                verschlüsselt (TLS) an Google übertragen und von Google an dein Gerät zugestellt; Google verarbeitet dabei
                Token, Titel und Text der Benachrichtigung als Auftragsverarbeiter, auch in den USA (EU-US Data Privacy
                Framework, ergänzend Standardvertragsklauseln). Alles Weitere gilt wie oben.
            </p>

            {proBuilt() && <>
            <h2>7. Quidey Pro (Bezahlung)</h2>
            <p>
                Quidey ist kostenlos nutzbar. Wer die Entwicklung unterstützen möchte, kann Quidey Pro abonnieren
                (Nutzungsbedingungen, Abschnitt 8). Dafür speichere ich zu deinem Konto: Plan (monatlich oder jährlich),
                Zahlungsweg, Status, bis wann bezahlt ist, ob das Abo zum Ende gekündigt ist, wann es angelegt und
                geändert wurde, und die Kennungen beim Zahlungsdienst (Kunden- und Abo-Nummer bei Stripe bzw. das
                Kauf-Token von Google Play). Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, für die Aufbewahrung
                Art. 6 Abs. 1 lit. c DSGVO.
            </p>
            <p>
                <strong>Im Browser</strong> bezahlst du auf der Bezahlseite von <V>{PROCESSORS.payments}</V> („Stripe“).
                Stripe erhält dazu deine E-Mail-Adresse und eine Kundennummer zu deinem Konto und verarbeitet deine
                Zahlungsdaten (z. B. Karte, Name, Land) selbst; ich sehe sie nicht. Für die Zahlungsabwicklung und die
                Betrugsvorbeugung ist Stripe eigener Verantwortlicher; Stripe kann Daten auch in den USA verarbeiten
                (EU-US Data Privacy Framework, ergänzend Standardvertragsklauseln). Abo ändern, Rechnungen ansehen und
                kündigen kannst du im Kundenbereich von Stripe („Abo verwalten“).
            </p>
            <p>
                <strong>In der Android-App</strong> bezahlst du über Google Play; Verkäufer gegenüber dir ist dabei Google,
                das deine Zahlungsdaten in eigener Verantwortung verarbeitet. Quidey erhält von Google nur das Kauf-Token
                und prüft damit bei Google, welcher Plan bis wann bezahlt ist; Google meldet Änderungen (Verlängerung,
                Kündigung) von selbst an den Server. Damit ein Kauf nur deinem Konto zugeordnet werden kann, gibt die App
                Google dazu einen Prüfwert mit, der aus deiner Kontonummer berechnet ist und keine weiteren Angaben enthält.
            </p>
            <p>
                <strong>Kündigungsbutton:</strong> Über „Verträge hier kündigen“ kannst du ohne Anmeldung kündigen. Dabei
                verarbeite ich Namen, E-Mail-Adresse, optional Benutzername, Art der Kündigung, gegebenenfalls den Grund
                und den Zeitpunkt des Eingangs, schicke dir sofort eine Bestätigung (über Resend, Abschnitt 4) und mir eine
                Kopie zur Bearbeitung. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b und c DSGVO (§ 312k BGB).
            </p>
            <p>
                Rechnungs- und Buchungsbelege bewahre ich so lange auf, wie es das Steuer- und Handelsrecht verlangt
                (bis zu 10 Jahre, § 147 AO, § 257 HGB); die Abo-Einträge verlieren beim Löschen deines Kontos den Bezug zu
                ihm, bleiben aber dafür erhalten. Ein laufendes Abo wird beim Löschen des Kontos sofort beendet.
            </p>
            </>}

            <h2>{privacyNo(8)}. Kontaktformular, Feedback und E-Mail</h2>
            <p>
                Schreibst du mir über das Kontaktformular oder per E-Mail, verarbeite ich deinen Namen, deine
                E-Mail-Adresse und deine Nachricht, um sie zu beantworten. Sendest du in der App Feedback, gehen
                deine Nachricht, die gewählte Art (Idee, Fehler, Lob, Sonstiges), dein Benutzer- und Anzeigename und
                die E-Mail-Adresse für die Antwort an mich (vorausgefüllt mit der deines Kontos, du kannst eine andere
                angeben), damit ich nachfragen oder antworten kann; gespeichert wird das Feedback in Quidey selbst
                nicht. Dasselbe gilt, wenn du auf die Frage „Gefällt dir Quidey?“ antwortest und deine Antwort
                abschickst: dann gehen mit diesen Angaben auch Ja oder Nein und deine Sterne (1–5) an mich. Bist du angemeldet, füllt das Kontaktformular Name und E-Mail-Adresse aus deinem Konto vor;
                gesendet wird erst, was du abschickst. Formular und Feedback werden über
                {' '}<V>{PROCESSORS.mailProvider}</V> an mein Postfach weitergeleitet. Rechtsgrundlage ist
                Art. 6 Abs. 1 lit. f DSGVO (Beantwortung deiner Anfrage), bei Fragen zu deinem Konto Art. 6 Abs. 1
                lit. b DSGVO. Die Nachrichten lösche ich, sobald die Anfrage erledigt ist, spätestens nach
                12 Monaten, sofern keine gesetzliche Aufbewahrungspflicht besteht.
            </p>
            <p>
                <strong>Bewertungen als Tester:</strong> Bist du Tester, kannst du im Testbereich neue Gestaltungen
                der App und Funktionen im Test mit 1 bis 5 Sternen bewerten und kommentieren. Gespeichert werden je
                Thema deine Sterne, dein Kommentar und wann du sie zuletzt geändert hast, zusammen mit deinem Konto.
                Sehen können sie nur du und die Admins (mit deinem Benutzer- und Anzeigenamen), damit ich auswerten
                kann, was gut ankommt und was nicht. Du kannst jede Bewertung jederzeit ändern oder entfernen; mit
                deinem Konto werden sie gelöscht. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (Verbesserung der
                App anhand der Rückmeldungen ihrer Tester).
            </p>

            <h2>{privacyNo(9)}. Speicherung auf deinem Gerät</h2>
            <p>
                Quidey setzt keine Cookies. Im lokalen Speicher deines Browsers (localStorage) liegen nur:
            </p>
            <ul>
                <li>dein Anmelde-Token (7 Tage gültig, wird beim Abmelden gelöscht). Meldest du auf demselben Gerät
                    mehrere Konten an, um zwischen ihnen zu wechseln, liegen für jedes davon Token, Benutzer- und
                    Anzeigename (höchstens fünf Konten); beim Abmelden eines Kontos wird sein Eintrag gelöscht;</li>
                <li>deine Einstellungen: Sprache (bis du eine wählst, nimmt Quidey die deines Geräts), Design, Farbpalette, Akzentfarbe, Animationen, Töne, Startseite, ob Aufgaben aus gemeinsamen Sitzungen in deiner Liste stehen, Sitzungsdauer, Timer, Pomodoro oder Stoppuhr und die Pomodoro-Längen, dein Tagesziel für die Fokuszeit, im Fokusraum gewähltes Fokus-Geräusch, Lautstärke und Lernmethode, Kalenderansicht, als Tester die gewählte Gestaltung der App und die Farben, die du ihr gegeben hast;</li>
                <li>bei einem neuen Konto, wie viele Dinge du schon erledigt oder angelegt hast und ob Quidey dich schon
                    gefragt hat, ob du es installieren möchtest und ob es dir gefällt (nur eine Zahl und zwei Merker,
                    keine Inhalte);</li>
                <li>eine laufende Fokus-Sitzung, damit sie weiterläuft, auch wenn das Handy aus ist oder die App
                    geschlossen wird: Stand und Startzeitpunkt des Timers, Pomodoro-Phase und Runde, die Aufgabe im Fokus
                    (Nummer und Name) und die bisher gebuchte Zeit (wird nach 18 Stunden und beim Abmelden verworfen);
                    ebenso ein laufender Durchgang einer Routine (welche Routine, welcher Schritt, seit wann);</li>
                <li>was du im Fokusraum nur für dich notierst: das Ziel der Sitzung und die Gedanken auf dem
                    Gedankenparkplatz (sie bleiben auf diesem Gerät und werden nicht an den Server geschickt, außer du
                    machst eine Aufgabe daraus);</li>
                <li>welche Erinnerungen schon angezeigt wurden, an welchem Tag dich Quidey zuletzt an deine Serie erinnert hat und welche gemeinsame Sitzung gerade gestoppt wird;</li>
                <li>ob auf diesem Gerät Benachrichtigungen an sind, die Adresse dafür beim Push-Dienst (siehe Abschnitt 6) und ob Quidey dich danach schon gefragt hat;</li>
                <li>Schwierigkeit und Bestwerte der Spiele;</li>
                <li>in der Android-App deine Antwort auf die Frage nach den Nutzungsdaten (Abschnitt 3).</li>
            </ul>
            <p>
                Während einer Anmeldung mit Google merkt sich dein Browser bis zur Rückkehr von Google einen Zufallswert
                (sessionStorage), damit nur eine von dir begonnene Anmeldung angenommen wird; er wird danach gelöscht.
                In der Android-App liegt dasselbe im Speicher der App; es wird nicht in Datensicherungen deines Handys
                übernommen. Die App braucht keinen Service Worker und keinen Cache-Speicher (unten): Ihre Dateien sind
                in der App selbst enthalten.
            </p>
            <p>
                Damit Quidey sich als App installieren lässt, schnell startet und auch ohne Verbindung öffnet, legt ein
                Service Worker die Programmdateien der App (Seite, Skripte, Stylesheets, Schrift, Icons) im Cache-Speicher
                deines Browsers ab. Darin liegen keine personenbezogenen Daten: Deine Aufgaben, Nachrichten und
                Kontodaten werden immer direkt vom Server geladen und nicht zwischengespeichert. Bei jeder neuen
                Version werden die alten Dateien ersetzt. Derselbe Service Worker zeigt die Benachrichtigungen an, wenn
                du sie eingeschaltet hast; er speichert sie nicht.
            </p>
            <p>
                Das ist für die von dir gewünschten Funktionen unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG);
                eine Einwilligung und ein Cookie-Banner sind dafür nicht nötig. Diese Daten verlassen dein Gerät nicht
                (außer dem Token bei Anfragen an Quidey und der Sprache, siehe Abschnitt 4). Du kannst sie jederzeit in deinem Browser löschen.
                Setzt Cloudflare zur Abwehr von Bots im Einzelfall ein technisch notwendiges Sicherheits-Cookie,
                dient es allein der Sicherheit des Dienstes (§ 25 Abs. 2 Nr. 2 TDDDG, Art. 6 Abs. 1 lit. f DSGVO).
            </p>

            <h2>{privacyNo(10)}. Speicherdauer</h2>
            <p>
                Deine Konto- und Inhaltsdaten speichere ich, solange dein Konto besteht. Löschst du dein Konto, werden
                Konto, Aufgaben, Events, Event-Typen, Gruppen, Sitzungen, Freundschaften, Mitgliedschaften, deine Meldungen,
                geschafften Challenges, deine Feed-Einträge und Beiträge (mit dem Anfeuern darauf), dein Anfeuern bei anderen, deine Bewertungen als Tester, die für Benachrichtigungen angemeldeten Geräte, deine Notizen (mit ihren Bildern), dein Profilbild, Routinen und ihre Durchgänge, der Wecker deines Fokus-Timers und alle
                Nachrichten, die du geschrieben oder bekommen hast, sofort gelöscht – auch beim Gegenüber, auch deine
                Nachrichten in Family-Chats. Einträge in Protokollen (Verlauf gemeinsamer Sitzungen, Admin-Protokoll)
                und von dir angelegte Einträge in Family-Kalendern verlieren den Bezug zu deinem Konto. Hast du eine
                Family gegründet, übernimmt das am längsten beigetretene Mitglied sie; ist niemand sonst darin, wird
                sie mit Kalender und Chat gelöscht.
                Wie lange Feedback und Kontaktanfragen aufbewahrt werden, steht in Abschnitt {privacyNo(8)}
                {proBuilt() && ', wie lange Zahlungsbelege, in Abschnitt 7'}.
                In Datensicherungen können Daten bis zu deren turnusmäßiger Überschreibung (höchstens 30 Tage)
                erhalten bleiben. Gesetzliche Aufbewahrungspflichten bleiben unberührt.
            </p>

            <h2>{privacyNo(11)}. Empfänger</h2>
            <p>
                Daten erhalten nur die oben genannten Auftragsverarbeiter (Hosting, E-Mail-Versand, in der Android-App
                Firebase Cloud Messaging) sowie – soweit du es veranlasst – deine Freunde (auch als Empfänger deiner
                Nachrichten), Mitglieder gemeinsamer Sitzungen und Families, wenn du Benachrichtigungen eingeschaltet
                hast der Push-Dienst deines Browsers (nur verschlüsselt, siehe Abschnitt 6), wenn du dich mit Google
                anmeldest Google (Abschnitt 4), wenn du in der Android-App in die Analyse einwilligst Google
                (Abschnitt 3){proBuilt() ? ' und wenn du Quidey Pro bezahlst Stripe bzw. Google (Abschnitt 7)' : ''}. Ich verkaufe keine Daten und gebe
                sie nicht für Werbung weiter. Eine automatisierte Entscheidungsfindung oder Profilbildung
                (Art. 22 DSGVO) findet nicht statt.
            </p>

            <h2>{privacyNo(12)}. Deine Rechte</h2>
            <p>Du hast das Recht auf</p>
            <ul>
                <li>Auskunft über deine gespeicherten Daten (Art. 15 DSGVO),</li>
                <li>Berichtigung (Art. 16 DSGVO) – Anzeigename, E-Mail-Adresse und alle Profilangaben kannst du im Profil selbst ändern,</li>
                <li>Löschung (Art. 17 DSGVO) – im Profil unter „Konto löschen“,</li>
                <li>Einschränkung der Verarbeitung (Art. 18 DSGVO),</li>
                <li>Datenübertragbarkeit (Art. 20 DSGVO),</li>
                <li>Widerspruch gegen Verarbeitungen auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO (Art. 21 DSGVO).</li>
            </ul>
            <p>
                Schreib dafür formlos an <V>{OWNER.email}</V>. Außerdem kannst du dich bei einer
                Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO), etwa bei der Behörde deines Wohnorts.
            </p>

            <h2>{privacyNo(13)}. Sicherheit</h2>
            <p>
                Die Verbindung ist per TLS verschlüsselt. Passwörter werden nur gehasht gespeichert, Anmeldungen lassen
                sich im Profil auf allen Geräten beenden, und der Zugang zu Datenbank und Server ist beschränkt.
            </p>

            <h2>{privacyNo(14)}. Änderungen</h2>
            <p>
                Ändern sich die App oder die Rechtslage, passe ich diese Erklärung an. Es gilt die hier
                veröffentlichte Fassung.
            </p>
        </>
    );
}

function Terms() {
    return (
        <>
            <p className={styles.meta}>Stand: {LEGAL_VERSION_DATE}</p>

            <h2>1. Geltungsbereich</h2>
            <p>
                Diese Bedingungen gelten für die Nutzung der App „Quidey“ (Website, Android-App und zugehöriger Dienst),
                betrieben von <V>{OWNER.name}</V> („Betreiber“){proBuilt() && ', und für das Abo Quidey Pro (Abschnitt 8)'}. Mit der
                Registrierung akzeptierst du sie.
            </p>

            <h2>2. Leistung und Beta</h2>
            {proBuilt() ? <p>
                Quidey ist eine kostenlos nutzbare App zur Planung von Aufgaben und Arbeitssitzungen und befindet sich in
                einer geschlossenen Beta: Zugang haben Testerinnen und Tester (auf Antrag freigeschaltet) und wer Quidey Pro
                hat. Nach der Beta steht Quidey allen offen; der kostenlose Plan hat dann Grenzen (derzeit 10 offene
                Aufgaben, 5 anstehende Termine, 3 Gruppen, 1 gemeinsame Sitzung gleichzeitig, 3 Freunde, Statistiken der
                laufenden Woche), Quidey Pro nicht. Ein Anspruch auf Zugang zur Beta, auf bestimmte Funktionen oder auf
                ständige Verfügbarkeit besteht nicht; für Quidey Pro gilt Abschnitt 8. Funktionen können geändert, eingeschränkt oder eingestellt werden. Wird der Dienst
                eingestellt, kündige ich das nach Möglichkeit vorher an.
            </p> : <p>
                Quidey ist eine kostenlose App zur Planung von Aufgaben und Arbeitssitzungen und befindet sich in einer
                geschlossenen Beta: Zugang haben Testerinnen und Tester (auf Antrag freigeschaltet). Ein Anspruch auf
                Zugang, auf bestimmte Funktionen oder auf ständige Verfügbarkeit besteht nicht. Funktionen können
                geändert, eingeschränkt oder eingestellt werden. Wird der Dienst eingestellt, kündige ich das nach
                Möglichkeit vorher an.
            </p>}

            <h2>3. Konto</h2>
            <p>
                Du musst mindestens 14 Jahre alt sein; bist du minderjährig, brauchst du die Zustimmung deiner Eltern.
                Deine Angaben müssen wahr sein. Halte dein Passwort geheim; für Handlungen über dein Konto bist du
                verantwortlich, solange du den Zugriff zu vertreten hast. Jede Person darf nur ein Konto führen.
                Du kannst dein Konto jederzeit im Profil löschen.
            </p>

            <h2>4. Rechte des Betreibers</h2>
            <p>
                Quidey – einschließlich Name, Logo, Gestaltung, Texte, Animationen, Spiele und Quellcode – ist geistiges
                Eigentum des Betreibers und urheber- und kennzeichenrechtlich geschützt. Alle Rechte bleiben vorbehalten.
            </p>
            <p>
                Du erhältst für die Dauer deines Kontos ein einfaches, nicht übertragbares, nicht unterlizenzierbares und
                widerrufliches Recht, Quidey bestimmungsgemäß für eigene Zwecke zu nutzen. Nicht erlaubt ist insbesondere:
            </p>
            <ul>
                <li>die App oder Teile davon zu kopieren, zu verbreiten, zu verkaufen oder öffentlich zugänglich zu machen;</li>
                <li>den Quellcode zu dekompilieren, nachzubauen oder für eigene Produkte zu verwenden, soweit das Gesetz es nicht ausdrücklich erlaubt (§ 69e UrhG);</li>
                <li>Name, Logo oder Gestaltung von Quidey für eigene Angebote zu verwenden;</li>
                <li>Daten automatisiert auszulesen (Scraping), Sicherheitsmaßnahmen zu umgehen oder den Dienst zu überlasten;</li>
                <li>Text und Data Mining der App und ihrer Inhalte; dieser Nutzung wird nach § 44b Abs. 3 UrhG ausdrücklich widersprochen.</li>
            </ul>

            <h2>5. Deine Inhalte</h2>
            <p>
                Was du in Quidey eingibst, bleibt deins. Du räumst dem Betreiber nur die Rechte ein, die nötig sind, um
                die App für dich zu betreiben: deine Inhalte zu speichern, zu verarbeiten und den Personen anzuzeigen,
                mit denen du sie teilst. Dieses Recht endet mit der Löschung der Inhalte oder deines Kontos.
                Du bist dafür verantwortlich, keine rechtswidrigen Inhalte einzugeben und keine Rechte Dritter zu verletzen.
            </p>

            <h2>6. Verhalten</h2>
            <p>
                Belästigung, Beleidigung, Spam und rechtswidrige Inhalte in Nachrichten, Feed-Beiträgen, Namen,
                Profilbildern oder geteilten Aufgaben sind verboten. Als Profilbild sind nur Bilder erlaubt, an denen du
                die Rechte hast; Bilder anderer Personen nur mit deren Einverständnis, keine pornografischen,
                gewaltverherrlichenden oder diskriminierenden Darstellungen. XP, Level und Challenges sind ein Spiel ohne Geldwert; wer sie mit
                künstlich erzeugten Sitzungen oder Aufgaben in die Höhe treibt, kann sie zurückgesetzt bekommen. Bei Verstößen kann der Betreiber Inhalte entfernen und den Zugang sperren oder das Konto
                löschen; bei schweren Verstößen ohne vorherige Warnung.
            </p>

            <h2>7. Haftung</h2>
            {proBuilt() ? <p>
                Der Betreiber haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei Verletzung von Leben,
                Körper oder Gesundheit sowie nach dem Produkthaftungsgesetz. Bei der kostenlosen Nutzung ist die Haftung
                im Übrigen ausgeschlossen, soweit gesetzlich zulässig; §§ 521, 599 BGB gelten entsprechend. Bei Quidey
                Pro haftet der Betreiber für leichte Fahrlässigkeit nur bei Verletzung wesentlicher Vertragspflichten
                und begrenzt auf den vorhersehbaren, vertragstypischen Schaden. Sichere wichtige Daten (z. B. Termine)
                bitte zusätzlich an anderer Stelle.
            </p> : <p>
                Quidey wird unentgeltlich bereitgestellt. Der Betreiber haftet unbeschränkt bei Vorsatz und grober
                Fahrlässigkeit, bei Verletzung von Leben, Körper oder Gesundheit sowie nach dem Produkthaftungsgesetz.
                Im Übrigen ist die Haftung ausgeschlossen, soweit gesetzlich zulässig; §§ 521, 599 BGB gelten
                entsprechend. Sichere wichtige Daten (z. B. Termine) bitte zusätzlich an anderer Stelle.
            </p>}

            {proBuilt() && <>
            <h2 id="pro">8. Quidey Pro</h2>
            <p>
                <strong>Wozu:</strong> Quidey Pro ist ein freiwilliges Abo, mit dem du die Entwicklung von Quidey
                unterstützt. Es hebt die Grenzen des kostenlosen Plans auf (Abschnitt 2) und gibt während der Beta Zugang
                zur App. Funktionen im Test bleiben Testerinnen und Testern vorbehalten. Ein Anspruch auf bestimmte
                künftige Funktionen besteht nicht.
            </p>
            <p>
                <strong>Preise:</strong> 2,99 € im Monat oder 25,00 € im Jahr. Das sind Endpreise; gemäß § 19 UStG wird
                keine Umsatzsteuer berechnet. Im Voraus fällig für den jeweiligen Zeitraum.
            </p>
            <p>
                <strong>Vertragsschluss:</strong> Im Browser wählst du einen Plan und gelangst zur Bezahlseite von Stripe;
                mit dem Klick auf den Bestellknopf dort gibst du ein verbindliches Angebot ab, das mit der Bestätigung der
                Zahlung angenommen ist. In der Android-App kaufst du über Google Play; dafür gelten zusätzlich die
                Bedingungen von Google Play, Verkäufer und Ansprechpartner für Zahlung, Erstattung und Kündigung ist dort
                Google.
            </p>
            <p>
                <strong>Laufzeit und Kündigung:</strong> Das Abo läuft einen Monat bzw. ein Jahr und verlängert sich
                automatisch um denselben Zeitraum, wenn du nicht kündigst. Du kannst jederzeit zum Ende des laufenden
                Zeitraums kündigen: angemeldet über „Abo verwalten“ auf der Seite „Quidey unterstützen“, ohne Anmeldung
                über <Link to="/kuendigen">„Verträge hier kündigen“</Link> unten auf jeder Seite, oder in Textform an
                {' '}<V>{OWNER.email}</V>. Abos aus Google Play kündigst du im Play Store. Das Recht zur außerordentlichen
                Kündigung aus wichtigem Grund bleibt unberührt. Löschst du dein Konto, endet das Abo sofort; bereits
                bezahlte Zeiträume werden dann nicht anteilig erstattet, außer im Fall eines Widerrufs (unten).
            </p>
            <p>
                <strong>Preisänderungen</strong> gelten für ein laufendes Abo nur, wenn du ihnen zustimmst; ich informiere
                dich mindestens vier Wochen vorher. Stimmst du nicht zu, endet das Abo zum Ende des bezahlten Zeitraums.
            </p>
            <p>
                <strong>Zahlung:</strong> Schlägt eine Zahlung fehl, versucht der Zahlungsdienst sie einige Tage lang
                erneut; gelingt sie nicht, endet Pro mit dem bezahlten Zeitraum. Deine Inhalte bleiben erhalten.
            </p>

            <h2 id="widerruf">9. Widerrufsbelehrung</h2>
            <p><strong>Widerrufsrecht</strong></p>
            <p>
                Du hast das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die
                Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses. Um dein Widerrufsrecht
                auszuüben, musst du mir (<V>{OWNER.name}</V>, <V>{OWNER.street}</V>, <V>{OWNER.city}</V>, E-Mail:
                {' '}<V>{OWNER.email}</V>) mittels einer eindeutigen Erklärung (z. B. eine E-Mail) über deinen
                Entschluss, diesen Vertrag zu widerrufen, informieren. Du kannst dafür das unten stehende
                Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist. Zur Wahrung der Widerrufsfrist
                reicht es aus, dass du die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist
                absendest.
            </p>
            <p><strong>Folgen des Widerrufs</strong></p>
            <p>
                Wenn du diesen Vertrag widerrufst, zahle ich dir alle Zahlungen, die ich von dir erhalten habe,
                unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurück, an dem die Mitteilung über deinen
                Widerruf bei mir eingegangen ist – vollständig, auch wenn du Pro in dieser Zeit schon genutzt hast. Für
                diese Rückzahlung verwende ich dasselbe Zahlungsmittel, das du bei der ursprünglichen Transaktion
                eingesetzt hast, es sei denn, mit dir wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden
                dir wegen dieser Rückzahlung Entgelte berechnet.
            </p>
            <p>
                Für Käufe über Google Play gelten für Widerruf und Erstattung die Regeln von Google Play, da Google dort
                der Verkäufer ist.
            </p>
            <p><strong>Muster-Widerrufsformular</strong></p>
            <p>
                (Wenn du den Vertrag widerrufen willst, fülle bitte dieses Formular aus und sende es zurück.)<br />
                – An <V>{OWNER.name}</V>, <V>{OWNER.street}</V>, <V>{OWNER.city}</V>, E-Mail: <V>{OWNER.email}</V>:<br />
                – Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über die Erbringung der
                folgenden Dienstleistung: Quidey Pro (monatlich / jährlich)<br />
                – Bestellt am (*)<br />
                – Name des/der Verbraucher(s)<br />
                – Anschrift des/der Verbraucher(s)<br />
                – Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier)<br />
                – Datum<br />
                (*) Unzutreffendes streichen.
            </p>
            </>}

            <h2>{termsNo(10)}. Änderungen dieser Bedingungen</h2>
            <p>
                Der Betreiber kann diese Bedingungen mit Wirkung für die Zukunft ändern, etwa wegen neuer Funktionen oder
                geänderter Rechtslage. Über wesentliche Änderungen wirst du vorher informiert; widersprichst du nicht
                innerhalb von vier Wochen oder nutzt du Quidey weiter, gelten sie als angenommen. Darauf wirst du in der
                Mitteilung hingewiesen. Bei Widerspruch kannst du dein Konto löschen.
            </p>

            <h2>{termsNo(11)}. Schlussbestimmungen</h2>
            <p>
                Es gilt deutsches Recht; zwingende Verbraucherschutzvorschriften deines Wohnsitzstaates bleiben unberührt.
                Ist eine Bestimmung unwirksam, bleiben die übrigen wirksam.
            </p>
        </>
    );
}
