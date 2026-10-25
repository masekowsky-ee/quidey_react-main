// The command bar (components/variants/CommandPalette.jsx, for everybody) opens on Ctrl/⌘ K,
// "/" or when something asks for it, like the search button or Übersicht's field in the header
export const OPEN_COMMANDS_EVENT = 'quidey:open-commands';
export const openCommands = () => window.dispatchEvent(new Event(OPEN_COMMANDS_EVENT));
