import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TrendingUp, LayoutTemplate, ArrowRight } from 'lucide-react';
import { fetchHashtags, fetchTemplates } from '../../lib/api';
import { useTranslation } from 'react-i18next';

// Sidebar-scoped short-TTL client cache (exact queries only — not global getJSON).
// TTLs are capped by the endpoints' own Cache-Control freshness, never longer:
//   GET /api/templates list → `public, max-age=10`  (functions/api/templates.js)
//   GET /api/hashtags (no q) → `public, max-age=300` (functions/api/hashtags.js)
// Module-level so SPA remounts share entries; the in-flight map dedups mounts
// that race before the first request resolves. Per-tab memory only — a logged-in
// user's `private,no-store` overwrite at the middleware does not leak across
// users here because nothing is shared across tabs/sessions.
const SIDEBAR_TTL_MS = { templates: 10 * 1000, hashtags: 300 * 1000 };
const sidebarCache = new Map(); // key -> { value, expiresAt }
const sidebarInflight = new Map(); // key -> Promise

function getCachedSidebar(key, ttlMs, fetcher) {
  const hit = sidebarCache.get(key);
  if (hit && Date.now() < hit.expiresAt) return Promise.resolve(hit.value);
  if (sidebarInflight.has(key)) return sidebarInflight.get(key);
  const pending = fetcher().then((value) => {
    sidebarCache.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }).finally(() => {
    sidebarInflight.delete(key);
  });
  sidebarInflight.set(key, pending);
  return pending;
}

export default function HomeRightSidebar() {
  const { t } = useTranslation();
  const [hashtags, setHashtags] = useState([]);
  const [templates, setTemplates] = useState([]);
  const navigate = useNavigate();
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    let cancelled = false;
    // Same params as before — sort/limit/endpoint unchanged, only timing changes.
    const load = () => {
      getCachedSidebar('sidebar:hashtags:limit=5:sort=popular', SIDEBAR_TTL_MS.hashtags, () =>
        fetchHashtags({ limit: 5, sort: 'popular' }).then((res) => res.data || [])
      ).then((data) => { if (!cancelled) setHashtags(data); }).catch(() => {});
      getCachedSidebar('sidebar:templates:limit=3:sort=popular', SIDEBAR_TTL_MS.templates, () =>
        fetchTemplates({ limit: 3, sort: 'popular' }).then((res) => res.data || [])
      ).then((data) => { if (!cancelled) setTemplates(data); }).catch(() => {});
    };
    // No IntersectionObserver (old browsers) → fetch immediately, as before.
    if (typeof IntersectionObserver === 'undefined') {
      load();
      return () => { cancelled = true; };
    }
    // Fetch only when the sidebar can actually be seen: on mobile it is
    // CSS-hidden (never intersects → 0 requests); resize to desktop makes it
    // intersect and loads normally. 200px margin preloads just before scroll-in.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          load();
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => { cancelled = true; observer.disconnect(); };
  }, []);

  return (
    <div ref={containerRef} className="space-y-6 text-ink">
      
      {/* Trending Hashtags */}
      <div className="bg-surface border border-line-soft rounded-2xl p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-[15px] font-extrabold mb-4">
          <TrendingUp size={18} className="text-brand" />
          {t('sidebar.trendingTopics')}
        </h3>
        
        {hashtags.length > 0 ? (
          <div className="space-y-3">
            {hashtags.map((tag) => (
              <div 
                key={tag.tag} 
                data-auth-next={`/discover/hashtag/${encodeURIComponent(tag.tag.replace(/^#/, ''))}`}
                onClick={() => navigate(`/discover/hashtag/${encodeURIComponent(tag.tag.replace(/^#/, ''))}`)}
                className="group cursor-pointer flex items-center justify-between py-0.5"
              >
                <div className="text-[14px] font-bold text-ink-soft group-hover:text-highlight transition-colors">
                  {tag.tag.startsWith('#') ? tag.tag : `#${tag.tag}`}
                </div>
                <div className="text-[11px] text-muted font-medium bg-surface-glass px-2 py-0.5 rounded-full border border-line-soft">
                  {tag.content_count}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted">{t('sidebar.noTrending')}</div>
        )}
        
        <Link to="/discover/hashtags" className="block mt-5 text-[13px] font-bold text-brand hover:text-highlight transition-colors flex items-center gap-1">
          {t('sidebar.exploreMoreTags')} <ArrowRight size={14} />
        </Link>
      </div>

      {/* Hot Templates */}
      <div className="bg-surface border border-line-soft rounded-2xl p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-[15px] font-extrabold mb-4">
          <LayoutTemplate size={18} className="text-brand" />
          {t('sidebar.hotTemplates')}
        </h3>
        
        {templates.length > 0 ? (
          <div className="space-y-3">
            {templates.map((tpl) => (
              <div 
                key={tpl.id} 
                data-auth-next={`/template/${tpl.id}`}
                onClick={() => navigate(`/template/${tpl.id}`)}
                className="group cursor-pointer flex gap-3 items-center justify-between"
              >
                <div className="flex gap-3 items-center min-w-0">
                  <div className="w-12 h-12 shrink-0 rounded-lg bg-surface-glass border border-line-soft overflow-hidden relative">
                    <div className="w-full h-full flex items-center justify-center text-muted font-bold text-xs">
                      {tpl.title?.charAt(0)?.toUpperCase() || 'T'}
                    </div>
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-[13px] font-bold text-ink-soft group-hover:text-highlight transition-colors truncate">
                      {tpl.title || t('common.untitled')}
                    </div>
                    <div className="text-[11px] text-muted truncate">
                      {t(`category.${tpl.category || 'general'}.title`, { defaultValue: t('spotlights.general') })}
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-muted font-medium bg-surface-glass px-2 py-0.5 rounded-full border border-line-soft shrink-0">
                  {tpl.use_count || 0}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted">{t('sidebar.noHotTemplates')}</div>
        )}
        
        <Link to="/discover/templates" className="block mt-5 text-[13px] font-bold text-brand hover:text-highlight transition-colors flex items-center gap-1">
          {t('sidebar.browseTemplates')} <ArrowRight size={14} />
        </Link>
      </div>

      {/* Footer */}
      <div className="px-2 text-[12px] text-muted space-x-2">
        <span>&copy; 2026 Tear of God</span>
        <span>&bull;</span>
        <a href="#" className="hover:underline">{t('sidebar.privacy')}</a>
        <span>&bull;</span>
        <a href="#" className="hover:underline">{t('sidebar.terms')}</a>
      </div>
    </div>
  );
}

