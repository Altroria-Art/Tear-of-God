import { useState } from 'react';
import { Bookmark } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUser } from '../../context/UserContext';
import { useBookmarks } from '../../context/BookmarkContext';
import { loginPath } from '../../lib/navigation';

export default function BookmarkButton({ template, className, children, onRequireAuth, inSavedView = false }) {
  const { t } = useTranslation();
  const { currentUser } = useUser();
  const { isSaved, toggleBookmark } = useBookmarks();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);

  const fallback = inSavedView || (template?.is_saved !== undefined ? !!template.is_saved : false);
  const saved = isSaved(template?.id, fallback);

  const toggle = async (e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    if (!currentUser) {
      if (onRequireAuth) {
        onRequireAuth(location.pathname + location.search);
      } else {
        navigate(loginPath(location.pathname + location.search));
      }
      return;
    }
    if (busy || !template?.id) return;
    setBusy(true);
    await toggleBookmark(template.id, saved);
    setBusy(false);
  };

  const btnClass = className || `shrink-0 min-w-11 min-h-11 grid place-items-center rounded-lg border transition-colors disabled:opacity-50 ${
    saved
      ? 'border-brand/40 bg-brand/10 text-brand'
      : 'border-line-soft text-ink-soft hover:bg-tag hover:text-ink'
  }`;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      aria-label={t(saved ? 'discover.unsave' : 'discover.save')}
      title={t(saved ? 'discover.unsave' : 'discover.save')}
      className={btnClass}
    >
      <Bookmark
        size={18}
        fill={saved ? 'currentColor' : 'none'}
        className={saved ? 'text-brand' : ''}
      />
      {children}
    </button>
  );
}
