import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, User, LogOut, Sun, Moon, Languages, Menu, X } from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { switchLanguage } from '../../i18n';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useUser();
  const { isLightMode, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const dropdownRef = useRef(null);
  const mobileRef = useRef(null);

  const toggleLanguage = () => {
    switchLanguage(i18n.language === 'th' ? 'en' : 'th');
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (mobileRef.current && !mobileRef.current.contains(event.target)) {
        setIsMobileOpen(false);
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
            {t('nav.home')}
          </Link>
          <Link to="/create" className={`pb-1 border-b-2 transition-all ${isActive('/create')}`}>
            {t('nav.create')}
          </Link>
          <Link to="/discover" className={`pb-1 border-b-2 transition-all ${isActive('/discover')}`}>
            {t('nav.discover')}
          </Link>
        </div>
      </div>

      {/* Hamburger สำหรับจอเล็ก */}
      <div className="md:hidden relative" ref={mobileRef}>
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="w-10 h-10 bg-surface rounded-full flex items-center justify-center text-ink-soft hover:bg-surface-glass hover:text-brand transition-colors shadow-sm border border-line-soft"
          aria-label={t('nav.menu')}
          title={t('nav.menu')}
        >
          {isMobileOpen ? <X size={18} strokeWidth={2.5} /> : <Menu size={18} strokeWidth={2.5} />}
        </button>
        {isMobileOpen && (
          <div className="absolute left-0 top-12 w-44 glass rounded-xl py-2 z-50 animate-dropdown-in">
            <Link
              to="/"
              className={`block px-4 py-2 text-sm font-medium transition-colors ${isActive('/')}`}
              onClick={() => setIsMobileOpen(false)}
            >
              {t('nav.home')}
            </Link>
            <Link
              to="/create"
              className={`block px-4 py-2 text-sm font-medium transition-colors ${isActive('/create')}`}
              onClick={() => setIsMobileOpen(false)}
            >
              {t('nav.create')}
            </Link>
            <Link
              to="/discover"
              className={`block px-4 py-2 text-sm font-medium transition-colors ${isActive('/discover')}`}
              onClick={() => setIsMobileOpen(false)}
            >
              {t('nav.discover')}
            </Link>
          </div>
        )}
      </div>

      {/* ฝั่งขวา: ค้นหา และ โปรไฟล์ */}
      <div className="flex items-center gap-4">
        
        {/* ช่อง Search */}
        <div className="relative hidden sm:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input 
            type="text" 
            placeholder={t('nav.searchPlaceholder')} 
            className="bg-search border border-line-soft rounded-full py-2.5 pl-10 pr-4 text-sm w-56 lg:w-72 outline-none focus:ring-1 focus:ring-brand-accent text-ink transition-shadow placeholder-muted"
          />
        </div>

        {/* ปุ่มเปลี่ยนภาษา */}
        <button
          onClick={toggleLanguage}
          className="w-10 h-10 bg-surface rounded-full flex items-center justify-center text-ink-soft hover:bg-surface-glass hover:text-brand transition-colors shadow-sm border border-line-soft mr-1"
          aria-label={t('nav.toggleLanguage')}
          title={t('nav.toggleLanguage')}
        >
          <Languages size={18} strokeWidth={2.5} />
        </button>

        {/* ปุ่มเปลี่ยนธีม */}
        <button
          onClick={toggleTheme}
          className="w-10 h-10 bg-surface rounded-full flex items-center justify-center text-ink-soft hover:bg-surface-glass hover:text-brand transition-colors shadow-sm border border-line-soft mr-1"
          aria-label={t('nav.toggleTheme')}
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
                <div className="absolute right-0 top-12 w-40 glass rounded-xl py-2 z-50 animate-dropdown-in">
                  <Link 
                    to="/profile" 
                    className="block px-4 py-2 text-sm text-ink hover:bg-surface-glass font-medium transition-colors"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    {t('nav.profile')}
                  </Link>
                  {currentUser.role === 'admin' && (
                    <Link 
                      to="/admin" 
                      className="block px-4 py-2 text-sm text-ink hover:bg-surface-glass font-medium transition-colors"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      {t('nav.admin')}
                    </Link>
                  )}
                  <button 
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-status-error hover:bg-status-error/10 font-medium flex items-center gap-2 transition-colors"
                  >
                    <LogOut size={14} /> {t('nav.logout')}
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


