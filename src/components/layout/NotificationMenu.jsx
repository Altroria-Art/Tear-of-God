import TearMascot from '../ui/TearMascot';
import { useEffect, useRef, useState } from 'react';
import { BarChart3, Bell, CheckCheck, Heart, LayoutTemplate, MessageCircle, Swords, Trash2, TrendingUp, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { deleteNotification, fetchNotifications, markNotificationRead } from '../../lib/api';
import { BADGE_POLL_INTERVAL_MS, POLL_INTERVAL_MS } from '../../lib/notificationFeed';
import useLiveRefresh from '../../lib/useLiveRefresh';
import { timeAgo } from '../../lib/format';


const notificationIcon = {
  comment: MessageCircle,
  follow: UserPlus,
  template_use: LayoutTemplate,
  following_rank: UserPlus,
  trending: TrendingUp,
  community_average: BarChart3,
  like_digest: Heart,
  duel: Swords,
};

function notificationPath(notification) {
  if (notification.type === 'follow' && notification.actor_id) {
    return `/profile/${encodeURIComponent(notification.actor_id)}`;
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
  const triggerRef = useRef(null);
  const refreshLive = useLiveRefresh({
    resourceKey: userId,
    enabled: !!userId,
    interval: isOpen ? POLL_INTERVAL_MS : BADGE_POLL_INTERVAL_MS,
    load: signal => fetchNotifications(20, { signal, countOnly: !isOpen }),
    apply: result => {
      if (result.data) setNotifications(result.data);
      setUnreadCount(result.unreadCount || 0);
    },
    onSettled: () => setIsLoading(false),
  });
  const refresh = ({ quiet = false } = {}) => {
    if (!userId) return;
    if (!quiet) setIsLoading(true);
    refreshLive();
  };

  useEffect(() => {
    const handleOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleEscape = (event) => {
      if (event.key === 'Escape') { setIsOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const openMenu = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (!nextOpen) return;
    // Changing the interval restarts the resource with a full list GET.
    // Do not also fetch here: that would still use the closed-bell loader.
    setIsLoading(true);
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

  // Optimistic delete: row disappears (and the unread badge drops) before the
  // server answers; only a failure rolls the local snapshot back and re-syncs
  // from the server truth. The server-side unread counter is untouched here —
  // the D1 trigger owns it.
  const handleDeleteNotification = async (notification) => {
    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;

    setNotifications(items =>
      items.filter(item => item.id !== notification.id)
    );

    if (!notification.is_read) {
      setUnreadCount(count => Math.max(0, count - 1));
    }

    const result = await deleteNotification(notification.id);

    if (result.success === false) {
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
      refresh({ quiet: true });
    }
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
    const rankingTitle = notification.template_title || notification.ranking_title;
    return t(`notifications.${notification.type}`, {
      name,
      title: rankingTitle || t('notifications.aTierList'),
    });
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={openMenu}
        aria-label={t('notifications.title')}
        aria-expanded={isOpen}
        className="relative w-11 h-11 bg-surface rounded-full flex items-center justify-center text-ink-soft hover:bg-surface-glass hover:text-brand transition-colors shadow-sm border border-line-soft"
      >
        <Bell size={18} strokeWidth={2.5} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-4 h-4 px-1 rounded-full bg-status-error text-white text-[9px] font-black leading-4 text-center ring-2 ring-canvas">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-sheet fixed left-2 right-2 top-[4.25rem] w-auto overflow-hidden border border-line-soft bg-canvas shadow-xl z-50 sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[min(22rem,calc(100vw-1rem))]">
          <div className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
            <div>
              <p className="font-black text-ink">{t('notifications.title')}</p>
              {unreadCount > 0 && <p className="text-xs text-muted">{t('notifications.unread', { count: unreadCount })}</p>}
            </div>
            <button
              type="button"
              onClick={markAllRead}
              disabled={!unreadCount}
              className="flex items-center gap-1.5 px-2 min-h-11 text-xs font-bold text-brand disabled:text-muted disabled:cursor-default"
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
              <div className="personality-empty notification-empty px-6 text-center">
                <TearMascot pose="quiet" />
                <p className="font-bold text-ink">{t('notifications.emptyTitle')}</p>
                <p className="mt-1 text-xs text-muted">{t('notifications.emptyDesc')}</p>
              </div>
            )}
            {notifications.map(notification => {
              const Icon = notificationIcon[notification.type] || Bell;
              return (
                <div
                  key={notification.id}
                  className={`flex w-full items-start gap-3 border-b border-line-soft px-4 py-3 transition-colors last:border-b-0 ${notification.is_read ? '' : 'bg-brand/5'}`}
                >
                  <button
                    type="button"
                    onClick={() => openNotification(notification)}
                    className="min-h-11 min-w-0 flex flex-1 items-start gap-3 rounded-lg text-left hover:bg-surface-glass"
                  >
                    <span className="relative shrink-0">
                      {notification.actor_avatar_url ? (
                        <img src={notification.actor_avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <span className="h-10 w-10 rounded-full bg-surface-glass flex items-center justify-center text-brand">
                          <Icon size={18} />
                        </span>
                      )}
                      <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-brand text-canvas ring-2 ring-surface flex items-center justify-center">
                        <Icon size={11} />
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm leading-5 text-ink">{notificationText(notification)}</span>
                      <span className="mt-1 block text-[11px] text-muted">{timeAgo(notification.created_at)}</span>
                    </span>
                    {!notification.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" aria-label={t('notifications.new')} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteNotification(notification)}
                    aria-label={t('notifications.delete')}
                    title={t('notifications.delete')}
                    className="min-w-11 min-h-11 flex items-center justify-center shrink-0 self-center rounded-lg p-3 text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
