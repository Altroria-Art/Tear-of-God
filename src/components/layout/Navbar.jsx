import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, User, LogOut, Sun, Moon } from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { useTheme } from '../../context/ThemeContext';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useUser();
  const { isLightMode, toggleTheme } = useTheme();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const isActive = (path) => {
    const active = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
    return active
      ? 'border-brand text-brand font-semibold'
      : 'border-transparent text-ink-soft hover:text-highlight';
  };

  const handleLogout = () => {
    logout();
    setIsDropdownOpen(false);
    navigate('/login');
  };

  return (
    <nav className="glass-nav px-6 py-4 flex items-center justify-between sticky top-0 z-50">
      
      {/* ฝั่งซ้าย: โลโก้ และ ลิงก์เมนู */}
      <div className="flex items-center gap-10">
        <Link to="/" className="text-[22px] font-black text-brand tracking-tight hover:text-highlight transition-colors">
          Tear of God
        </Link>

        <div className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link to="/" className={`pb-1 border-b-2 transition-all ${isActive('/')}`}>
            Home
          </Link>
          <Link to="/create" className={`pb-1 border-b-2 transition-all ${isActive('/create')}`}>
            Create
          </Link>
          <Link to="/discover" className={`pb-1 border-b-2 transition-all ${isActive('/discover')}`}>
            Discover
          </Link>
        </div>
      </div>

      {/* ฝั่งขวา: ค้นหา และ โปรไฟล์ */}
      <div className="flex items-center gap-4">
        
        {/* ช่อง Search */}
        <div className="relative hidden sm:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input 
            type="text" 
            placeholder="Search Tear of God..." 
            className="bg-search border border-line-soft rounded-full py-2.5 pl-10 pr-4 text-sm w-56 lg:w-72 outline-none focus:ring-1 focus:ring-brand-accent text-ink transition-shadow placeholder-muted"
          />
        </div>

        {/* ปุ่มเปลี่ยนธีม */}
        <button
          onClick={toggleTheme}
          className="w-10 h-10 bg-surface rounded-full flex items-center justify-center text-ink-soft hover:bg-surface-glass hover:text-brand transition-colors shadow-sm border border-line-soft mr-1"
          aria-label="Toggle Theme"
        >
          {isLightMode ? <Moon size={18} strokeWidth={2.5} /> : <Sun size={18} strokeWidth={2.5} />}
        </button>

        {/* ปุ่มโปรไฟล์ / ล็อกอิน */}
        <div className="relative" ref={dropdownRef}>
          {currentUser ? (
            <>
              {/* ปุ่มรูปโปรไฟล์ */}
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-10 h-10 bg-surface rounded-full flex items-center justify-center text-ink-soft hover:bg-surface-glass hover:text-brand transition-colors cursor-pointer overflow-hidden shadow-sm border border-line-soft"
              >
                {currentUser?.avatar_url ? (
                  <img src={currentUser.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User size={18} strokeWidth={2.5} />
                )}
              </button>

              {/* Dropdown เมนู */}
              {isDropdownOpen && (
                <div className="absolute right-0 top-12 w-40 glass rounded-xl py-2 z-50">
                  <Link 
                    to="/profile" 
                    className="block px-4 py-2 text-sm text-ink hover:bg-surface-glass font-medium transition-colors"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    Profile
                  </Link>
                  <button 
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-status-error hover:bg-status-error/10 font-medium flex items-center gap-2 transition-colors"
                  >
                    <LogOut size={14} /> ออกจากระบบ
                  </button>
                </div>
              )}
            </>
          ) : (
            <Link 
              to="/login" 
              className="w-10 h-10 bg-surface rounded-full flex items-center justify-center text-ink-soft hover:bg-surface-glass hover:text-brand transition-colors cursor-pointer overflow-hidden shadow-sm border border-line-soft"
            >
              <User size={18} strokeWidth={2.5} />
            </Link>
          )}
        </div>
        
      </div>
    </nav>
  );
};

export default Navbar;


