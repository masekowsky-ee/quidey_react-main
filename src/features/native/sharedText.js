// Text another app shared into Quidey ("Share → Quidey"): kept until the new-task form is opened,
// which takes it as its first line (QuickAdd). See deepLinks.js.
let pending = '';

export const setPendingText = (text) => { pending = String(text ?? '').trim().slice(0, 500); };

// the text once, then nothing
export function takePendingText() {
    const text = pending;
    pending = '';
    return text;
}
