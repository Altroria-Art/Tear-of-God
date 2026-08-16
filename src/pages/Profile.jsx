import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Profile() {
  const [name, setName] = useState('AlexRanker');
  const [bio, setBio] = useState('Master of RPG lists. Categorizing the virtual world one tier at a time.');
  const [avatarUrl, setAvatarUrl] = useState('https://lh3.googleusercontent.com/aida-public/AB6AXuBEpemrij6G1Xjwf5G35vVGphv168b2Y5tJIy7b4FwO75wndlWgV5Cqv2CrpWK7vAmDv0YLOp5ujfU8dEwdxbvVS8A6HOntgFp9V7frj2lES_vuWkGVkiyn0ZFa5waOgbvfnRMUrbnN_J-v8o-y64oQL4EC5-AZTHlhYQGsXRpjExBkAxLsZiOtufbs5KeEJhM2Yvj4cc-PaF75tSTeakDMpEMEf81_UpufemQy_4gnjAqs7Uh5VTcA');

  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(name);
  const [tempBio, setTempBio] = useState(bio);

  const handleOpenEdit = () => {
    setTempName(name);
    setTempBio(bio);
    setIsEditing(true);
  };

  const handleSave = () => {
    setName(tempName);
    setBio(tempBio);
    setIsEditing(false);
  };

  return (
    <div className="antialiased min-h-screen flex flex-col bg-[#fef9f2] text-[#1d1c18] font-sans relative">
      
      {/* ================= EDIT PROFILE MODAL ================= */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#fef9f2] border border-[#cec6b4] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden p-6 relative">
            
            <button 
              onClick={() => setIsEditing(false)}
              className="absolute top-5 right-5 text-gray-500 hover:text-black transition-colors"
            >
              ✕
            </button>

            <h2 className="text-xl font-bold text-[#1d1c18] mb-6">Edit Profile</h2>

            <div className="flex flex-col items-center mb-6">
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#cec6b4] shadow-sm mb-2">
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              </div>
              <button className="text-xs font-bold text-[#7c5d22] hover:underline uppercase tracking-wider">
                Change Photo
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-[#7c5d22] uppercase tracking-wider mb-1.5">
                Display Name
              </label>
              <input 
                type="text" 
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                className="w-full bg-[#f2ede6] border border-[#cec6b4] rounded-lg p-3 text-sm text-[#1d1c18] outline-none focus:ring-2 focus:ring-[#7c5d22]"
              />
            </div>

            <div className="mb-8">
              <label className="block text-xs font-bold text-[#7c5d22] uppercase tracking-wider mb-1.5">
                Bio
              </label>
              <textarea 
                rows="3"
                value={tempBio}
                onChange={(e) => setTempBio(e.target.value)}
                className="w-full bg-[#f2ede6] border border-[#cec6b4] rounded-lg p-3 text-sm text-[#1d1c18] outline-none focus:ring-2 focus:ring-[#7c5d22] resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#cec6b4]">
              <button 
                onClick={() => setIsEditing(false)}
                className="px-5 py-2.5 rounded-lg border border-[#cec6b4] text-sm font-semibold text-[#1d1c18] hover:bg-[#ece7e1] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="px-5 py-2.5 rounded-lg bg-[#7c5d22] text-sm font-semibold text-white hover:bg-[#5a4318] transition-colors shadow-sm"
              >
                Save Changes
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= Main Profile Content ================= */}
      <main className="flex-grow w-full max-w-[1200px] mx-auto px-6 py-12 flex flex-col md:flex-row gap-8">
        
        {/* Profile Sidebar */}
        <aside className="w-full md:w-1/3 lg:w-1/4 flex flex-col items-center md:items-start gap-6">
          <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-[#cec6b4] shadow-sm relative">
            <img 
              alt="Profile Picture" 
              className="w-full h-full object-cover" 
              src={avatarUrl} 
            />
          </div>

          <div className="text-center md:text-left w-full">
            <h1 className="text-3xl font-bold tracking-tight text-[#1d1c18] mb-2">{name}</h1>
            <p className="text-base text-[#4b4639] mb-6">{bio}</p>
            <button 
              onClick={handleOpenEdit}
              className="w-full bg-[#7c5d22] text-white font-semibold py-3 px-6 rounded-lg hover:bg-[#5a4318] transition-colors duration-200 shadow-sm flex items-center justify-center gap-2"
            >
              ✏️ Edit Profile
            </button>
          </div>

          <div className="w-full border-t border-[#cec6b4] pt-6 mt-2">
            <div className="flex justify-between items-center text-sm text-[#4b4639] mb-3">
              <span className="flex items-center gap-2">Joined</span>
              <span className="text-[#1d1c18] font-semibold">Oct 2023</span>
            </div>
            <div className="flex justify-between items-center text-sm text-[#4b4639] mb-3">
              <span className="flex items-center gap-2">List Views</span>
              <span className="text-[#1d1c18] font-semibold">45.2k</span>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="w-full md:w-2/3 lg:w-3/4 flex flex-col gap-10">
          
          <section>
            <div className="flex flex-col gap-6">
              
              {/* Create New Template Button Card */}
              <Link to="/create" className="no-underline">
                <article className="bg-transparent border-2 border-dashed border-[#7d7767] rounded-xl p-4 hover:bg-[#f8f3ec] transition-colors duration-300 flex items-center justify-center gap-4 group cursor-pointer">
                  <div className="w-10 h-10 rounded-full bg-[#e6e2db] flex items-center justify-center group-hover:bg-[#ece7e1] transition-colors">
                    <span className="text-xl text-[#1d1c18] font-bold">+</span>
                  </div>
                  <div className="flex flex-col">
                    <h3 className="text-lg font-semibold text-[#1d1c18]">Create New Template</h3>
                    <p className="text-sm text-[#4b4639]">Start a new tier list from scratch</p>
                  </div>
                </article>
              </Link>

              {/* 1. Best Sci-Fi Movies of the 2010s */}
              <article className="bg-[#fef9f2] text-[#1d1c18] border border-[#cec6b4] rounded-xl p-6 hover:shadow-md transition-shadow duration-300 flex flex-col h-full group">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-xs font-semibold text-[#7c5d22] mb-1 uppercase tracking-wide">Created a template</p>
                    <h2 className="text-xl font-semibold group-hover:text-[#7c5d22] transition-colors line-clamp-2">Best Sci-Fi Movies of the 2010s</h2>
                    <p className="text-xs text-gray-500 mt-1">Originally by {name}</p>
                  </div>
                  <button className="text-gray-500 hover:text-[#7c5d22] transition-colors">⋮</button>
                </div>

                <div className="flex-grow flex flex-col gap-1 mb-6 bg-[#f2ede6] p-3 rounded-lg border border-[#cec6b4]">
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center text-lg font-bold rounded bg-[#ff7f7f] text-[#1d1c18]">S</div>
                    <div className="flex flex-wrap gap-2 overflow-hidden h-12 items-center">
                      <span className="bg-white px-3 py-1 rounded-full text-xs border border-[#cec6b4] shadow-sm truncate max-w-[120px]">Inception</span>
                      <span className="bg-white px-3 py-1 rounded-full text-xs border border-[#cec6b4] shadow-sm truncate max-w-[120px]">Arrival</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center text-lg font-bold rounded bg-[#ffbf7f] text-[#1d1c18]">A</div>
                    <div className="flex flex-wrap gap-2 overflow-hidden h-12 items-center">
                      <span className="bg-white px-3 py-1 rounded-full text-xs border border-[#cec6b4] shadow-sm truncate max-w-[120px]">Interstellar</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center text-sm text-gray-500 mt-auto pt-4 border-t border-[#cec6b4]">
                  <span>3 days ago</span>
                  <div className="flex items-center gap-6 text-[#5b6371]">
                    <button className="flex items-center gap-1.5 hover:text-[#7c5d22] transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" /></svg>
                      <span className="text-xs font-semibold">420</span>
                    </button>
                    <button className="flex items-center gap-1.5 hover:text-[#7c5d22] transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.737 3h4.018c.163 0 .326.02.485.06L17 4m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" /></svg>
                    </button>
                    <button className="flex items-center gap-1.5 hover:text-[#7c5d22] transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                      <span className="text-xs font-semibold">342</span>
                    </button>
                  </div>
                </div>
              </article>

              {/* 2. Ultimate Fast Food Burgers Tier List */}
              <article className="bg-[#fef9f2] text-[#1d1c18] border border-[#cec6b4] rounded-xl p-6 hover:shadow-md transition-shadow duration-300 flex flex-col h-full group">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-xs font-semibold text-[#7c5d22] mb-1 uppercase tracking-wide">Created a template</p>
                    <h2 className="text-xl font-semibold group-hover:text-[#7c5d22] transition-colors line-clamp-2">Ultimate Fast Food Burgers Tier List</h2>
                    <p className="text-xs text-gray-500 mt-1">Originally by {name}</p>
                  </div>
                  <button className="text-gray-500 hover:text-[#7c5d22] transition-colors">⋮</button>
                </div>

                <div className="flex-grow flex flex-col gap-1 mb-6 bg-[#f2ede6] p-3 rounded-lg border border-[#cec6b4]">
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center text-lg font-bold rounded bg-[#ff7f7f] text-[#1d1c18]">S</div>
                    <div className="flex flex-wrap gap-2 overflow-hidden h-12 items-center">
                      <span className="bg-white px-3 py-1 rounded-full text-xs border border-[#cec6b4] shadow-sm truncate max-w-[120px]">Double-Double</span>
                      <span className="bg-white px-3 py-1 rounded-full text-xs border border-[#cec6b4] shadow-sm truncate max-w-[120px]">ShackBurger</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center text-lg font-bold rounded bg-[#ffbf7f] text-[#1d1c18]">A</div>
                    <div className="flex flex-wrap gap-2 overflow-hidden h-12 items-center">
                      <span className="bg-white px-3 py-1 rounded-full text-xs border border-[#cec6b4] shadow-sm truncate max-w-[120px]">Whopper</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center text-sm text-gray-500 mt-auto pt-4 border-t border-[#cec6b4]">
                  <span>5 days ago</span>
                  <div className="flex items-center gap-6 text-[#5b6371]">
                    <button className="flex items-center gap-1.5 hover:text-[#7c5d22] transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" /></svg>
                      <span className="text-xs font-semibold">215</span>
                    </button>
                    <button className="flex items-center gap-1.5 hover:text-[#7c5d22] transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.737 3h4.018c.163 0 .326.02.485.06L17 4m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" /></svg>
                    </button>
                    <button className="flex items-center gap-1.5 hover:text-[#7c5d22] transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                      <span className="text-xs font-semibold">88</span>
                    </button>
                  </div>
                </div>
              </article>

              {/* 3. Top JRPG Protagonists */}
              <article className="bg-[#fef9f2] text-[#1d1c18] border border-[#cec6b4] rounded-xl p-6 hover:shadow-md transition-shadow duration-300 flex flex-col h-full group">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-xs font-semibold text-[#7c5d22] mb-1 uppercase tracking-wide">Participated in a list</p>
                    <h2 className="text-xl font-semibold group-hover:text-[#7c5d22] transition-colors line-clamp-2">Top JRPG Protagonists</h2>
                    <p className="text-xs text-gray-500 mt-1">Originally by JRPGFan</p>
                  </div>
                  <button className="text-gray-500 hover:text-[#7c5d22] transition-colors">⋮</button>
                </div>

                <div className="flex-grow flex flex-col gap-1 mb-6 bg-[#f2ede6] p-3 rounded-lg border border-[#cec6b4]">
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center text-lg font-bold rounded bg-[#ff7f7f] text-[#1d1c18]">S</div>
                    <div className="flex flex-wrap gap-2 overflow-hidden h-12 items-center">
                      <span className="bg-white px-3 py-1 rounded-full text-xs border border-[#cec6b4] shadow-sm truncate max-w-[120px]">Cloud Strife</span>
                      <span className="bg-white px-3 py-1 rounded-full text-xs border border-[#cec6b4] shadow-sm truncate max-w-[120px]">Joker</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center text-lg font-bold rounded bg-[#ffbf7f] text-[#1d1c18]">A</div>
                    <div className="flex flex-wrap gap-2 overflow-hidden h-12 items-center">
                      <span className="bg-white px-3 py-1 rounded-full text-xs border border-[#cec6b4] shadow-sm truncate max-w-[120px]">Yuri Lowell</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center text-sm text-gray-500 mt-auto pt-4 border-t border-[#cec6b4]">
                  <span>1 week ago</span>
                  <div className="flex items-center gap-6 text-[#5b6371]">
                    <button className="flex items-center gap-1.5 hover:text-[#7c5d22] transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" /></svg>
                      <span className="text-xs font-semibold">850</span>
                    </button>
                    <button className="flex items-center gap-1.5 hover:text-[#7c5d22] transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.737 3h4.018c.163 0 .326.02.485.06L17 4m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" /></svg>
                    </button>
                    <button className="flex items-center gap-1.5 hover:text-[#7c5d22] transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                      <span className="text-xs font-semibold">45</span>
                    </button>
                  </div>
                </div>
              </article>

              {/* 4. Best Anime Openings 2023 */}
              <article className="bg-[#fef9f2] text-[#1d1c18] border border-[#cec6b4] rounded-xl p-6 hover:shadow-md transition-shadow duration-300 flex flex-col h-full group">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-xs font-semibold text-[#7c5d22] mb-1 uppercase tracking-wide">Participated in a list</p>
                    <h2 className="text-xl font-semibold group-hover:text-[#7c5d22] transition-colors line-clamp-2">Best Anime Openings 2023</h2>
                    <p className="text-xs text-gray-500 mt-1">Originally by {name}</p>
                  </div>
                  <button className="text-gray-500 hover:text-[#7c5d22] transition-colors">⋮</button>
                </div>

                <div className="flex-grow flex flex-col gap-1 mb-6 bg-[#f2ede6] p-3 rounded-lg border border-[#cec6b4]">
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center text-lg font-bold rounded bg-[#ff7f7f] text-[#1d1c18]">S</div>
                    <div className="flex flex-wrap gap-2 overflow-hidden h-12 items-center">
                      <span className="bg-white px-3 py-1 rounded-full text-xs border border-[#cec6b4] shadow-sm truncate max-w-[120px]">Idol</span>
                      <span className="bg-white px-3 py-1 rounded-full text-xs border border-[#cec6b4] shadow-sm truncate max-w-[120px]">Kick Back</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center text-lg font-bold rounded bg-[#ffdf7f] text-[#1d1c18]">B</div>
                    <div className="flex flex-wrap gap-2 overflow-hidden h-12 items-center">
                      <span className="bg-white px-3 py-1 rounded-full text-xs border border-[#cec6b4] shadow-sm truncate max-w-[120px]">Work</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center text-sm text-gray-500 mt-auto pt-4 border-t border-[#cec6b4]">
                  <span>2 weeks ago</span>
                  <div className="flex items-center gap-6 text-[#5b6371]">
                    <button className="flex items-center gap-1.5 hover:text-[#7c5d22] transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" /></svg>
                      <span className="text-xs font-semibold">1.2k</span>
                    </button>
                    <button className="flex items-center gap-1.5 hover:text-[#7c5d22] transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.737 3h4.018c.163 0 .326.02.485.06L17 4m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" /></svg>
                    </button>
                    <button className="flex items-center gap-1.5 hover:text-[#7c5d22] transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                      <span className="text-xs font-semibold">120</span>
                    </button>
                  </div>
                </div>
              </article>

            </div>
          </section>

        </div>
      </main>

    </div>
  );
}