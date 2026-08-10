import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom';

// นำเข้าหน้าต่างๆ ที่เราสร้างไว้
import HomeFeed from './pages/Home';
import Create from './pages/Create';
import Profile from './pages/Profile'; // เพิ่มการนำเข้าหน้า Profile

// หน้าจำลองชั่วคราวสำหรับ Discover
const DiscoverPage = () => <div className="p-12 text-center text-xl font-bold text-gray-500">หน้า Discover (กำลังสร้าง...)</div>;

// แยก Header ออกมาเป็น Component กลางเพื่อให้โชว์ทุกหน้า
function Navbar() {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-[#FDFCF8] sticky top-0 z-10">
      <div className="flex items-center gap-8">
        <Link to="/" className="text-2xl font-bold text-[#6B5300]">Tear of God</Link>
        <nav className="hidden md:flex gap-6 text-sm font-bold text-gray-700">
          <NavLink 
            to="/" 
            className={({ isActive }) => isActive ? "border-b-2 border-[#6B5300] text-black pb-1" : "hover:text-black pb-1 transition-colors"}
          >
            Home
          </NavLink>
          <NavLink 
            to="/create" 
            className={({ isActive }) => isActive ? "border-b-2 border-[#6B5300] text-black pb-1" : "hover:text-black pb-1 transition-colors"}
          >
            Create
          </NavLink>
          <NavLink 
            to="/discover" 
            className={({ isActive }) => isActive ? "border-b-2 border-[#6B5300] text-black pb-1" : "hover:text-black pb-1 transition-colors"}
          >
            Discover
          </NavLink>
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <svg className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            type="text" 
            placeholder="Search Tear of God..." 
            className="pl-10 pr-4 py-2 bg-[#F6F4ED] border border-transparent rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 w-64"
          />
        </div>
        {/* เปลี่ยนจาก button เป็น Link เพื่อให้กดไปหน้า Profile ได้ */}
        <Link to="/profile" className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border border-gray-300 hover:opacity-80 transition-opacity">
          <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
        </Link>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#FDFCF8] font-sans text-gray-900 flex flex-col">
        {/* โชว์แถบเมนู */}
        <Navbar />
        
        {/* พื้นที่เปลี่ยนเนื้อหาตาม URL */}
        <div className="flex-grow">
          <Routes>
            <Route path="/" element={<HomeFeed />} />
            <Route path="/create" element={<Create />} />
            <Route path="/discover" element={<DiscoverPage />} />
            <Route path="/profile" element={<Profile />} /> {/* เพิ่ม Route ไปหน้า Profile */}
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}