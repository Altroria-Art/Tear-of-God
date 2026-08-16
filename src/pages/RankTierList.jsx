import React, { useState } from 'react';
import { Share2, Plus, Shuffle, ArrowDownAZ } from 'lucide-react';
import { useNavigate } from 'react-router-dom'; // 1. นำเข้า useNavigate

const RankTierList = () => {
  const navigate = useNavigate(); // 2. เรียกใช้งาน navigate

  // เริ่มต้นให้ tierId เป็น null ทั้งหมด เพื่อให้การ์ดไปกองอยู่ข้างล่างตอนเปิดมา
  const [items, setItems] = useState([
    { id: '1', content: 'The Witcher 3', tierId: null },
    { id: '2', content: 'Skyrim', tierId: null },
    { id: '3', content: 'Elden Ring', tierId: null },
    { id: '4', content: "Baldur's Gate 3", tierId: null },
    { id: '5', content: 'Mass Effect 2', tierId: null },
    { id: '6', content: 'Persona 5', tierId: null },
    { id: '7', content: 'Disco Elysium', tierId: null },
    { id: '8', content: 'Dragon Age', tierId: null },
    { id: '9', content: 'Cyberpunk 2077', tierId: null },
    { id: '10', content: 'Final Fantasy VII Remake', tierId: null },
  ]);

  const [customItem, setCustomItem] = useState('');

  const tiers = [
    { id: 't1', label: 'S', color: 'bg-[#ff7f7f]' },
    { id: 't2', label: 'A', color: 'bg-[#ffbf7f]' },
    { id: 't3', label: 'B', color: 'bg-[#ffff7f]' },
    { id: 't4', label: 'C', color: 'bg-[#7fff7f]' },
    { id: 't5', label: 'D', color: 'bg-[#7fbfff]' },
  ];

  const handleDragStart = (e, itemId) => {
    e.dataTransfer.setData('itemId', itemId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetTierId) => {
    e.preventDefault();
    const draggedItemId = e.dataTransfer.getData('itemId');
    setItems(items.map(item => 
      item.id === draggedItemId ? { ...item, tierId: targetTierId } : item
    ));
  };

  const handleAddCustomItem = () => {
    if (!customItem.trim()) return;
    
    const newItems = customItem
      .split(',')
      .map((item, index) => ({
        id: `custom-${Date.now()}-${index}`,
        content: item.trim(),
        tierId: null // ให้การ์ดใหม่ไปโผล่ที่กล่องข้างล่าง (Unranked Pool) เสมอ
      }))
      .filter((item) => item.content !== '');
    
    setItems([...items, ...newItems]);
    setCustomItem('');
  };

  const handleShuffle = () => {
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    setItems(shuffled);
  };

  const handleSortAZ = () => {
    const sorted = [...items].sort((a, b) => a.content.localeCompare(b.content));
    setItems(sorted);
  };

  const renderCard = (item) => (
    <div
      key={item.id}
      draggable
      onDragStart={(e) => handleDragStart(e, item.id)}
      className="bg-white min-w-[110px] h-[52px] px-4 rounded shadow-sm flex items-center justify-center text-center text-sm font-medium text-gray-700 border border-gray-100 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
    >
      <span className="line-clamp-2 leading-tight pointer-events-none">{item.content}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#faf8f5] font-sans text-gray-800 flex flex-col">
      <div className="max-w-6xl mx-auto w-full px-6 py-8 flex-1 flex flex-col gap-6">
        
        {/* Top Info Card */}
        <div className="bg-white rounded-xl shadow-sm border border-[#e8dfd3] p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex-1">
            <h1 className="text-[28px] font-bold text-black">My Ultimate RPG Rankings</h1>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-3 pt-1">
            <button className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-black transition-colors px-2">
              <Share2 size={16} /> Share
            </button>
            <button 
              onClick={() => navigate('/')} // 3. ใส่คำสั่ง navigate ไปที่หน้าหลัก ('/')
              className="bg-[#7c5b36] hover:bg-[#63482a] text-white text-sm font-bold py-2 px-6 rounded-md transition-colors shadow-sm"
            >
              Save Ranking
            </button>
          </div>
        </div>

        {/* Tier List Canvas */}
        <div className="bg-[#f4efe8] rounded-xl border border-[#e8dfd3] overflow-hidden flex flex-col">
          {tiers.map((tier, index) => (
            <div 
              key={tier.id} 
              className={`flex min-h-[90px] bg-[#fdfbf9] ${index !== tiers.length - 1 ? 'border-b border-[#e8dfd3]' : ''}`}
            >
              <div className={`${tier.color} w-24 flex items-center justify-center text-black text-xl font-bold border-r border-[#e8dfd3]`}>
                {tier.label}
              </div>
              
              <div 
                className="flex-1 p-3 flex flex-wrap gap-3 items-center"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, tier.id)}
              >
                {items.filter(item => item.tierId === tier.id).map(renderCard)}
              </div>
            </div>
          ))}
        </div>

        {/* Action Bar (Add Custom / Shuffle / Sort) */}
        <div className="bg-[#f4efe8] rounded-xl border border-[#e8dfd3] p-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative w-full md:w-[300px]">
            <input 
              type="text" 
              value={customItem}
              onChange={(e) => setCustomItem(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCustomItem()}
              placeholder="Add custom item..." 
              className="w-full bg-[#ebe4d8] border border-[#ded5c5] rounded-md py-2.5 pl-4 pr-10 text-sm outline-none focus:ring-1 focus:ring-[#7c5b36]"
            />
            <button 
              onClick={handleAddCustomItem}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7c5b36] hover:text-[#5c4226]"
            >
              <Plus size={18} strokeWidth={2.5} />
            </button>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto">
            <button 
              onClick={handleShuffle}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#ebe4d8] hover:bg-[#ded5c5] border border-[#ded5c5] text-gray-700 text-sm font-semibold py-2.5 px-4 rounded-md transition-colors"
            >
              <Shuffle size={16} /> Shuffle Items
            </button>
            <button 
              onClick={handleSortAZ}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#ebe4d8] hover:bg-[#ded5c5] border border-[#ded5c5] text-gray-700 text-sm font-semibold py-2.5 px-4 rounded-md transition-colors"
            >
              <ArrowDownAZ size={16} /> Sort A-Z
            </button>
          </div>
        </div>

        {/* Unranked Pool (กล่องเก็บไอเทมที่ยังไม่ได้จัดอันดับ) */}
        <div className="bg-[#e4ddd0] rounded-xl p-6 border border-[#d6cebf]">
          <h2 className="text-[17px] font-bold text-gray-800 mb-4">Unranked Pool</h2>
          <div 
            className="min-h-[120px] flex flex-wrap gap-4"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, null)}
          >
            {items.filter(item => item.tierId === null).length === 0 ? (
              <span className="text-gray-500 text-sm italic py-4 pointer-events-none">
                All items have been ranked!
              </span>
            ) : (
              items.filter(item => item.tierId === null).map(renderCard)
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default RankTierList;