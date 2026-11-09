// The AI features (later part of Quidey Pro; for now with daily allowances, backend ai.js):
// what is left today (GET /api/ai/quota, kept here while the app runs) and reading a quick-entry
// line the app's own rules hardly understood (POST /api/ai/parse-entry, one "aiLine" of the day).
//
// quota: { available, scan: { used, max }, aiLine: { used, max }, resetsAt } or null (not loaded,
// or the server couldn't be asked: then nothing is offered).

import { useEffect, useSyncExternalStore } from 'react';
import { apiFetch } from '../helperFunction';

let quota = null;
let loading = null;
const listeners = new Set();
const notify = () => listeners.forEach(listener => listener());
const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };

export function forgetAiQuota() {
    quota = null;
    loading = null;
    notify();
}

export function loadAiQuota() {
    loading ??= Promise.resolve()
        .then(() => apiFetch('/api/ai/quota'))
        .then(answer => { quota = answer ?? null; notify(); return quota; })
        .catch(() => { loading = null; return null; });
    return loading;
}

const setQuota = (next) => { quota = { ...quota, ...next }; notify(); };

export function useAiQuota() {
    useEffect(() => { loadAiQuota(); }, []);
    return useSyncExternalStore(subscribe, () => quota, () => quota);
}

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
        if (err.code === 'QUOTA_REACHED' && quota?.aiLine) setQuota({ aiLine: { ...quota.aiLine, used: quota.aiLine.max }, resetsAt: err.data?.resetsAt ?? quota.resetsAt });
        throw err;
    }
}
