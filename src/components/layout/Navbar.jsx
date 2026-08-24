import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, User, LogOut } from 'lucide-react';
import { useUser } from '../../context/UserContext'; // นำเข้า UserContext เพื่อเช็คสถานะและ logout

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useUser(); // เพิ่ม logout เข้ามาใน destructure
  const [isDropdownOpen, setIsDropdownOpen] = useState(false); // สำหรับคุม Dropdown
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
      ? 'border-zinc-900 text-black'
      : 'border-transparent text-gray-600 hover:text-black';
  };

  const handleLogout = () => {
    logout(); // เรียกฟังก์ชัน logout จาก context
    setIsDropdownOpen(false);
    navigate('/login');
  };

  return (
    <nav className="bg-white/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-50 border-b border-zinc-200">
      
      {/* ฝั่งซ้าย: โลโก้ และ ลิงก์เมนู */}
      <div className="flex items-center gap-10">
        <Link to="/" className="text-[22px] font-black text-zinc-900 tracking-tight hover:text-zinc-700 transition-colors">
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
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input 
            type="text" 
            placeholder="Search Tear of God..." 
            className="bg-zinc-100 border-none rounded-full py-2.5 pl-10 pr-4 text-sm w-56 lg:w-72 outline-none focus:ring-2 focus:ring-zinc-900 text-gray-800 transition-shadow placeholder-gray-500"
          />
        </div>

        {/* ปุ่มโปรไฟล์ / ล็อกอิน */}
        <div className="relative" ref={dropdownRef}>
          {currentUser ? (
            <>
              {/* ปุ่มรูปโปรไฟล์ */}
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center text-gray-700 hover:bg-zinc-200 transition-colors cursor-pointer overflow-hidden shadow-sm border border-zinc-200"
              >
                {currentUser?.avatar_url ? (
                  <img src={currentUser.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User size={18} strokeWidth={2.5} />
                )}
              </button>

              {/* Dropdown เมนู */}
              {isDropdownOpen && (
                <div className="absolute right-0 top-12 w-40 bg-white rounded-lg shadow-xl border border-gray-100 py-2 z-50">
                  <Link 
                    to="/profile" 
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-zinc-100"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    Profile
                  </Link>
                  <button 
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <LogOut size={14} /> ออกจากระบบ
                  </button>
                </div>
              )}
            </>
          ) : (
            <Link 
              to="/login" 
              className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center text-gray-700 hover:bg-zinc-200 hover:text-zinc-900 transition-colors cursor-pointer overflow-hidden shadow-sm border border-zinc-200"
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
