import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, User, LogOut, Sun, Moon, Languages, Menu, X, Crown } from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { switchLanguage } from '../../i18n';
import NotificationMenu from './NotificationMenu';
import SearchSuggestions from './SearchSuggestions';
import { fetchTemplates, fetchHashtags } from '../../lib/api';

const SUGGESTION_CACHE_TTL_MS = 30 * 1000;
const SUGGESTION_CACHE_MAX_ENTRIES = 50;
const suggestionCache = new Map();

function getCachedSuggestions(key) {
  const entry = suggestionCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    suggestionCache.delete(key);
    return null;
  }
  return entry;
}

function setCachedSuggestions(key, templates, hashtags) {
  if (
    !suggestionCache.has(key) &&
    suggestionCache.size >= SUGGESTION_CACHE_MAX_ENTRIES
  ) {
    const oldestKey = suggestionCache.keys().next().value;
    suggestionCache.delete(oldestKey);
  }
  suggestionCache.set(key, {
    templates,
    hashtags,
    expiresAt: Date.now() + SUGGESTION_CACHE_TTL_MS
  });
}

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useUser();
  const { isLightMode, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState({ templates: [], hashtags: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [isSuggestOpen, setIsSuggestOpen] = useState(false);
  const dropdownRef = useRef(null);
  const desktopSearchRef = useRef(null);
  const mobileSearchRef = useRef(null);

  useEffect(() => {
    setSearchQuery(new URLSearchParams(location.search).get('q') || '');
    setIsMobileMenuOpen(false);
    setIsSuggestOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSuggestions({ templates: [], hashtags: [] });
      setIsSearching(false);
      return;
    }

    // M1: key เป็น lowercase — backend ค้นแบบ case-insensitive อยู่แล้ว ('Cat' ใช้ cache ของ 'cat' ได้)
    const cacheKey = trimmed.toLowerCase();
    let cancelled = false;
    let controller = null;
    setIsSearching(true);

    const timer = setTimeout(async () => {
      const cached = getCachedSuggestions(cacheKey);
      if (cached) {
        if (!cancelled) {
          setSuggestions({
            templates: cached.templates,
            hashtags: cached.hashtags
          });
          setIsSearching(false);
        }
        return;
      }

      controller = new AbortController();

      try {
        const [tplRes, tagRes] = await Promise.all([
          fetchTemplates({ q: trimmed, limit: 4, suggest: 1, signal: controller.signal }),
          fetchHashtags({ q: trimmed.replace(/^#+/, ''), limit: 4, suggest: 1, signal: controller.signal })
        ]);
        if (!cancelled) {
          const templates = tplRes?.data || [];
          const hashtags = tagRes?.data || [];

          if (!tplRes?.error && !tagRes?.error) {
            setCachedSuggestions(cacheKey, templates, hashtags);
          }

          setSuggestions({
            templates,
            hashtags
          });
          setIsSearching(false);
        }
      } catch (error) {
        if (error?.name === 'AbortError') return;
        if (!cancelled) {
          setSuggestions({ templates: [], hashtags: [] });
          setIsSearching(false);
        }
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [searchQuery]);

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    if (searchQuery.trim()) {
      setIsSuggestOpen(false);
      setIsMobileMenuOpen(false);
      navigate(`/discover?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleSelectSuggestion = () => {
    setIsSuggestOpen(false);
    setIsMobileMenuOpen(false);
  };

  const toggleLanguage = () => {
    switchLanguage(i18n.language === 'th' ? 'en' : 'th');
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (
        (!desktopSearchRef.current || !desktopSearchRef.current.contains(event.target)) &&
        (!mobileSearchRef.current || !mobileSearchRef.current.contains(event.target))
      ) {
        setIsSuggestOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsSuggestOpen(false);
        setIsDropdownOpen(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        desktopSearchRef.current?.querySelector('input')?.focus();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const isActive = (path) => {
    const active = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
    return active
      ? 'text-brand font-bold bg-brand/10'
      : 'text-ink-soft hover:text-ink hover:bg-surface/50 font-medium';
  };

  const handleLogout = async () => {
    if (!await logout()) return;
    setIsDropdownOpen(false);
    navigate('/login');
  };

  const handleHomeClick = () => {
    if (location.pathname === '/') {
      window.dispatchEvent(new CustomEvent('tog-refresh-feed'));
    }
  };

  return (
    <nav className="glass-nav px-4 sm:px-8 py-3 flex items-center justify-between sticky top-0 z-50">
      
      {/* ฝั่งซ้าย: โลโก้ และ ลิงก์เมนู */}
      <div className="flex items-center gap-6 lg:gap-8 min-w-0">
        <div className="flex items-center gap-2">
          <button 
            aria-label={t('nav.menu')}
            aria-expanded={isMobileMenuOpen}
            className="md:hidden p-2 text-ink-soft hover:text-brand" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <Link to="/" onClick={handleHomeClick} className="whitespace-nowrap text-lg sm:text-[22px] font-black text-brand tracking-tight hover:text-highlight transition-colors">
            Tear of God
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-1.5 text-sm">
          <Link to="/" onClick={handleHomeClick} className={`px-3 py-1.5 rounded-lg transition-all ${isActive('/')}`}>
            {t('nav.home')}
          </Link>
          <Link to="/create" className={`px-3 py-1.5 rounded-lg transition-all ${isActive('/create')}`}>
            {t('nav.create')}
          </Link>
          <Link to="/discover" className={`px-3 py-1.5 rounded-lg transition-all ${isActive('/discover')}`}>
            {t('nav.discover')}
          </Link>
        </div>
      </div>

      {/* ฝั่งขวา: ค้นหา และ โปรไฟล์ */}
      <div className="flex items-center gap-1 sm:gap-3">
        
        {/* ช่อง Search */}
        <div ref={desktopSearchRef} className="relative hidden lg:block">
          <form onSubmit={handleSearch}>
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input 
              type="text" 
              aria-label={t('discover.search')}
              placeholder={t('nav.searchPlaceholder')} 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSuggestOpen(true);
              }}
              onFocus={() => {
                if (searchQuery.trim()) setIsSuggestOpen(true);
              }}
              className="bg-search border border-line-soft rounded-full py-2.5 pl-10 pr-4 text-sm w-48 xl:w-72 outline-none focus:ring-1 focus:ring-brand-accent text-ink transition-shadow placeholder-muted"
            />
          </form>

          {isSuggestOpen && searchQuery.trim() && (
            <SearchSuggestions
              query={searchQuery}
              templates={suggestions.templates}
              hashtags={suggestions.hashtags}
              isLoading={isSearching}
              onSelect={handleSelectSuggestion}
              onSeeAll={() => handleSearch()}
              className="w-72 xl:w-84"
            />
          )}
        </div>

        {/* ปุ่มเปลี่ยนภาษา */}
        <button
          onClick={toggleLanguage}
          className="w-10 h-10 bg-surface rounded-full flex items-center justify-center text-ink-soft hover:bg-surface-glass hover:text-brand transition-colors shadow-sm border border-line-soft cursor-pointer"
          aria-label={t('nav.toggleLanguage')}
          title={t('nav.toggleLanguage')}
        >
          <Languages size={18} strokeWidth={2.5} />
        </button>

        {/* ปุ่มเปลี่ยนธีม Ultra-smooth */}
        <button
          onClick={toggleTheme}
          className="w-10 h-10 bg-surface rounded-full flex items-center justify-center text-ink-soft hover:bg-surface-glass hover:text-brand transition-all duration-200 active:scale-90 hover:scale-105 shadow-sm border border-line-soft cursor-pointer select-none overflow-hidden"
          aria-label={t('nav.toggleTheme')}
        >
          <div className="transform transition-transform duration-300">
            {isLightMode ? (
              <Moon size={18} strokeWidth={2.5} className="rotate-0 transition-transform duration-300" />
            ) : (
              <Sun size={18} strokeWidth={2.5} className="rotate-90 transition-transform duration-300 text-amber-400" />
            )}
          </div>
        </button>

        {currentUser && <NotificationMenu userId={currentUser.id} />}

        {/* ปุ่มโปรไฟล์ / ล็อกอิน */}
        <div className="relative" ref={dropdownRef}>
          {currentUser ? (
            <>
              {/* ปุ่มรูปโปรไฟล์ */}
              <div className="relative">
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
                {currentUser.role === 'admin' && (
                  <div className="absolute -top-3 -right-2.5 text-amber-400 drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)] rotate-[15deg] pointer-events-none z-10">
                    <Crown size={22} fill="currentColor" strokeWidth={1.5} />
                  </div>
                )}
              </div>

              {/* Dropdown เมนู */}
              {isDropdownOpen && (
                <div className="absolute right-0 top-12 w-40 glass rounded-xl py-2 z-50">
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

      {/* Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full glass border-t border-line-soft p-4 flex flex-col gap-4 shadow-lg z-50">
          <div ref={mobileSearchRef} className="relative w-full">
            <form onSubmit={handleSearch}>
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input 
                type="text" 
                aria-label={t('discover.search')}
                placeholder={t('nav.searchPlaceholder')} 
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSuggestOpen(true);
                }}
                onFocus={() => {
                  if (searchQuery.trim()) setIsSuggestOpen(true);
                }}
                className="bg-search border border-line-soft rounded-full py-2 pl-10 pr-4 text-sm w-full outline-none focus:ring-1 focus:ring-brand-accent text-ink transition-shadow placeholder-muted"
              />
            </form>

            {isSuggestOpen && searchQuery.trim() && (
              <SearchSuggestions
                query={searchQuery}
                templates={suggestions.templates}
                hashtags={suggestions.hashtags}
                isLoading={isSearching}
                onSelect={handleSelectSuggestion}
                onSeeAll={() => handleSearch()}
                className="w-full left-0 right-0"
              />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Link to="/" className={`px-4 py-2 rounded-lg ${isActive('/')}`} onClick={() => setIsMobileMenuOpen(false)}>
              {t('nav.home')}
            </Link>
            <Link to="/create" className={`px-4 py-2 rounded-lg ${isActive('/create')}`} onClick={() => setIsMobileMenuOpen(false)}>
              {t('nav.create')}
            </Link>
            <Link to="/discover" className={`px-4 py-2 rounded-lg ${isActive('/discover')}`} onClick={() => setIsMobileMenuOpen(false)}>
              {t('nav.discover')}
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;


