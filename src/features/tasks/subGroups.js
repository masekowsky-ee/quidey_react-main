// Sub-groups of a shared session or a family (experimental, testers; SubGroupBar). Entries carry
// groupId (null: none), the session / family its groups [{ id, name }].

// The shown sub-group as long as it still exists (deleted, also by somebody else: back to all)
export const shownSubGroup = (groups, value) => (groups.some(group => group.id === value) ? value : null);

// The entries of the shown sub-group (null: all of them)
export const inSubGroup = (entries, groupId) => (groupId === null ? entries : entries.filter(entry => entry.groupId === groupId));

// Open entries per sub-group, for the chips: { all, [groupId]: n }
export function openCounts(entries) {
    const counts = { all: 0 };
    for (const entry of entries) {
        if (entry.done) continue;
        counts.all += 1;
        if (entry.groupId) counts[entry.groupId] = (counts[entry.groupId] ?? 0) + 1;
    }
    return counts;
}
