// The command bar (components/variants/CommandPalette.jsx, "Übersicht" variant) opens on
// Ctrl/⌘ K or when something asks for it, like the field in the header
export const OPEN_COMMANDS_EVENT = 'quidey:open-commands';
export const openCommands = () => window.dispatchEvent(new Event(OPEN_COMMANDS_EVENT));
