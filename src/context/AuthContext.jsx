import { createContext, useContext } from "react";

// { user, session, profile } for the authenticated user. null when signed out.
export const AuthContext = createContext({ user: null, session: null, profile: null });

export const useAuth = () => useContext(AuthContext);
