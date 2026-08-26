import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('tier_user');
    return saved ? JSON.parse(saved) : null; // ถ้าเป็น null แปลว่ายังไม่ได้ล็อกอิน
  });

  const login = useCallback((userData) => {
    setCurrentUser(userData);
    localStorage.setItem('tier_user', JSON.stringify(userData));
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem('tier_user');
  }, []);

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
