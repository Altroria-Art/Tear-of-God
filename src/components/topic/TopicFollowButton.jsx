import { useEffect, useMemo, useState } from 'react';
import { BellPlus, Check } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUser } from '../../context/UserContext';
import { fetchTopicFollow, toggleTopicFollow } from '../../lib/api';
import { loginPath } from '../../lib/navigation';
import { useToast } from '../ui/Toast';

function canonicalKey(topicType, topicKey) {
  const text = String(topicKey ?? '').trim();
  if (topicType === 'hashtag') return text.replace(/^#+/, '').trim().toLowerCase();
  if (topicType === 'category') return text.toLowerCase();
  return text;
}

export default function TopicFollowButton({ topicType, topicKey, className, showCount = true }) {
  const { t } = useTranslation();
  const { currentUser } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const normalizedKey = useMemo(() => canonicalKey(topicType, topicKey), [topicType, topicKey]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!topicType || !normalizedKey) return undefined;
    fetchTopicFollow(topicType, normalizedKey).then((result) => {
      if (cancelled || !result?.success) return;
      setIsFollowing(!!result.isFollowing);
      setFollowerCount(Number(result.followerCount || 0));
    });
    return () => { cancelled = true; };
  }, [topicType, normalizedKey, currentUser?.id]);

  useEffect(() => {
    const update = (event) => {
      const detail = event.detail || {};
      if (detail.topicType !== topicType || detail.topicKey !== normalizedKey) return;
      setIsFollowing(!!detail.isFollowing);
      setFollowerCount(Number(detail.followerCount || 0));
    };
    window.addEventListener('tog-topic-follow', update);
    return () => window.removeEventListener('tog-topic-follow', update);
  }, [topicType, normalizedKey]);

  const toggle = async () => {
    if (!currentUser) {
      navigate(loginPath(location.pathname + location.search));
      return;
    }
    if (busy || !normalizedKey) return;
    setBusy(true);
    const result = await toggleTopicFollow(topicType, normalizedKey, isFollowing);
    setBusy(false);
    if (!result?.success) {
      toast.error(result?.error || t('errors.actionFailed'));
      return;
    }
    const nextFollowing = !!result.isFollowing;
    const nextCount = Number(result.followerCount || 0);
    setIsFollowing(nextFollowing);
    setFollowerCount(nextCount);
    window.dispatchEvent(new CustomEvent('tog-topic-follow', {
      detail: { topicType, topicKey: normalizedKey, isFollowing: nextFollowing, followerCount: nextCount },
    }));
    toast.success(t(nextFollowing ? 'topicFollow.followed' : 'topicFollow.unfollowed'));
  };

  const label = isFollowing ? t('topicFollow.following') : t('topicFollow.follow');
  const defaultClassName = 'inline-flex min-h-10 items-center gap-2 rounded-full border border-line-soft bg-surface px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-surface-glass disabled:cursor-wait disabled:opacity-60';

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy || !normalizedKey}
      aria-pressed={isFollowing}
      aria-label={label}
      title={label}
      className={className || defaultClassName}
    >
      {isFollowing ? <Check size={16} aria-hidden="true" /> : <BellPlus size={16} aria-hidden="true" />}
      <span>{label}</span>
      {showCount && followerCount > 0 && (
        <span
          className="rounded-full bg-surface-glass px-1.5 py-0.5 text-xs text-muted"
          aria-label={t('topicFollow.followers', { count: followerCount })}
        >
          {followerCount}
        </span>
      )}
    </button>
  );
}
