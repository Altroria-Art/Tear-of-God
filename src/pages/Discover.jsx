import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { fetchTemplates } from '../lib/api';
import TemplateCard from '../components/template/TemplateCard';
import { formatCount } from '../lib/format';

export default function Discover() {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 📍 ดึงข้อมูล template จากฐานข้อมูลจริง (ครั้งเดียว แล้วแบ่งฝั่ง client)
  useEffect(() => {
    async function loadDiscover() {
      setIsLoading(true);
      const { data } = await fetchTemplates({ limit: 50 });
      if (data) setTemplates(data);
      setIsLoading(false);
    }
    loadDiscover();
  }, []);

  const handleProtectedAction = (callback) => {
    if (!currentUser) {
      alert('กรุณาเข้าสู่ระบบก่อนใช้งานฟีเจอร์นี้ครับ!');
      navigate('/login');
      return;
    }
    if (callback) callback();
  };

  const handleUseTemplate = (template) => {
    handleProtectedAction(() => {
      navigate(`/rank?template=${template.id}`);
    });
  };

  // นับ hashtag ทั้งหมดจากข้อมูลจริงที่ดึงมา (จำนวน template + ยอดใช้งานรวม)
  const hashtagStats = useMemo(() => {
    const stats = {};
    templates.forEach((t) => {
      (t.hashtags || '').split(',').filter(Boolean).forEach((tag) => {
        if (!stats[tag]) stats[tag] = { count: 0, totalUse: 0 };
        stats[tag].count += 1;
        stats[tag].totalUse += t.use_count || 0;
      });
    });
    return stats;
  }, [templates]);

  const popularHashtags = useMemo(
    () => Object.entries(hashtagStats).sort((a, b) => b[1].count - a[1].count),
    [hashtagStats]
  );

  // section ต่อท้าย: ไล่จาก hashtag ที่มี template เยอะที่สุด (อย่างน้อย 3 อันถึงจะคุ้มเปิด section)
  const hashtagSections = useMemo(
    () =>
      Object.entries(hashtagStats)
        .filter(([, stat]) => stat.count >= 3)
        .sort((a, b) => b[1].count - a[1].count || b[1].totalUse - a[1].totalUse)
        .slice(0, 3)
        .map(([tag]) => ({
          tag,
          items: templates.filter((t) => (t.hashtags || '').split(',').includes(tag)).slice(0, 4)
        })),
    [hashtagStats, templates]
  );

  const popularTemplates = templates.slice(0, 4);

  return (
    <div className="bg-[#fef9f2] text-[#1d1c18] font-sans min-h-screen flex flex-col">
      <main className="flex-grow w-full max-w-[1200px] mx-auto px-6 py-12">

        <div className="mb-12">
          <h1 className="text-4xl font-extrabold tracking-tight text-[#1d1c18] mb-2">Discover</h1>
          <p className="text-base text-[#4b4639]">Explore top tier lists and templates from the community.</p>
        </div>

        <section className="mb-16">
          <div className="flex justify-between items-end mb-6">
            <h2 className="text-2xl font-bold text-[#1d1c18]">Popular Templates</h2>
            <button type="button" className="text-sm font-bold text-[#4b4639] hover:underline">View All</button>
          </div>

          {isLoading ? (
            <p className="text-gray-500 animate-pulse text-center py-10">กำลังโหลดเทมเพลตยอดนิยม...</p>
          ) : popularTemplates.length === 0 ? (
            <p className="text-gray-500 text-center py-10">ยังไม่มีเทมเพลตในระบบ</p>
          ) : (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
              {popularTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} onUse={handleUseTemplate} />
              ))}
            </div>
          )}
        </section>

        <section className="mb-16">
          <div className="flex justify-between items-end mb-6">
            <h2 className="text-2xl font-bold text-[#1d1c18]">Popular Hashtags</h2>
            <button type="button" className="text-sm font-bold text-[#4b4639] hover:underline">View All</button>
          </div>
          <div className="flex flex-wrap gap-3">
            {popularHashtags.map(([tag, stat]) => (
              <button
                key={tag}
                onClick={() => navigate(`/?hashtag=${tag.replace('#', '')}`)}
                className="px-4 py-2 bg-[#f2ede6] border border-[#cec6b4] rounded-full text-[#4b4639] hover:bg-[#ece7e1] transition-colors font-bold text-sm shadow-xs"
              >
                {tag} <span className="text-[#9a927e] font-normal">({formatCount(stat.count)})</span>
              </button>
            ))}
          </div>
        </section>

        {hashtagSections.map(({ tag, items }) => (
          <section key={tag} className="mb-16">
            <div className="flex justify-between items-end mb-6">
              <h2 className="text-2xl font-bold text-[#1d1c18]">{tag}</h2>
              <button type="button" className="text-sm font-bold text-[#4b4639] hover:underline">View All</button>
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
              {items.map((template) => (
                <TemplateCard key={template.id} template={template} onUse={handleUseTemplate} />
              ))}
            </div>
          </section>
        ))}

      </main>
    </div>
  );
}
