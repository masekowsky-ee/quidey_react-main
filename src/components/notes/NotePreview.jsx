import { notePreview } from '../../features/notes/notes';
import { fill } from '../../features/helperFunction';
import { useTranslation } from '../../i18n/useTranslation';

// The line (in tiles a few lines) under a note's title in every list: its text as it reads, or,
// without any, what is attached or that nothing is written yet (data-empty: quieter).
export default function NotePreview({ note, className, max = 160 }) {
    const { t } = useTranslation();
    const preview = notePreview(note, max);
    if (preview.text) return <span className={className}>{preview.text}</span>;
    return (
        <span className={className} data-empty="">
            {preview.attachments ? fill(t(preview.attachments === 1 ? 'notePreviewAttachment' : 'notePreviewAttachments'), { n: preview.attachments }) : t('notePreviewEmpty')}
        </span>
    );
}
