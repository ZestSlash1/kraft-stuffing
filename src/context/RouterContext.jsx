import { createContext, useContext } from "react";

// route: { page, params }. navigate(page, params) swaps the active page.
export const RouterContext = createContext({
  route: { page: "dashboard", params: {} },
  navigate: () => {},
});

export const useRouter = () => useContext(RouterContext);
