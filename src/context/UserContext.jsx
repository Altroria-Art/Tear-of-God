import { createContext, useContext, useState } from 'react';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('tier_user');
    return saved ? JSON.parse(saved) : null; // ถ้าเป็น null แปลว่ายังไม่ได้ล็อกอิน
  });

  const login = (userData) => {
    setCurrentUser(userData);
    localStorage.setItem('tier_user', JSON.stringify(userData));
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('tier_user');
  };

  return (
    <UserContext.Provider value={{ currentUser, login, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
