// The new-goal sheet's draft: what was typed survives leaving the page (the study times are in the
// settings, a link away) and coming back. Kept in sessionStorage for this tab only, nothing sent.
//   { path, subjectId, step, fields, text, known, reviewOn, away }
// away: the sheet was left through its "Lernzeiten festlegen" link, so Lernen opens it again by itself
// when you come back (StudyPage); a sheet closed by hand clears the draft (GoalSheet).

const KEY = 'studyGoalDraft';

export function readGoalDraft() {
    try {
        const draft = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
        return draft && typeof draft === 'object' ? draft : null;
    } catch {
        return null;
    }
}

export function writeGoalDraft(draft) {
    try { sessionStorage.setItem(KEY, JSON.stringify(draft)); } catch { /* only for this visit */ }
}

export function clearGoalDraft() {
    try { sessionStorage.removeItem(KEY); } catch { /* nothing kept */ }
}

// the draft that belongs to this page (the same subject), else null
export const goalDraftFor = (subjectId) => {
    const draft = readGoalDraft();
    return draft && (draft.subjectId ?? null) === (subjectId ?? null) ? draft : null;
};
