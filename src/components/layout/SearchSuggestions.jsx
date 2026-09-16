import React from 'react';
import { Link } from 'react-router-dom';
import { Search, LayoutTemplate, Hash, Users, ArrowRight, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatCount } from '../../lib/format';

export default function SearchSuggestions({
  query,
  templates = [],
  hashtags = [],
  isLoading = false,
  onSelect,
  onSeeAll,
  className = '',
}) {
  const { t } = useTranslation();
  const trimmed = (query || '').trim();
  if (!trimmed) return null;

  const hasTemplates = templates.length > 0;
  const hasHashtags = hashtags.length > 0;
  const isEmpty = !isLoading && !hasTemplates && !hasHashtags;

  return (
    <div
      className={`absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border border-line-soft bg-surface/95 backdrop-blur-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 ${className}`}
      onMouseDown={(e) => {
        // Prevent search input from blurring before item click
        e.preventDefault();
      }}
    >
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-4 text-xs font-medium text-muted">
          <Loader2 size={14} className="animate-spin text-brand" />
          <span>{t('common.loading')}</span>
        </div>
      )}

      {isEmpty && (
        <div className="py-4 px-3 text-center text-xs font-medium text-muted">
          {t('nav.searchSuggestions.noResults')}
        </div>
      )}

      {!isLoading && (
        <div className="py-1 max-h-80 overflow-y-auto divide-y divide-line-soft/40">
          {/* Templates Section */}
          {hasTemplates && (
            <div className="p-1">
              <div className="flex items-center gap-1.5 px-3 pt-1.5 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-muted">
                <LayoutTemplate size={12} className="text-brand" />
                <span>{t('nav.searchSuggestions.templates')}</span>
              </div>
              <div className="space-y-0.5">
                {templates.slice(0, 4).map((template) => (
                  <Link
                    key={template.id}
                    to={`/template/${encodeURIComponent(template.id)}`}
                    onClick={onSelect}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-xs font-semibold text-ink hover:bg-surface-glass hover:text-brand transition-colors rounded-xl group"
                  >
                    <div className="min-w-0 flex-1 truncate">
                      <p className="truncate font-bold group-hover:underline">{template.title}</p>
                      {template.category && (
                        <p className="text-[10px] text-muted truncate">{template.category}</p>
                      )}
                    </div>
                    {template.stats?.uses != null && (
                      <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted">
                        <Users size={12} />
                        <span>{formatCount(template.stats.uses)}</span>
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Hashtags Section */}
          {hasHashtags && (
            <div className="p-1">
              <div className="flex items-center gap-1.5 px-3 pt-1.5 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-muted">
                <Hash size={12} className="text-highlight" />
                <span>{t('nav.searchSuggestions.hashtags')}</span>
              </div>
              <div className="space-y-0.5">
                {hashtags.slice(0, 4).map((h) => {
                  const cleanTag = (h.tag || '').replace(/^#+/, '').trim();
                  if (!cleanTag) return null;
                  return (
                    <Link
                      key={cleanTag}
                      to={`/discover/hashtag/${encodeURIComponent(cleanTag)}`}
                      onClick={onSelect}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-ink hover:bg-surface-glass hover:text-highlight transition-colors rounded-xl group"
                    >
                      <span className="truncate font-bold group-hover:underline">#{cleanTag}</span>
                      {h.content_count != null && (
                        <span className="shrink-0 text-[10px] font-medium text-muted">
                          {formatCount(h.content_count)}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer "See all results" */}
      <button
        type="button"
        onClick={onSeeAll}
        className="w-full flex items-center justify-between px-3.5 py-2.5 border-t border-line-soft bg-surface-glass/50 text-xs font-bold text-brand hover:bg-brand/10 transition-colors"
      >
        <span className="flex items-center gap-2 truncate">
          <Search size={13} className="shrink-0" />
          <span className="truncate">{t('nav.searchSuggestions.seeAll', { q: trimmed })}</span>
        </span>
        <ArrowRight size={13} className="shrink-0 ml-2" />
      </button>
    </div>
  );
}
