import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from './UserContext';
import { fetchBookmarkedTemplateIds, saveTemplate } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { useTranslation } from 'react-i18next';

const BookmarkContext = createContext(null);

export function BookmarkProvider({ children }) {
  const { currentUser } = useUser();
  return <BookmarkState key={currentUser?.id || 'guest'} userId={currentUser?.id}>{children}</BookmarkState>;
}

function BookmarkState({ children, userId }) {
  const [bookmarkedIds, setBookmarkedIds] = useState(() => new Set());
  const [loaded, setLoaded] = useState(false);
  const pending = useRef(new Set());
  const overrides = useRef(new Map());
  const active = useRef(true);
  const toast = useToast();
  const { t } = useTranslation();

  // Load saved template IDs on mount or when currentUser changes
  useEffect(() => {
    active.current = true;
    let cancelled = false;
    const controller = new AbortController();
    if (!userId) {
      setBookmarkedIds(new Set());
      setLoaded(true);
      return undefined;
    }

    setLoaded(false);
    fetchBookmarkedTemplateIds({ signal: controller.signal }).then((ids) => {
      if (cancelled) return;
      if (!ids) return; // A failed fetch must not overwrite known saved states.
      const next = new Set(ids.map(String));
      overrides.current.forEach((saved, id) => saved ? next.add(id) : next.delete(id));
      setBookmarkedIds(next);
      setLoaded(true);
    });

    return () => {
      cancelled = true;
      active.current = false;
      controller.abort();
    };
  }, [userId]);

  // Listen to cross-component or external 'tog-bookmark' events
  useEffect(() => {
    const handleBookmarkEvent = (e) => {
      const { id, saved, userId: eventUserId } = e.detail || {};
      if (!userId || !id || (eventUserId && eventUserId !== userId)) return;
      const strId = String(id);
      overrides.current.set(strId, !!saved);
      setBookmarkedIds((prev) => {
        const has = prev.has(strId);
        if (saved && !has) {
          const next = new Set(prev);
          next.add(strId);
          return next;
        }
        if (!saved && has) {
          const next = new Set(prev);
          next.delete(strId);
          return next;
        }
        return prev;
      });
    };
    window.addEventListener('tog-bookmark', handleBookmarkEvent);
    return () => window.removeEventListener('tog-bookmark', handleBookmarkEvent);
  }, [userId]);

  const isSaved = useCallback(
    (templateId, fallback = false) => {
      if (!templateId) return false;
      const strId = String(templateId);
      if (overrides.current.has(strId)) return overrides.current.get(strId);
      if (loaded) {
        return bookmarkedIds.has(strId);
      }
      return !!fallback;
    },
    [bookmarkedIds, loaded]
  );

  const toggleBookmark = useCallback(
    async (templateId, currentSaved) => {
      if (!userId) return { success: false, requireAuth: true };
      const strId = String(templateId);
      if (pending.current.has(strId)) return { success: false, pending: true };
      pending.current.add(strId);
      const nextSaved = !currentSaved;
      overrides.current.set(strId, nextSaved);

      // 1. Optimistic UI update
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        if (nextSaved) {
          next.add(strId);
        } else {
          next.delete(strId);
        }
        return next;
      });

      // 2. Call backend
      try {
        const result = await saveTemplate(templateId, nextSaved);
        if (!active.current) return result;
        if (!result || !result.success) {
          overrides.current.set(strId, !!currentSaved);
          // Revert optimistic update
          setBookmarkedIds((prev) => {
            const next = new Set(prev);
            if (currentSaved) {
              next.add(strId);
            } else {
              next.delete(strId);
            }
            return next;
          });
          toast.error(result?.error || t('errors.actionFailed', 'Action failed'));
          return { success: false, error: result?.error };
        }

        // Only committed changes remove cards from saved lists.
        window.dispatchEvent(new CustomEvent('tog-bookmark', {
          detail: { id: templateId, saved: nextSaved, userId },
        }));
        toast.success(t(nextSaved ? 'discover.bookmarked' : 'discover.bookmarkRemoved'));
        return { success: true, saved: nextSaved };
      } catch (err) {
        if (!active.current) return { success: false };
        overrides.current.set(strId, !!currentSaved);
        // Revert on error
        setBookmarkedIds((prev) => {
          const next = new Set(prev);
          if (currentSaved) {
            next.add(strId);
          } else {
            next.delete(strId);
          }
          return next;
        });
        toast.error(t('errors.serverUnreachable', 'Network error'));
        return { success: false, error: err.message };
      } finally {
        pending.current.delete(strId);
      }
    },
    [userId, toast, t]
  );

  const addSavedIds = useCallback((ids) => {
    if (!ids || !ids.length) return;
    setBookmarkedIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      ids.forEach((id) => {
        const strId = String(id);
        if (overrides.current.get(strId) === false) return;
        if (!next.has(strId)) {
          next.add(strId);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, []);

  return (
    <BookmarkContext.Provider
      value={{
        bookmarkedIds,
        isSaved,
        toggleBookmark,
        addSavedIds,
        loaded,
      }}
    >
      {children}
    </BookmarkContext.Provider>
  );
}

export function useBookmarks() {
  const context = useContext(BookmarkContext);
  if (!context) {
    throw new Error('useBookmarks must be used within a BookmarkProvider');
  }
  return context;
}
