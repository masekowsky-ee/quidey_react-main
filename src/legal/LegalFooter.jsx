import { Link } from 'react-router-dom';
import styles from './Legal.module.css';
import { OWNER, COPYRIGHT_YEAR, isPlaceholder } from './owner';

// The footer with the legal links, on every screen. Its own file, so the app can show it
// without loading the legal texts themselves (LegalPage loads when one of them is opened).
export function LegalFooter() {
    const name = OWNER.name;
    return (
        <footer className={styles.footer}>
            <span>© {COPYRIGHT_YEAR} {isPlaceholder(name) ? <mark className={styles.todo}>{name}</mark> : name}</span>
            <nav className={styles.footerLinks} aria-label="Rechtliches">
                <Link to="/impressum">Impressum</Link>
                <Link to="/datenschutz">Datenschutz</Link>
                <Link to="/nutzungsbedingungen">Nutzungsbedingungen</Link>
                <Link to="/kontakt">Kontakt</Link>
            </nav>
        </footer>
    );
}
