import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import Avatar from '../components/ui/Avatar'
import { fetchRankings } from '../lib/api' // 📍 นำเข้า API

// เก็บไว้แค่ข้อมูลตกแต่ง UI ไม่มี Mock Data โพสต์แล้ว
const CATEGORY_META = {
  general: { title: 'General Templates', subtitle: 'Browse the broadest range of community tier lists.', icon: '📌', bg: 'bg-gray-400' },
  movie: { title: 'Movie Templates', subtitle: 'Rank the best films. Discover cinematic favorites.', icon: '🎬', bg: 'bg-red-400' },
  food: { title: 'Food Templates', subtitle: 'Rank the best eats. Discover community favorites.', icon: '🍔', bg: 'bg-yellow-400' },
  sport: { title: 'Sport Templates', subtitle: 'Rank the greatest athletes and teams.', icon: '⚽', bg: 'bg-blue-400' },
  music: { title: 'Music Templates', subtitle: 'Rank your favorite songs, artists, and albums.', icon: '🎵', bg: 'bg-rose-400' },
  game: { title: 'Gaming Templates', subtitle: 'Rank the best video games and characters.', icon: '🎮', bg: 'bg-indigo-400' },
  anime: { title: 'Anime Templates', subtitle: 'Rank the best anime series and characters.', icon: '📺', bg: 'bg-purple-400' },
} 

const TIER_ROW_COLORS = { S: 'bg-red-400', A: 'bg-orange-400', B: 'bg-yellow-400', C: 'bg-green-400', D: 'bg-blue-400' };

function ArrowLeftIcon({ className }) { /*... (โค้ด SVG เดิม) ...*/ return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><path d="M19 12H5M12 19l-7-7 7-7" /></svg> }
function PlusIcon({ className }) { /*... (โค้ด SVG เดิม) ...*/ return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" className={className}><path d="M12 5v14M5 12h14" /></svg> }

function TierPreviewRow({ tier, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-base font-bold text-white ${TIER_ROW_COLORS[tier] || 'bg-gray-400'}`}>
        {tier}
      </span>
      <div className="flex flex-wrap items-center gap-2 overflow-hidden h-8">
        {items.slice(0, 3).map((item, idx) => (
          <span key={idx} className="rounded-md border border-line-soft glass px-2.5 py-1 text-xs font-medium text-ink-soft whitespace-nowrap">
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

function TemplateCard({ template }) {
  // จัดกลุ่ม Tier สำหรับทำ Preview
  const tiersMap = {};
  template.ranking_items?.forEach(ri => {
    if (!tiersMap[ri.tier]) tiersMap[ri.tier] = [];
    tiersMap[ri.tier].push(ri.item_id || ri.item?.name);
  });

  return (
    <Link to={`/post/${template.id}`} className="block rounded-xl border border-line-soft glass shadow-sm hover:shadow-md transition-shadow">
      <div className="relative m-3 rounded-lg bg-surface p-3">
        <span className="absolute top-2 right-2 rounded-md glass px-1.5 py-0.5 text-[10px] font-semibold text-muted shadow-sm">
          👁️ {template.stats?.views || 0}
        </span>
        <div className="space-y-2">
          <TierPreviewRow tier="S" items={tiersMap['S']} />
          <TierPreviewRow tier="A" items={tiersMap['A']} />
        </div>
      </div>
      <div className="px-4 pb-4">
        <h3 className="text-lg font-bold text-ink line-clamp-1">{template.title}</h3>
        <div className="mt-2 flex items-center gap-2">
          <Avatar size="sm" name={template.profile?.username || 'Unknown'} src={template.profile?.avatar_url} />
          <span className="text-sm text-muted">@{template.profile?.username || 'User'}</span>
        </div>
      </div>
    </Link>
  )
}

export default function CategoryPage() {
  const { categoryId } = useParams()
  const meta = CATEGORY_META[categoryId] ?? CATEGORY_META.general

  const [templates, setTemplates] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // 📍 ดึงข้อมูลโพสต์ของจริงตามหมวดหมู่
  useEffect(() => {
    async function loadCategoryData() {
      setIsLoading(true);
      const { data } = await fetchRankings(categoryId);
      if (data) setTemplates(data);
      setIsLoading(false);
    }
    loadCategoryData();
  }, [categoryId]);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex items-center gap-4">
        <Link to="/discover" className="rounded-full border border-gray-300 p-2 text-ink-soft transition-colors hover:bg-surface-glass"><ArrowLeftIcon className="h-5 w-5" /></Link>
        <div className={`flex h-16 w-16 items-center justify-center rounded-xl text-4xl ${meta.bg}`}><span aria-hidden="true">{meta.icon}</span></div>
        <div>
          <h1 className="text-3xl font-bold text-ink">{meta.title}</h1>
          <p className="mt-1 text-ink-soft">{meta.subtitle}</p>
        </div>
      </header>

      {isLoading ? (
        <p className="text-center text-muted py-10">กำลังโหลดข้อมูล...</p>
      ) : templates.length === 0 ? (
        <p className="text-center text-muted py-10">ยังไม่มีโพสต์ในหมวดหมู่นี้</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      )}
    </main>
  )
}






