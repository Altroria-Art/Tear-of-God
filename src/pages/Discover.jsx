import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { fetchTemplates, fetchHashtags } from '../lib/api';
import TemplateCard from '../components/template/TemplateCard';
import HashtagPill from '../components/discover/HashtagPill';

export default function Discover() {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const [templates, setTemplates] = useState([]);
  const [hashtags, setHashtags] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 📍 ดึงข้อมูล template + hashtag จากฐานข้อมูลจริง — เลขบน hashtag pill ต้องมาจาก
  // /api/hashtags เสมอ (นับจากทุก template ใน DB) ไม่ใช่นับเองจาก 50 template ที่โหลดมาโชว์
  // ไม่งั้นเลขจะไม่ตรงกับหน้า /discover/hashtags เมื่อจำนวน template เกิน 50
  useEffect(() => {
    async function loadDiscover() {
      setIsLoading(true);
      const [tplRes, tagRes] = await Promise.all([
        fetchTemplates({ limit: 50 }),
        fetchHashtags({ limit: 30, sort: 'used' })
      ]);
      if (tplRes.data) setTemplates(tplRes.data);
      if (tagRes.data) setHashtags(tagRes.data);
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

  // section ต่อท้าย: ไล่จาก hashtag ที่มี template เยอะที่สุด (อย่างน้อย 3 อันถึงจะคุ้มเปิด section)
  // ตัด section ที่ไม่มีการ์ดให้โชว์ทิ้ง — กันเคสที่ template ของแท็กนั้นไม่ติดอยู่ใน 50 อันแรก
  // ที่โหลดมา (hashtags มาจาก /api/hashtags ซึ่งนับจากทุก template ใน DB ไม่ใช่แค่ 50 อันนี้)
  const hashtagSections = useMemo(
    () =>
      hashtags
        .filter((h) => h.template_count >= 3)
        .slice(0, 3)
        .map((h) => ({
          tag: h.tag,
          items: templates.filter((t) => (t.hashtags || '').split(',').includes(h.tag)).slice(0, 4)
        }))
        .filter((s) => s.items.length > 0),
    [hashtags, templates]
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
            <Link to="/discover/templates" className="text-sm font-bold text-[#4b4639] hover:underline">View All</Link>
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
            <Link to="/discover/hashtags" className="text-sm font-bold text-[#4b4639] hover:underline">View All</Link>
          </div>
          <div className="flex flex-wrap gap-3">
            {hashtags.map((h) => (
              <HashtagPill key={h.tag} tag={h.tag} count={h.template_count} />
            ))}
          </div>
        </section>

        {hashtagSections.map(({ tag, items }) => (
          <section key={tag} className="mb-16">
            <div className="flex justify-between items-end mb-6">
              <h2 className="text-2xl font-bold text-[#1d1c18]">{tag}</h2>
              <Link to={`/discover/hashtag/${encodeURIComponent(tag.replace('#', ''))}`} className="text-sm font-bold text-[#4b4639] hover:underline">View All</Link>
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

