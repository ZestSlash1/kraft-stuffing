import { createContext, useContext } from "react";

// Drives the live notification dots on the nav. Sections become "dirty" when a
// realtime change lands while you're not looking at them; a dot clears when you
// navigate there. `online` is the live presence count; `mailUnread` is polled.
export const LiveContext = createContext({
  dirty: {}, // { [section]: true } — sections with unseen live changes
  online: 0, // number of users currently present on the active voyage
  mailUnread: 0, // unread inbox count
});

export const useLive = () => useContext(LiveContext);
