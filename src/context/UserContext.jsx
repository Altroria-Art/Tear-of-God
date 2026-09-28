import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../components/ui/Toast';
import { invalidateSessionRequests } from '../lib/api';

const UserContext = createContext(null);
const AUTH_EVENT = 'tog-auth-change';
const notifyTabs = () => {
  try { localStorage.setItem(AUTH_EVENT, String(Date.now())); } catch { /* Cookies still work when local storage is disabled. */ }
};

export function UserProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [sessionError, setSessionError] = useState(false);
  const sessionRevision = useRef(0);
  const currentUserId = useRef(null);
  const { t } = useTranslation();
  const toast = useToast();

  const refresh = useCallback(async () => {
    const revision = ++sessionRevision.current;
    try {

      const response = await fetch('/api/auth', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error('Session unavailable');
      const result = await response.json();
      if (revision !== sessionRevision.current) return;
      const user = result.data || null;
      if (currentUserId.current !== (user?.id ?? null)) invalidateSessionRequests();
      currentUserId.current = user?.id ?? null;
      setCurrentUser(user);
      setSessionError(false);
    } catch {
      if (revision === sessionRevision.current) setSessionError(true);
    } finally {
      if (revision === sessionRevision.current) setIsRestoring(false);
    }
  }, []);


  useEffect(() => {
    try { localStorage.removeItem('tier_user'); } catch { /* Legacy storage is optional. */ }
    refresh();
    const storage = event => {
      if (event.key !== AUTH_EVENT) return;
      invalidateSessionRequests();
      currentUserId.current = null;
      setCurrentUser(null);
      setIsRestoring(true);
      refresh();
    };
    const expired = () => {
      sessionRevision.current += 1;
      invalidateSessionRequests();
      currentUserId.current = null;
      setCurrentUser(null);
      setSessionError(false);
      setIsRestoring(false);
    };
    window.addEventListener('storage', storage);
    window.addEventListener('tog-session-expired', expired);
    return () => {
      sessionRevision.current += 1;
      window.removeEventListener('storage', storage);
      window.removeEventListener('tog-session-expired', expired);
    };
  }, [refresh]);

  const login = useCallback(user => {
    sessionRevision.current += 1;
    invalidateSessionRequests();
    currentUserId.current = user?.id ?? null;
    setCurrentUser(user);
    setSessionError(false);
    setIsRestoring(false);
    notifyTabs();
  }, []);

  const logout = useCallback(async () => {
    const revision = ++sessionRevision.current;
    invalidateSessionRequests();
    try {
      const response = await fetch('/api/auth', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      });
      if (!response.ok) throw new Error('Logout failed');
      if (revision !== sessionRevision.current) return true;
      invalidateSessionRequests();
      currentUserId.current = null;
      setCurrentUser(null);
      setSessionError(false);
      setIsRestoring(false);
      notifyTabs();
      return true;
    } catch {
      toast.error(t('errors.serverUnreachable'));
      return false;
    }
  }, [toast, t]);

  const value = useMemo(() => ({ currentUser, login, logout, isRestoring }), [currentUser, login, logout, isRestoring]);
  return (
    <UserContext.Provider value={value}>
      {isRestoring ? <p role="status" className="min-h-screen grid place-items-center text-muted">{t('common.loading')}</p>
        : sessionError && !currentUser ? <div role="alert" className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
          <p>{t('errors.serverUnreachable')}</p>
          <button onClick={refresh} className="rounded-xl bg-brand text-canvas px-6 py-3">{t('common.retry', 'Try again')}</button>
        </div> : children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
