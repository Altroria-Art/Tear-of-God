import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { fetchTemplates } from '../lib/api';
import TemplateCard from '../components/template/TemplateCard';
import Pagination from '../components/ui/Pagination';
import SortDropdown from '../components/ui/SortDropdown';
import { ArrowLeftIcon } from '../components/ui/Icons';

const PAGE_SIZE = 12;
const SORT_OPTIONS = [
  { value: 'popular', label: 'Popular' },
  { value: 'recent', label: 'Recent' },
  { value: 'views', label: 'Most Viewed' },
];

export default function PopularTemplates() {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const sort = searchParams.get('sort') || 'popular';

  const [templates, setTemplates] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const { data, total: t } = await fetchTemplates({ page, limit: PAGE_SIZE, sort });
      setTemplates(data || []);
      setTotal(t || 0);
      setIsLoading(false);
    }
    load();
  }, [page, sort]);

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

  const setPage = (p) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(p));
    setSearchParams(next);
  };

  const handleSortChange = (nextSort) => {
    const next = new URLSearchParams(searchParams);
    next.set('sort', nextSort);
    next.set('page', '1');
    setSearchParams(next);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="text-ink font-sans min-h-screen flex flex-col">
      <main className="flex-grow w-full max-w-[1200px] mx-auto px-6 py-12">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              to="/discover"
              className="rounded-full border border-line-soft p-2 text-ink-soft transition-colors hover:bg-surface-glass"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-ink">Popular Templates</h1>
              <p className="text-sm text-muted">{total.toLocaleString()} templates</p>
            </div>
          </div>
          <SortDropdown value={sort} options={SORT_OPTIONS} onChange={handleSortChange} label="Sort:" />
        </div>

        {isLoading ? (
          <p className="text-muted animate-pulse text-center py-10">กำลังโหลดเทมเพลต...</p>
        ) : templates.length === 0 ? (
          <p className="text-muted text-center py-10">ยังไม่มีเทมเพลตในระบบ</p>
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            {templates.map((template) => (
              <TemplateCard key={template.id} template={template} onUse={handleUseTemplate} />
            ))}
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </main>
    </div>
  );
}





