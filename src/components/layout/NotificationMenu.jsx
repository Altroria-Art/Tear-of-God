import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, Bell, CheckCheck, Heart, LayoutTemplate, MessageCircle, Trash2, TrendingUp, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { deleteNotification, fetchNotifications, markNotificationRead } from '../../lib/api';
import {
  POLL_INTERVAL_MS,
  createRequestDeduper,
  shouldPollTick,
  shouldRefreshOnVisible,
  shouldReuseFreshFetch,
} from '../../lib/notificationFeed';
import { timeAgo } from '../../lib/format';
import { createPollActivity, watchPollActivity } from '../../lib/pollActivity';

const notificationIcon = {
  comment: MessageCircle,
  follow: UserPlus,
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
  const lastRefreshedAtRef = useRef(0);
  const lastSuccessAtRef = useRef(0);
  const deduperRef = useRef(null);
  if (!deduperRef.current) deduperRef.current = createRequestDeduper();

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (!userId) return;
    lastRefreshedAtRef.current = Date.now();
    const requestId = ++requestIdRef.current;
    if (!quiet) setIsLoading(true);
    // Concurrent triggers (timer + menu open, visibility + menu open) share
    // the pending GET instead of firing N requests. Sequential triggers fetch
    // normally — this is dedup, not a response cache.
    let result;
    try {
      result = await deduperRef.current.run(() => fetchNotifications(20));
    } catch {
      result = { success: false };
    }
    if (requestId !== requestIdRef.current) return;
    if (result.success !== false) {
      setNotifications(result.data || []);
      setUnreadCount(result.unreadCount || 0);
      lastSuccessAtRef.current = Date.now();
    }
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) return undefined;
    const activity = createPollActivity();
    if (document.visibilityState === 'visible') refresh();

    // 5-minute polling is for the active tab only: the interval is stopped
    // while hidden (not merely skipped inside) and restarted on return.
    // Active use retains the five-minute cadence; after five minutes without
    // interaction, skip polls until activity or tab return. The 60s guard stays.
    let interval = null;
    const startPolling = () => {
      if (interval) return;
      interval = window.setInterval(() => {
        if (shouldPollTick({
          userId,
          visible: document.visibilityState === 'visible' && activity.active(),
          now: Date.now(),
          lastRefreshAt: lastRefreshedAtRef.current,
        })) {
          refresh({ quiet: true });
        }
      }, POLL_INTERVAL_MS);
    };
    const stopPolling = () => {
      if (interval) {
        window.clearInterval(interval);
        interval = null;
      }
    };
    if (document.visibilityState === 'visible') startPolling();
    const stopWatching = watchPollActivity(window, activity, () => {
      if (document.visibilityState === 'visible' &&
          shouldRefreshOnVisible({ now: Date.now(), lastRefreshAt: lastRefreshedAtRef.current })) {
        refresh({ quiet: true });
      }
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        activity.touch();
        if (shouldRefreshOnVisible({ now: Date.now(), lastRefreshAt: lastRefreshedAtRef.current })) {
          refresh({ quiet: true });
        }
        startPolling();
      } else {
        stopPolling();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      stopWatching();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Logout / user switch / unmount: drop shared in-flight state so a
      // pending response can never fill the next identity's state (the
      // request-id bump above already discards its result as well).
      deduperRef.current.reset();
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
    if (!nextOpen) return;
    // A fetch that succeeded seconds ago (timer/visibility collision) need not
    // run again: skip only inside the short reuse window, otherwise refresh.
    // Failures never count as fresh, so an error is always followed by a retry.
    if (
      notifications.length > 0 &&
      shouldReuseFreshFetch({ now: Date.now(), lastSuccessAt: lastSuccessAtRef.current })
    ) {
      return;
    }
    refresh({ quiet: notifications.length > 0 });
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
                <div
                  key={notification.id}
                  className={`flex w-full items-start gap-3 border-b border-line-soft px-4 py-3 transition-colors last:border-b-0 ${notification.is_read ? '' : 'bg-brand/5'}`}
                >
                  <button
                    type="button"
                    onClick={() => openNotification(notification)}
                    className="min-w-0 flex flex-1 items-start gap-3 rounded-lg text-left hover:bg-surface-glass"
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
                    className="shrink-0 self-center rounded-lg p-3 text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
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
