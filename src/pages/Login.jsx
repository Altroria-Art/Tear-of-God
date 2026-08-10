import React from 'react';

export default function Login() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FDFCF8] font-sans text-gray-900">
      
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-[#FDFCF8]">
        <div className="flex items-center gap-8">
          <h1 className="text-2xl font-bold text-[#6B5300]">Tear of God</h1>
          <nav className="hidden md:flex gap-6 text-sm font-medium text-gray-700">
            <a href="#" className="hover:text-black">Home</a>
            <a href="#" className="hover:text-black">Create</a>
            <a href="#" className="hover:text-black">Discover</a>
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
              className="pl-10 pr-4 py-2 bg-[#F6F4ED] border border-transparent rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent w-64 transition-all"
            />
          </div>
          <button className="p-2 rounded-full border border-gray-300 hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5 text-[#6B5300]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center justify-center px-4 py-12">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-gray-100 p-8 w-full max-w-md">
          <h2 className="text-3xl font-bold text-center mb-2 text-gray-900">Join the Council</h2>
          <p className="text-gray-500 text-center mb-8 text-sm">
            Rank everything. Defend your picks.<br/>Argue in the comments.
          </p>

          <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
            <div>
              <label className="block text-[13px] font-bold text-gray-700 mb-1.5">Email</label>
              <input 
                type="email" 
                placeholder="you@example.com" 
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FACC15] bg-[#FDFCF8] text-sm"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[13px] font-bold text-gray-700">Password</label>
                <a href="#" className="text-[13px] font-bold text-[#9A7B00] hover:underline">Forgot password?</a>
              </div>
              <input 
                type="password" 
                placeholder="••••••••" 
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FACC15] bg-[#FDFCF8] text-sm tracking-widest"
              />
            </div>

            <button 
              type="submit" 
              className="w-full bg-[#FACC15] hover:bg-[#EAB308] text-[#4A3800] font-bold py-2.5 rounded-lg transition-colors mt-2"
            >
              Log In
            </button>
          </form>

          <div className="flex items-center my-6">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="px-3 text-xs text-gray-400 font-bold uppercase tracking-wider">OR</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>

          <button className="w-full flex items-center justify-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-bold py-2.5 rounded-lg transition-colors text-sm shadow-sm">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </div>

        <p className="mt-8 text-sm text-gray-600">
          New to Tear of God? <a href="#" className="font-bold text-[#8A6A00] hover:underline">Create an account</a>
        </p>
      </main>

      {/* Footer */}
      <footer className="bg-[#F3EFE0] px-8 py-8 flex flex-col md:flex-row items-center justify-between border-t border-[#E8E4D5]">
        <h2 className="text-2xl font-bold text-[#6B5300] mb-4 md:mb-0">Tear of God</h2>
        <p className="text-[11px] text-[#8A7120] font-bold mb-4 md:mb-0">
          © 2024 Tear of God. Community Driven Ranking.
        </p>
        <div className="flex gap-6 text-xs font-bold text-[#6B5300]">
          <a href="#" className="hover:underline">Privacy Policy</a>
          <a href="#" className="hover:underline">Terms of Service</a>
          <a href="#" className="hover:underline">Help Center</a>
        </div>
      </footer>
      
    </div>
  );
}