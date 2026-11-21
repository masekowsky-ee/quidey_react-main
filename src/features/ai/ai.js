// The AI features (later part of Quidey Pro; for now with daily allowances, backend ai.js):
// what is left today (GET /api/ai/quota, kept here while the app runs) and reading a quick-entry
// line the app's own rules hardly understood (POST /api/ai/parse-entry, one "aiLine" of the day).
//
// quota: { available, scan: { used, max }, aiLine: { used, max }, resetsAt } or null (not loaded,
// or the server couldn't be asked: then nothing is offered).

import { apiFetch } from '../api/api';
import { sharedResource } from '../sharedResource';

const aiQuota = sharedResource(() => apiFetch('/api/ai/quota'));

export const forgetAiQuota = aiQuota.forget;

// reads what is left again (after a scan, which may have used or given back the day's one)
export const refreshAiQuota = aiQuota.refresh;

const setQuota = (next) => aiQuota.set({ ...aiQuota.get(), ...next });

export const useAiQuota = aiQuota.useValue;

export const left = (part) => (part ? Math.max(0, part.max - part.used) : 0);

// → entry { kind, name, due, time, durationMinutes, color, eventTypeId, reminders, prio }.
// Throws the API's error (code QUOTA_REACHED with data.resetsAt, AI_FAILED, …); with nothing left
// the quota here says so too.
export async function readLineWithAi(text) {
    try {
        const answer = await apiFetch('/api/ai/parse-entry', { method: 'POST', body: JSON.stringify({ text }) });
        if (answer.quota) setQuota(answer.quota);
        return answer.entry;
    } catch (err) {
        if (err.code === 'QUOTA_REACHED' && aiQuota.get()?.aiLine) setQuota({ aiLine: { ...aiQuota.get().aiLine, used: aiQuota.get().aiLine.max }, resetsAt: err.data?.resetsAt ?? aiQuota.get().resetsAt });
        throw err;
    }
}
