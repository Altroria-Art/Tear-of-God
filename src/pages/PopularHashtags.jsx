import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Filter } from 'lucide-react';
import { fetchHashtags } from '../lib/api';
import HashtagPill from '../components/discover/HashtagPill';
import Pagination from '../components/ui/Pagination';
import SortDropdown from '../components/ui/SortDropdown';
import EmptyState from '../components/ui/EmptyState';
import { ArrowLeftIcon } from '../components/ui/Icons';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 30;
const SORT_OPTIONS = [
  { value: 'used', labelKey: 'sort.mostUsed' },
  { value: 'az', labelKey: 'sort.az' },
];

export default function PopularHashtags() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();

  const sortOptions = SORT_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }));

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const sort = searchParams.get('sort') || 'used';
  const q = searchParams.get('q') || '';

  const [inputValue, setInputValue] = useState(q);
  const debounceRef = useRef(null);

  const [hashtags, setHashtags] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true);
      const { data, total } = await fetchHashtags({ page, limit: PAGE_SIZE, sort, q });
      if (cancelled) return;
      setHashtags(data || []);
      setTotal(total || 0);
      setIsLoading(false);
    }
    load();
    return () => { cancelled = true }
  }, [page, sort, q]);

  // sync ช่อง filter กับ URL เมื่อผู้ใช้ navigate กลับมา (back/forward)
  useEffect(() => {
    setInputValue(q);
  }, [q]);

  // เคลียร์ debounce timer ที่ค้างอยู่ตอน unmount กันยิง setSearchParams หลังออกจากหน้าไปแล้ว
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

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

  const handleFilterChange = (value) => {
    setInputValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (value) next.set('q', value);
      else next.delete('q');
      next.set('page', '1');
      setSearchParams(next);
    }, 300);
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
              <h1 className="text-3xl font-extrabold tracking-tight text-ink">{t('discover.popularHashtags')}</h1>
              <p className="text-sm text-muted">{total.toLocaleString()} {t('common.hashtags')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative">
              <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={inputValue}
                onChange={(e) => handleFilterChange(e.target.value)}
                placeholder={t('discover.filterTags')}
                className="bg-surface border border-line-soft rounded-lg py-2 pl-9 pr-4 text-sm w-64 outline-none focus:ring-2 focus:ring-brand text-ink transition-shadow placeholder-muted"
              />
            </div>
            <SortDropdown value={sort} options={sortOptions} onChange={handleSortChange} label={t('discover.sort')} />
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted animate-pulse text-center py-10">{t('discover.loadingHashtags')}</p>
        ) : hashtags.length === 0 ? (
          <EmptyState title={t('discover.emptyHashtags')} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {hashtags.map((h) => (
              <HashtagPill key={h.tag} tag={h.tag} count={h.template_count} />
            ))}
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </main>
    </div>
  );
}







