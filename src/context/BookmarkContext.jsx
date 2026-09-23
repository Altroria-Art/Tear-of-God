import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useUser } from './UserContext';
import { fetchBookmarkedTemplateIds, saveTemplate } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { useTranslation } from 'react-i18next';

const BookmarkContext = createContext(null);

export function BookmarkProvider({ children }) {
  const { currentUser } = useUser();
  const [bookmarkedIds, setBookmarkedIds] = useState(() => new Set());
  const [loaded, setLoaded] = useState(false);
  const toast = useToast();
  const { t } = useTranslation();

  // Load saved template IDs on mount or when currentUser changes
  useEffect(() => {
    let cancelled = false;
    if (!currentUser?.id) {
      setBookmarkedIds(new Set());
      setLoaded(true);
      return undefined;
    }

    setLoaded(false);
    fetchBookmarkedTemplateIds().then((ids) => {
      if (cancelled) return;
      setBookmarkedIds(new Set((ids || []).map(String)));
      setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  // Listen to cross-component or external 'tog-bookmark' events
  useEffect(() => {
    const handleBookmarkEvent = (e) => {
      const { id, saved } = e.detail || {};
      if (!id) return;
      const strId = String(id);
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
  }, []);

  const isSaved = useCallback(
    (templateId, fallback = false) => {
      if (!templateId) return false;
      const strId = String(templateId);
      if (loaded) {
        return bookmarkedIds.has(strId);
      }
      return !!fallback;
    },
    [bookmarkedIds, loaded]
  );

  const toggleBookmark = useCallback(
    async (templateId, currentSaved) => {
      if (!currentUser?.id) return { success: false, requireAuth: true };
      const strId = String(templateId);
      const nextSaved = !currentSaved;

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

      // Dispatch event for any other listeners
      window.dispatchEvent(
        new CustomEvent('tog-bookmark', {
          detail: { id: templateId, saved: nextSaved },
        })
      );

      // 2. Call backend
      try {
        const result = await saveTemplate(templateId, nextSaved);
        if (!result || !result.success) {
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
          window.dispatchEvent(
            new CustomEvent('tog-bookmark', {
              detail: { id: templateId, saved: currentSaved },
            })
          );
          toast.error(result?.error || t('errors.actionFailed', 'Action failed'));
          return { success: false, error: result?.error };
        }

        toast.success(t(nextSaved ? 'discover.bookmarked' : 'discover.bookmarkRemoved'));
        return { success: true, saved: nextSaved };
      } catch (err) {
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
        window.dispatchEvent(
          new CustomEvent('tog-bookmark', {
            detail: { id: templateId, saved: currentSaved },
          })
        );
        toast.error(t('errors.serverUnreachable', 'Network error'));
        return { success: false, error: err.message };
      }
    },
    [currentUser?.id, toast, t]
  );

  const addSavedIds = useCallback((ids) => {
    if (!ids || !ids.length) return;
    setBookmarkedIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      ids.forEach((id) => {
        const strId = String(id);
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
