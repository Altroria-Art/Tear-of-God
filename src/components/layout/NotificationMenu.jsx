import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, Bell, CheckCheck, Heart, LayoutTemplate, MessageCircle, Sparkles, TrendingUp, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchNotifications, markNotificationRead } from '../../lib/api';
import { timeAgo } from '../../lib/format';

const notificationIcon = {
  comment: MessageCircle,
  follow: UserPlus,
  challenge: Sparkles,
  template_use: LayoutTemplate,
  following_rank: UserPlus,
  trending: TrendingUp,
  community_average: BarChart3,
  like_digest: Heart,
};

function notificationPath(notification) {
  if (notification.type === 'follow' && notification.actor_id) {
    return `/profile/${encodeURIComponent(notification.actor_id)}`;
  }
  if (notification.type === 'challenge' && notification.source_ranking_id && notification.ranking_id) {
    return `/compare/${encodeURIComponent(notification.source_ranking_id)}/${encodeURIComponent(notification.ranking_id)}`;
  }
  if (notification.type === 'template_use' && notification.template_id) {
    return `/template/${encodeURIComponent(notification.template_id)}`;
  }
  if (notification.type === 'community_average' && notification.template_id) {
    return `/template/${encodeURIComponent(notification.template_id)}/community`;
  }
  if (notification.ranking_id) return `/post/${encodeURIComponent(notification.ranking_id)}`;
  return null;
}

export default function NotificationMenu({ userId }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const menuRef = useRef(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (!userId) return;
    const requestId = ++requestIdRef.current;
    if (!quiet) setIsLoading(true);
    const result = await fetchNotifications(20);
    if (requestId !== requestIdRef.current) return;
    if (result.success !== false) {
      setNotifications(result.data || []);
      setUnreadCount(result.unreadCount || 0);
    }
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) return undefined;
    refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh({ quiet: true });
    }, 90000);
    return () => {
      window.clearInterval(interval);
      requestIdRef.current += 1;
    };
  }, [refresh, userId]);

  useEffect(() => {
    const handleOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const openMenu = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) refresh({ quiet: notifications.length > 0 });
  };

  const markAllRead = async () => {
    if (!unreadCount) return;
    const previous = notifications;
    setNotifications(items => items.map(item => ({ ...item, is_read: 1 })));
    setUnreadCount(0);
    const result = await markNotificationRead();
    if (result.success === false) {
      setNotifications(previous);
      refresh({ quiet: true });
    }
  };

  const openNotification = async (notification) => {
    if (!notification.is_read) {
      setNotifications(items => items.map(item => item.id === notification.id ? { ...item, is_read: 1 } : item));
      setUnreadCount(count => Math.max(0, count - 1));
      markNotificationRead(notification.id).then(result => {
        if (result.success === false) refresh({ quiet: true });
      });
    }
    setIsOpen(false);
    const path = notificationPath(notification);
    if (path) navigate(path);
  };

  const notificationText = (notification) => {
    const name = notification.actor_username || t('common.unknownUser');
    if (notification.type === 'trending') {
      return t('notifications.trending', { title: notification.ranking_title || t('notifications.aTierList') });
    }
    if (notification.type === 'community_average') {
      return t('notifications.community_average', { title: notification.template_title || t('notifications.aTierList') });
    }
    if (notification.type === 'like_digest') {
      return t('notifications.like_digest', { count: notification.aggregate_count || 1 });
    }
    const rankingTitle = notification.type === 'challenge'
      ? notification.source_ranking_title
      : notification.template_title || notification.ranking_title;
    return t(`notifications.${notification.type}`, {
      name,
      title: rankingTitle || t('notifications.aTierList'),
    });
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={openMenu}
        aria-label={t('notifications.title')}
        aria-expanded={isOpen}
        className="relative w-10 h-10 bg-surface rounded-full flex items-center justify-center text-ink-soft hover:bg-surface-glass hover:text-brand transition-colors shadow-sm border border-line-soft"
      >
        <Bell size={18} strokeWidth={2.5} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-4 h-4 px-1 rounded-full bg-status-error text-white text-[9px] font-black leading-4 text-center ring-2 ring-canvas">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed left-2 right-2 top-[4.25rem] w-auto overflow-hidden rounded-2xl border border-line-soft bg-canvas shadow-xl z-50 sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[min(22rem,calc(100vw-1rem))]">
          <div className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
            <div>
              <p className="font-extrabold text-ink">{t('notifications.title')}</p>
              {unreadCount > 0 && <p className="text-xs text-muted">{t('notifications.unread', { count: unreadCount })}</p>}
            </div>
            <button
              type="button"
              onClick={markAllRead}
              disabled={!unreadCount}
              className="flex items-center gap-1.5 text-xs font-bold text-brand disabled:text-muted disabled:cursor-default"
            >
              <CheckCheck size={15} />
              {t('notifications.markAllRead')}
            </button>
          </div>

          <div className="max-h-[min(28rem,70vh)] overflow-y-auto">
            {isLoading && notifications.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-muted animate-pulse">{t('common.loading')}</p>
            )}
            {!isLoading && notifications.length === 0 && (
              <div className="px-6 py-12 text-center">
                <Bell size={28} className="mx-auto mb-3 text-muted" />
                <p className="font-bold text-ink">{t('notifications.emptyTitle')}</p>
                <p className="mt-1 text-xs text-muted">{t('notifications.emptyDesc')}</p>
              </div>
            )}
            {notifications.map(notification => {
              const Icon = notificationIcon[notification.type] || Bell;
              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => openNotification(notification)}
                  className={`flex w-full items-start gap-3 border-b border-line-soft px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-glass ${notification.is_read ? '' : 'bg-brand/5'}`}
                >
                  <div className="relative shrink-0">
                    {notification.actor_avatar_url ? (
                      <img src={notification.actor_avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-surface-glass flex items-center justify-center text-brand">
                        <Icon size={18} />
                      </div>
                    )}
                    <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-brand text-canvas ring-2 ring-surface flex items-center justify-center">
                      <Icon size={11} />
                    </span>
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-5 text-ink">{notificationText(notification)}</span>
                    <span className="mt-1 block text-[11px] text-muted">{timeAgo(notification.created_at)}</span>
                  </span>
                  {!notification.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" aria-label={t('notifications.new')} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
