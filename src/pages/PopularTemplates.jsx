import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { fetchTemplates } from '../lib/api';
import TemplateCard from '../components/template/TemplateCard';
import { SkeletonTemplateGrid } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Pagination from '../components/ui/Pagination';
import SortDropdown from '../components/ui/SortDropdown';
import { useToast } from '../components/ui/Toast';
import { ArrowLeftIcon } from '../components/ui/Icons';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 12;
const SORT_OPTIONS = [
  { value: 'popular', labelKey: 'sort.popular' },
  { value: 'recent', labelKey: 'sort.recent' },
  { value: 'views', labelKey: 'sort.mostViewed' },
];

export default function PopularTemplates() {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const toast = useToast();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const sortOptions = SORT_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }));

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const sort = searchParams.get('sort') || 'popular';

  const [templates, setTemplates] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true);
      const { data, total } = await fetchTemplates({ page, limit: PAGE_SIZE, sort });
      if (cancelled) return;
      setTemplates(data || []);
      setTotal(total || 0);
      setIsLoading(false);
    }
    load();
    return () => { cancelled = true }
  }, [page, sort]);

  const handleProtectedAction = (callback) => {
    if (!currentUser) {
      toast.warning(t('discover.protectedLogin'));
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
              <h1 className="text-3xl font-extrabold tracking-tight text-ink">{t('discover.popularTemplates')}</h1>
              <p className="text-sm text-muted">{total.toLocaleString()} {t('common.templates')}</p>
            </div>
          </div>
          <SortDropdown value={sort} options={sortOptions} onChange={handleSortChange} label={t('discover.sort')} />
        </div>

        {isLoading ? (
          <SkeletonTemplateGrid />
        ) : templates.length === 0 ? (
          <EmptyState title={t('discover.emptyTemplates')} />
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





