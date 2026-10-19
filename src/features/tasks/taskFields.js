// Checks for the optional task fields, shared by the task form and the editor

// Empty, or a http(s) address: the api only takes web links
export const linkIsValid = (value) => {
    const text = (value ?? '').trim();
    if (!text) return true;
    try {
        return ['http:', 'https:'].includes(new URL(text).protocol);
    } catch {
        return false;
    }
};
