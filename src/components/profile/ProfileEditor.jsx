import styles from './ProfileParts.module.css';
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { fill } from '../../features/helperFunction';
import Icon from '../icons';
import {
    PROFILE_COLORS, PROFILE_BANNERS, PROFILE_EMOJIS, AVATAR_FRAMES, DEFAULT_BANNER,
    BIO_MAX, STATUS_MAX, STUDY_MAX, INTERESTS_MAX, INTEREST_MAX, saveProfile,
} from '../../features/profile/profileOptions';
import { PROFILE_TITLES, SHOWCASE_LEVEL, SHOWCASE_MAX, TITLES_FROM, requiredLevel } from '../../features/progress/progress';
import { badgesFor } from '../../features/profile/badges';
import TesterOnly from '../TesterOnly.jsx';
import AvatarUpload from './AvatarUpload.jsx';

// The fields of a profile the editor works on
const draftOf = (profile) => ({
    emoji: profile.emoji ?? null,
    color: profile.color ?? null,
    banner: profile.banner ?? DEFAULT_BANNER,
    frame: profile.frame ?? null,
    title: profile.title ?? null,
    showcase: profile.showcase ?? [],
    status: profile.status ?? '',
    bio: profile.bio ?? '',
    study: profile.study ?? '',
    interests: profile.interests ?? [],
    showStats: profile.showStats ?? true,
    shareActivity: profile.shareActivity ?? true,
    showOnline: profile.showOnline ?? true,
});

