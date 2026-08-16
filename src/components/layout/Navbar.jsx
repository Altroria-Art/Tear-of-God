import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, User } from 'lucide-react';

const Navbar = () => {
  const location = useLocation();

  // เอา font-bold ออกไปแล้ว ตัวหนังสือจะไม่หนาขึ้นเวลาถูกเลือก
  const isActive = (path) => {
    return location.pathname === path 
      ? 'border-[#8B6F4E] text-black' 
      : 'border-transparent text-gray-600 hover:text-black';
  };

  return (
    <nav className="bg-[#faf8f5] px-6 py-4 flex items-center justify-between sticky top-0 z-50 border-b border-[#e8dfd3]/50">
      
      {/* ฝั่งซ้าย: โลโก้ และ ลิงก์เมนู */}
      <div className="flex items-center gap-10">
        <Link to="/" className="text-[22px] font-black text-[#8B6F4E] tracking-tight hover:text-[#63482a] transition-colors">
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
            className="bg-[#f4efe8] border-none rounded-full py-2.5 pl-10 pr-4 text-sm w-56 lg:w-72 outline-none focus:ring-2 focus:ring-[#8B6F4E] text-gray-800 transition-shadow placeholder-gray-500"
          />
        </div>

        {/* ปุ่มโปรไฟล์ (กดแล้วไปหน้า /profile) */}
        <Link 
          to="/profile" 
          className="w-10 h-10 bg-[#f4efe8] rounded-full flex items-center justify-center text-gray-700 hover:bg-[#e8e2d8] hover:text-[#8B6F4E] transition-colors cursor-pointer"
        >
          <User size={18} strokeWidth={2.5} />
        </Link>
        
      </div>
    </nav>
  );
};

export default Navbar;