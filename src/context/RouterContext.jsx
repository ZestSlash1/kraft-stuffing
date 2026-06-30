import { createContext, useContext } from "react";

// route: { page, params }. navigate(page, params) swaps the active page.
export const RouterContext = createContext({
  route: { page: "dashboard", params: {} },
  navigate: () => {},
  goPortal: () => {}, // return to the app launcher (clears section selection)
});

export const useRouter = () => useContext(RouterContext);
