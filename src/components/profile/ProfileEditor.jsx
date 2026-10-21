import styles from './ProfileParts.module.css';
import { useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import {
    PROFILE_COLORS, PROFILE_BANNERS, PROFILE_EMOJIS, DEFAULT_BANNER,
    BIO_MAX, STATUS_MAX, STUDY_MAX, INTERESTS_MAX, INTEREST_MAX, saveProfile,
} from '../../features/profile/profileOptions';

// The fields of a profile the editor works on
const draftOf = (profile) => ({
    emoji: profile.emoji ?? null,
    color: profile.color ?? null,
    banner: profile.banner ?? DEFAULT_BANNER,
    status: profile.status ?? '',
    bio: profile.bio ?? '',
    study: profile.study ?? '',
    interests: profile.interests ?? [],
    showStats: profile.showStats ?? true,
});

// Set up my profile: avatar, colour, banner, status, bio, interests and who sees my numbers.
// onChange(draft) lets the page show a live preview; onSaved(profile) gets the saved profile.
export default function ProfileEditor({ profile, onChange, onSaved, onClose }) {
    const { t } = useTranslation();
    const [draft, setDraft] = useState(() => draftOf(profile));
    const [tag, setTag] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const update = (changes) => {
        const next = { ...draft, ...changes };
        setDraft(next);
        setError(null);
        onChange?.(next);
    };

    const addTag = () => {
        const text = tag.trim();
        if (!text || draft.interests.length >= INTERESTS_MAX) return;
        if (!draft.interests.some(existing => existing.toLowerCase() === text.toLowerCase())) {
            update({ interests: [...draft.interests, text] });
        }
        setTag('');
    };

    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            // a tag still in the field counts too
            const pending = tag.trim();
            const interests = pending && draft.interests.length < INTERESTS_MAX
                && !draft.interests.some(x => x.toLowerCase() === pending.toLowerCase())
                ? [...draft.interests, pending] : draft.interests;
            const saved = await saveProfile({ ...draft, interests });
            setTag('');
            onSaved(saved);
        } catch {
            setError(t('profileCustomError'));
            setSaving(false);
        }
    };

    const radio = (name, value, current, face, label) => (
        <label key={value ?? 'none'} className={styles.choice} title={label}>
            <input type="radio" name={name} checked={current === value} aria-label={label}
                onChange={() => update({ [name]: value })} />
            {face}
        </label>
    );

    return (
        <form className={styles.editor} onSubmit={submit}>
            <div className={styles.editorHead}>
                <h2>{t('profileCustomize')}</h2>
            </div>
            <p className={styles.hint}>{t('profileVisibilityHint')}</p>

            <fieldset className={styles.field}>
                <legend>{t('profileAvatar')}</legend>
                <div className={styles.choices}>
                    {radio('emoji', null, draft.emoji, <span className={styles.choiceFace}><span className={styles.choiceText}>Aa</span></span>, t('profileAvatarInitials'))}
                    {PROFILE_EMOJIS.map(emoji => radio('emoji', emoji, draft.emoji, <span className={styles.choiceFace}>{emoji}</span>, emoji))}
                </div>
            </fieldset>

            <fieldset className={styles.field}>
                <legend>{t('profileColor')}</legend>
                <div className={styles.choices}>
                    {radio('color', null, draft.color, <span className={`${styles.choiceFace} ${styles.swatch} ${styles.swatchAccent}`} />, t('profileColorAccent'))}
                    {PROFILE_COLORS.map(color => radio('color', color, draft.color,
                        <span className={`${styles.choiceFace} ${styles.swatch}`} data-task-color={color} />, t(`taskColor_${color}`)))}
                </div>
            </fieldset>

            <fieldset className={styles.field}>
                <legend>{t('profileBanner')}</legend>
                <div className={styles.choices}>
                    {PROFILE_BANNERS.map(banner => radio('banner', banner, draft.banner,
                        <span className={`${styles.choiceFace} ${styles.bannerChoice}`} data-task-color={draft.color ?? undefined}>
                            <span className={styles.banner} data-banner={banner} />
                        </span>, t(`profileBanner_${banner}`)))}
                </div>
            </fieldset>

            <div className={styles.field}>
                <label htmlFor="profileStatus">{t('profileStatus')}</label>
                <input id="profileStatus" type="text" value={draft.status} maxLength={STATUS_MAX}
                    placeholder={t('profileStatusPlaceholder')} onChange={(e) => update({ status: e.target.value })} />
            </div>

            <div className={styles.field}>
                <label htmlFor="profileBio">{t('profileBio')}</label>
                <textarea id="profileBio" value={draft.bio} maxLength={BIO_MAX} rows={3}
                    placeholder={t('profileBioPlaceholder')} onChange={(e) => update({ bio: e.target.value })} />
                <span className={styles.counter} aria-live="polite">{draft.bio.length}/{BIO_MAX}</span>
            </div>

            <div className={styles.field}>
                <label htmlFor="profileStudy">{t('profileStudy')}</label>
                <input id="profileStudy" type="text" value={draft.study} maxLength={STUDY_MAX}
                    placeholder={t('profileStudyPlaceholder')} onChange={(e) => update({ study: e.target.value })} />
            </div>

            <div className={styles.field}>
                <label htmlFor="profileTag">{t('profileInterests')} ({draft.interests.length}/{INTERESTS_MAX})</label>
                {draft.interests.length > 0 && (
                    <ul className={styles.chips}>
                        {draft.interests.map(item => (
                            <li key={item} className={styles.chip}>
                                {item}
                                <button type="button" aria-label={`${t('profileInterestRemove')}: ${item}`}
                                    onClick={() => update({ interests: draft.interests.filter(x => x !== item) })}>✕</button>
                            </li>
                        ))}
                    </ul>
                )}
                <div className={styles.tagRow}>
                    <input id="profileTag" type="text" value={tag} maxLength={INTEREST_MAX}
                        disabled={draft.interests.length >= INTERESTS_MAX}
                        placeholder={t('profileInterestsPlaceholder')}
                        onChange={(e) => setTag(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
                    <button type="button" onClick={addTag} disabled={!tag.trim() || draft.interests.length >= INTERESTS_MAX}>
                        {t('profileInterestAdd')}
                    </button>
                </div>
            </div>

            <label className={styles.toggle}>
                <input type="checkbox" checked={draft.showStats} onChange={(e) => update({ showStats: e.target.checked })} />
                <span>
                    {t('profileShowStats')}
                    <small>{t('profileShowStatsHint')}</small>
                </span>
            </label>

            <div className={styles.formActions}>
                {error && <p className={styles.messageError} role="alert">{error}</p>}
                <button type="button" onClick={onClose}>{t('cancel')}</button>
                <button type="submit" className={styles.saveBtn} disabled={saving}>{saving ? t('saving') : t('save')}</button>
            </div>
        </form>
    );
}