// Set up my profile: avatar, frame, colour, banner, title, pinned badges, status, bio,
// interests, and who sees my numbers and progress. Most choices come with levels: a locked one
// stays readable, says the level it comes at, and can't be picked (what I already have stays).
// onChange(draft) lets the page show a live preview; onSaved(profile) gets the saved profile.
export default function ProfileEditor({ profile, onChange, onSaved, onClose }) {
    const { t } = useTranslation();
    const progressLevel = useSelector(state => state.progress.data?.unlockLevel ?? 1);
    const level = Math.max(progressLevel, profile.level ?? 1);
    const [draft, setDraft] = useState(() => draftOf(profile));
    const [tag, setTag] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const earnedBadges = badgesFor(profile.stats).filter(badge => badge.earned);
    const saved = draftOf(profile);

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
            const result = await saveProfile({ ...draft, interests });
            setTag('');
            onSaved(result);
        } catch (err) {
            const key = `profileError_${err?.code}`;
            setError(t(key) === key ? t('profileCustomError') : t(key));
            setSaving(false);
        }
    };

    // locked: above my level, unless it is what the profile already has
    const lockedLevel = (name, value) => {
        const needed = requiredLevel(name, value);
        return needed > level && saved[name] !== value ? needed : null;
    };

    // a choice as a tile (`className` of its face) with the level it comes at on its corner,
    // or, for the titles (className null), as a chip with the level inside it
    const radio = (name, value, current, face, label, className = styles.choiceFace) => {
        const locked = lockedLevel(name, value);
        const text = locked ? fill(t('lockedChoice'), { name: label, level: locked }) : label;
        return (
            <label key={value ?? 'none'} className={styles.choice} title={text} data-locked={Boolean(locked)}>
                <input type="radio" name={name} checked={current === value} aria-label={text} disabled={Boolean(locked)}
                    onChange={() => update({ [name]: value })} />
                {className
                    ? <span className={className}>{face}</span>
                    : <span className={styles.titleChoice}>{face}{locked && <span className={styles.lockInline} aria-hidden="true">{locked}</span>}</span>}
                {locked && className && <span className={styles.lockBadge} aria-hidden="true">{locked}</span>}
            </label>
        );
    };

    const titlesLocked = level < TITLES_FROM && !saved.title;
    const showcaseLocked = level < SHOWCASE_LEVEL && saved.showcase.length === 0;
    const toggleBadge = (id) => update({
        showcase: draft.showcase.includes(id) ? draft.showcase.filter(x => x !== id) : [...draft.showcase, id].slice(0, SHOWCASE_MAX),
    });

    return (
        <form className={styles.editor} onSubmit={submit}>
            <div className={styles.editorHead}>
                <h2>{t('profileCustomize')}</h2>
            </div>
            <p className={styles.hint}>{t('profileVisibilityHint')} {fill(t('profileLevelHint'), { level })}</p>

            {/* profile pictures are in test */}
            <TesterOnly><AvatarUpload /></TesterOnly>

            <fieldset className={styles.field}>
                <legend>{t('profileAvatar')}</legend>
                <div className={styles.choices}>
                    {radio('emoji', null, draft.emoji, <span className={styles.choiceText}>Aa</span>, t('profileAvatarInitials'))}
                    {PROFILE_EMOJIS.map(emoji => radio('emoji', emoji, draft.emoji, emoji, emoji))}
                </div>
            </fieldset>

            <fieldset className={styles.field}>
                <legend>{t('profileFrame')}</legend>
                <div className={styles.choices}>
                    {[null, ...AVATAR_FRAMES].map(frame => radio('frame', frame, draft.frame,
                        <span className={styles.frameDemo} data-frame={frame ?? undefined} data-task-color={draft.color ?? undefined} />,
                        frame ? t(`frame_${frame}`) : t('profileFrameNone'),
                        `${styles.choiceFace}`))}
                </div>
            </fieldset>

            <fieldset className={styles.field}>
                <legend>{t('profileColor')}</legend>
                <div className={styles.choices}>
                    {radio('color', null, draft.color, null, t('profileColorAccent'), `${styles.choiceFace} ${styles.swatch} ${styles.swatchAccent}`)}
                    {PROFILE_COLORS.map(color => {
                        const locked = lockedLevel('color', color);
                        const label = t(`taskColor_${color}`);
                        const text = locked ? fill(t('lockedChoice'), { name: label, level: locked }) : label;
                        return (
                            <label key={color} className={styles.choice} title={text} data-locked={Boolean(locked)}>
                                <input type="radio" name="color" checked={draft.color === color} aria-label={text} disabled={Boolean(locked)}
                                    onChange={() => update({ color })} />
                                <span className={`${styles.choiceFace} ${styles.swatch}`} data-task-color={color} />
                                {locked && <span className={styles.lockBadge} aria-hidden="true">{locked}</span>}
                            </label>
                        );
                    })}
                </div>
            </fieldset>

            <fieldset className={styles.field}>
                <legend>{t('profileBanner')}</legend>
                <div className={styles.choices}>
                    {PROFILE_BANNERS.map(banner => {
                        const locked = lockedLevel('banner', banner);
                        const label = t(`profileBanner_${banner}`);
                        const text = locked ? fill(t('lockedChoice'), { name: label, level: locked }) : label;
                        return (
                            <label key={banner} className={styles.choice} title={text} data-locked={Boolean(locked)}>
                                <input type="radio" name="banner" checked={draft.banner === banner} aria-label={text} disabled={Boolean(locked)}
                                    onChange={() => update({ banner })} />
                                <span className={`${styles.choiceFace} ${styles.bannerChoice}`} data-task-color={draft.color ?? undefined}>
                                    <span className={styles.banner} data-banner={banner} />
                                </span>
                                {locked && <span className={styles.lockBadge} aria-hidden="true">{locked}</span>}
                            </label>
                        );
                    })}
                </div>
            </fieldset>

            <fieldset className={styles.field} disabled={titlesLocked}>
                <legend>{t('profileTitle')}</legend>
                <div className={styles.choices}>
                    {[null, ...PROFILE_TITLES].map(title => radio('title', title, draft.title,
                        title ? t(`title_${title}`) : t('profileTitleNone'),
                        title ? t(`title_${title}`) : t('profileTitleNone'), null))}
                </div>
                {titlesLocked && <p className={styles.choiceGroupNote}>{fill(t('lockedAt'), { level: TITLES_FROM })}</p>}
            </fieldset>

            <fieldset className={styles.field} disabled={showcaseLocked}>
                <legend>{t('profileShowcase')} ({draft.showcase.length}/{SHOWCASE_MAX})</legend>
                {earnedBadges.length === 0
                    ? <p className={styles.choiceGroupNote}>{t('profileShowcaseNone')}</p>
                    : (
                        <div className={styles.choices}>
                            {earnedBadges.map(badge => {
                                const on = draft.showcase.includes(badge.id);
                                return (
                                    <label key={badge.id} className={styles.choice} data-locked={showcaseLocked}>
                                        <input type="checkbox" checked={on} onChange={() => toggleBadge(badge.id)}
                                            disabled={showcaseLocked || (!on && draft.showcase.length >= SHOWCASE_MAX)} />
                                        <span className={styles.titleChoice}><Icon name={badge.icon} size={14} />&nbsp;{t(`badge_${badge.id}`)}</span>
                                    </label>
                                );
                            })}
                        </div>
                    )}
                <p className={styles.choiceGroupNote}>
                    {showcaseLocked ? fill(t('lockedAt'), { level: SHOWCASE_LEVEL }) : t('profileShowcaseHint')}
                </p>
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
                                    onClick={() => update({ interests: draft.interests.filter(x => x !== item) })}><Icon name="close" size={14} /></button>
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

            <label className={styles.toggle}>
                <input type="checkbox" checked={draft.shareActivity} onChange={(e) => update({ shareActivity: e.target.checked })} />
                <span>
                    {t('profileShareActivity')}
                    <small>{t('profileShareActivityHint')}</small>
                </span>
            </label>

            <label className={styles.toggle}>
                <input type="checkbox" checked={draft.showOnline} onChange={(e) => update({ showOnline: e.target.checked })} />
                <span>
                    {t('profileShowOnline')}
                    <small>{t('profileShowOnlineHint')}</small>
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
