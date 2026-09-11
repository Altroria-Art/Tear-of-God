import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('tier_user');
    if (!saved) return null;
    try {
      const user = JSON.parse(saved);
      // Legacy localStorage entries only contained a public user ID. Keeping
      // one would make the UI look signed in while every protected request is
      // correctly rejected by the server.
      if (!user?.token) {
        localStorage.removeItem('tier_user');
        return null;
      }
      return user;
    } catch {
      localStorage.removeItem('tier_user');
      return null;
    }
  });

  const login = useCallback((userData) => {
    setCurrentUser(userData);
    localStorage.setItem('tier_user', JSON.stringify(userData));
  }, []);

  const logout = useCallback(() => {
    const token = currentUser?.token;
    setCurrentUser(null);
    localStorage.removeItem('tier_user');
    if (token) {
      void fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'logout' }),
      });
    }
  }, [currentUser]);

  // 📍 ห้ามสร้าง object ใหม่ทุก render — ดู docs/row-read-optimization-plan.md §4: ถ้า value
  // เปลี่ยน reference ทั้งที่ currentUser ไม่เปลี่ยนจริง ทุก useEffect ที่ depend [currentUser]
  // ทั่วแอป (Home, Post Detail, Template Detail, Profile) จะเข้าใจผิดว่าต้อง refetch ใหม่
  const value = useMemo(() => ({ currentUser, login, logout }), [currentUser, login, logout]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);


