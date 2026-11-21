import { createContext } from 'react';

// What a click on a task's group label does, for a page that has its own idea of it (the calendar
// filters by that group); without a provider the label gets the onOpenGroup prop, or does nothing.
export const OpenGroupContext = createContext(undefined);
