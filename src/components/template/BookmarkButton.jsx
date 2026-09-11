import { useEffect, useState } from 'react';
import { Bookmark } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUser } from '../../context/UserContext';
import { useToast } from '../ui/Toast';
import { saveTemplate } from '../../lib/api';
import { loginPath } from '../../lib/navigation';

export default function BookmarkButton({ template }) {
  const { t } = useTranslation();
  const { currentUser } = useUser();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [saved, setSaved] = useState(!!template.is_saved);
  const [busy, setBusy] = useState(false);
  useEffect(() => setSaved(!!template.is_saved), [template.is_saved, currentUser?.id]);
  useEffect(() => {
    const update = event => { if (event.detail.id === template.id) setSaved(event.detail.saved); };
    window.addEventListener('tog-bookmark', update);
    return () => window.removeEventListener('tog-bookmark', update);
  }, [template.id]);
  const toggle = async () => {
    if (!currentUser) { navigate(loginPath(location.pathname + location.search)); return; }
    setBusy(true);
    const result = await saveTemplate(template.id, !saved);
    setBusy(false);
    if (!result.success) { toast.error(result.error); return; }
    setSaved(result.saved);
    window.dispatchEvent(new CustomEvent('tog-bookmark', { detail: { id: template.id, saved: result.saved } }));
    toast.success(t(result.saved ? 'discover.bookmarked' : 'discover.bookmarkRemoved'));
  };
  return <button type="button" onClick={toggle} disabled={busy} aria-pressed={saved} aria-label={t(saved ? 'discover.unsave' : 'discover.save')} title={t(saved ? 'discover.unsave' : 'discover.save')} className="shrink-0 min-w-11 min-h-11 grid place-items-center rounded-lg border border-line-soft text-ink-soft hover:bg-tag disabled:opacity-50"><Bookmark size={18} fill={saved ? 'currentColor' : 'none'} /></button>;
}
