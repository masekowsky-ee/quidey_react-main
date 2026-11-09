// The accounts list as one sheet of the export (sheet model of exportTable.js). Only what the
// admin list shows; never a password hash, token version or Google id.

const col = (key, label, type, width) => ({ key, label, type, ...(width && { width }) });

// 'granted' | 'denied' | null as the text of the export
const consentText = (choice, t) => (choice === 'granted' ? t('adminAnswerYes') : choice === 'denied' ? t('adminAnswerNo') : t('adminNotAsked'));

export function userSheet(users, t) {
    const columns = [
        col('id', t('adminField_id'), 'number', 8),
        col('displayName', t('adminCol_displayName'), 'string', 22),
        col('username', t('adminCol_username'), 'string', 22),
        col('email', t('adminField_email'), 'string', 28),
        col('emailVerified', t('adminCol_emailVerified'), 'boolean', 14),
        col('createdAt', t('adminField_created'), 'datetime', 18),
        col('signIn', t('adminField_signIn'), 'string', 18),
        col('termsAcceptedAt', t('adminField_terms'), 'datetime', 18),
        col('privacyAcceptedAt', t('adminField_privacy'), 'datetime', 18),
        col('language', t('adminField_language'), 'string', 9),
        col('timezone', t('adminField_timezone'), 'string', 18),
        col('birthDate', t('adminField_birth'), 'date', 13),
        col('level', t('adminField_level'), 'number', 8),
        col('proGift', t('adminCol_proGift'), 'boolean', 13),
        col('proUntil', t('adminCol_proUntil'), 'date', 14),
        col('tester', t('adminCol_tester'), 'boolean', 9),
        col('admin', t('adminCol_admin'), 'boolean', 9),
        col('owner', t('adminCol_owner'), 'boolean', 9),
        col('requestStatus', t('adminField_request'), 'string', 14),
        col('requestReason', t('adminCol_reason'), 'string', 36),
        col('usage', t('adminField_usage'), 'string', 16),
        col('usageAt', t('adminCol_usageAt'), 'datetime', 18),
        col('hasAvatar', t('adminField_avatar'), 'boolean', 11),
    ];
    const rows = users.map(u => ({
        id: u.id,
        displayName: u.displayName ?? null,
        username: u.username,
        email: u.email ?? null,
        emailVerified: u.emailVerified ?? null,
        createdAt: u.createdAt ?? null,
        signIn: u.signIn ? t(`adminSignIn_${u.signIn}`) : null,
        termsAcceptedAt: u.termsAcceptedAt ?? null,
        privacyAcceptedAt: u.privacyAcceptedAt ?? null,
        language: u.language ?? null,
        timezone: u.timezone ?? null,
        birthDate: u.birthDate ?? null,
        level: u.level ?? null,
        proGift: Boolean(u.isPro),
        proUntil: u.proUntil ?? null,
        tester: Boolean(u.isTester),
        admin: Boolean(u.isAdmin),
        owner: Boolean(u.isOwner),
        requestStatus: u.request ? t(`requestStatus_${u.request.status}`) : null,
        requestReason: u.request?.reason ?? null,
        usage: consentText(u.usageConsent?.choice ?? null, t),
        usageAt: u.usageConsent?.at ?? null,
        hasAvatar: Boolean(u.hasAvatar),
    }));
    return { name: t('adminUsersSheet'), columns, rows };
}

// quidey-konten_2026-11-08 (today, local)
export function usersFileBase(now = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    return `quidey-konten_${day}`;
}
