import { useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { openPicture, circlePicture, saveAvatar, removeAvatar, useAvatarUrl } from '../../features/profile/avatars';
import { showToast } from '../../features/toast/toast';
import { useTranslation } from '../../i18n/useTranslation';
import Icon from '../icons.jsx';
import AvatarCropper from './AvatarCropper.jsx';
import styles from './ProfileParts.module.css';

// "Profil gestalten": a picture instead of emoji or initials. Placed in a circle first
// (AvatarCropper), cut to that circle and made small on this device before it is sent; shown to
// friends and the people in open sessions and families.
export default function AvatarUpload() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const myId = useSelector(state => state.auth.access.userId);
    const current = useAvatarUrl(myId);
    const [busy, setBusy] = useState(false);
    const [picked, setPicked] = useState(null);
    const input = useRef(null);

    const pick = async (file) => {
        if (!file) return;
        const image = await openPicture(file).catch(() => null);
        if (!image) { dispatch(showToast(t('avatarFailed'), 'error')); return; }
        setPicked(image);
    };
    const save = async (placement) => {
        setBusy(true);
        try {
            const data = circlePicture(picked, placement);
            if (!data) { dispatch(showToast(t('avatarTooBig'), 'error')); return; }
            await saveAvatar(myId, data);
            setPicked(null);
            dispatch(showToast(t('avatarSaved'), 'success'));
        } catch {
            dispatch(showToast(t('avatarFailed'), 'error'));
        } finally {
            setBusy(false);
        }
    };
    const remove = async () => {
        setBusy(true);
        try {
            await removeAvatar(myId);
            dispatch(showToast(t('avatarRemoved'), 'success'));
        } catch {
            dispatch(showToast(t('avatarFailed'), 'error'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={styles.field}>
            <span className={styles.fieldLabelRow}>{t('avatarTitle')}</span>
            <div className={styles.avatarUpload}>
                <span className={styles.avatarUploadPreview} aria-hidden="true">
                    {current ? <img src={current} alt="" /> : <Icon name="image" size={22} />}
                </span>
                <div className={styles.avatarUploadActions}>
                    <button type="button" onClick={() => input.current?.click()} disabled={busy}>
                        {current ? t('avatarChange') : t('avatarPick')}
                    </button>
                    {current && <button type="button" onClick={remove} disabled={busy}>{t('avatarRemove')}</button>}
                    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden
                        onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />
                </div>
            </div>
            <p className={styles.hint}>{t('avatarHint')}</p>
            {picked && <AvatarCropper image={picked} busy={busy} onDone={save} onClose={() => setPicked(null)} />}
        </div>
    );
}
