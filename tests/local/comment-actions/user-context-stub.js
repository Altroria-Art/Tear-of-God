import { createContext, useContext } from 'react';

// SSR test stub replacing src/context/UserContext.jsx so the test can inject
// a per-scenario currentUser without hitting /api/auth or session effects.
export const TestUserContext = createContext(null);
export const useUser = () => useContext(TestUserContext);