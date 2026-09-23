import React, { useEffect, useState } from 'react';
import { UserPlus, Check } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUser } from '../../context/UserContext';
import { toggleFollow } from '../../lib/api';
import { useToast } from '../ui/Toast';

export default function UserFollowButton({
  targetUserId,
  initialIsFollowing = false,
  onRequireAuth,
  compact = false,
  ariaLabel = '',
  className = '',
}) {
  const { t } = useTranslation();
  const { currentUser } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [isFollowing, setIsFollowing] = useState(!!initialIsFollowing);
  const [busy, setBusy] = useState(false);

  // Sync initialIsFollowing when prop updates
  useEffect(() => {
    setIsFollowing(!!initialIsFollowing);
  }, [initialIsFollowing]);

  // Sync across different cards/posts by the same author on the screen
  useEffect(() => {
    const handleSync = (event) => {
      const detail = event.detail || {};
      if (detail.targetUserId === targetUserId) {
        setIsFollowing(!!detail.isFollowing);
      }
    };
    window.addEventListener('tog-user-follow', handleSync);
    return () => window.removeEventListener('tog-user-follow', handleSync);
  }, [targetUserId]);

  // Do not show button for the author's own posts or invalid ID
  if (!targetUserId || (currentUser && currentUser.id === targetUserId)) {
    return null;
  }

  const handleToggle = async (e) => {
    e.stopPropagation();

    if (!currentUser) {
      if (onRequireAuth) {
        onRequireAuth(location.pathname + location.search);
      } else {
        toast.warning(t('profile.errLoginFollow'));
        navigate('/login');
      }
      return;
    }

    if (busy) return;
    setBusy(true);

    const prev = isFollowing;
    const next = !prev;

    // Optimistic update
    setIsFollowing(next);
    window.dispatchEvent(
      new CustomEvent('tog-user-follow', {
        detail: { targetUserId, isFollowing: next },
      })
    );

    const result = await toggleFollow(currentUser.id, targetUserId, prev);
    setBusy(false);

    if (result?.error || result?.success === false) {
      // Rollback on error
      setIsFollowing(prev);
      window.dispatchEvent(
        new CustomEvent('tog-user-follow', {
          detail: { targetUserId, isFollowing: prev },
        })
      );
      toast.error(result?.error || t('errors.actionFailed'));
    }
  };

  if (compact) {
    const label = ariaLabel || '';
    if (isFollowing) {
      return (
        <button
          type="button"
          onClick={handleToggle}
          disabled={busy}
          aria-label={`${t('profile.unfollow')}${label ? ` ${label}` : ''}`}
          title={`${t('profile.unfollow')}${label ? ` ${label}` : ''}`}
          className={`z-10 flex h-10 w-10 items-center justify-center rounded-full cursor-pointer transition-all active:scale-95 disabled:opacity-60 ${className}`}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white shadow-sm">
            <Check size={12} strokeWidth={3} />
          </span>
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={busy}
        aria-label={`${t('profile.follow')}${label ? ` ${label}` : ''}`}
        title={`${t('profile.follow')}${label ? ` ${label}` : ''}`}
        className={`z-10 flex h-10 w-10 items-center justify-center rounded-full cursor-pointer transition-all active:scale-95 disabled:opacity-60 ${className}`}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white shadow-sm">
          <UserPlus size={12} strokeWidth={3} />
        </span>
      </button>
    );
  }

  if (isFollowing) {
    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={busy}
        aria-label={t('profile.following')}
        title={t('profile.unfollow')}
        className={`inline-flex min-h-10 items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-line-soft bg-surface-glass text-ink-soft hover:bg-surface hover:text-ink transition-all active:scale-95 disabled:opacity-60 cursor-pointer ${className}`}
      >
        <Check size={12} strokeWidth={2.5} className="text-brand" />
        <span>{t('profile.following')}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={busy}
      aria-label={t('profile.follow')}
      title={t('profile.follow')}
      className={`inline-flex min-h-10 items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold text-brand bg-brand/10 hover:bg-brand/20 transition-all active:scale-95 disabled:opacity-60 cursor-pointer ${className}`}
    >
      <UserPlus size={12} strokeWidth={2.5} />
      <span>{t('profile.follow')}</span>
    </button>
  );
}
