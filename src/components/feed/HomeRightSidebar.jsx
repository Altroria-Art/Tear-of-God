import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TrendingUp, LayoutTemplate, ArrowRight } from 'lucide-react';
import { fetchHashtags, fetchTemplates } from '../../lib/api';
import { getCategoryStyle, HASHTAG_DEFAULT } from '../../lib/categories';
import { useTranslation } from 'react-i18next';

export default function HomeRightSidebar() {
  const { t } = useTranslation();
  const [hashtags, setHashtags] = useState([]);
  const [templates, setTemplates] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchHashtags({ limit: 5, sort: 'popular' }).then(res => {
      if (res.data) setHashtags(res.data);
    }).catch(() => {});

    fetchTemplates({ limit: 3, sort: 'popular' }).then(res => {
      if (res.data) setTemplates(res.data);
    }).catch(() => {});
  }, []);

  return (
    <div className="space-y-6 text-ink">
      
      {/* Trending Hashtags */}
      <div className="bg-surface border border-line-soft rounded-2xl p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-[15px] font-extrabold mb-4">
          <TrendingUp size={18} className="text-brand" />
          {t('sidebar.trendingTopics')}
        </h3>
        
        {hashtags.length > 0 ? (
          <div className="space-y-3">
            {hashtags.map((tag) => {
              const { icon: Icon, color } = getCategoryStyle(tag.tag, HASHTAG_DEFAULT);
              return (
                <div 
                  key={tag.tag} 
                  onClick={() => navigate(`/discover/hashtag/${encodeURIComponent(tag.tag)}`)}
                  className="group cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Icon size={14} className={color} />
                    <div className="text-[14px] font-bold text-ink-soft group-hover:text-highlight transition-colors">
                      {tag.tag.startsWith('#') ? tag.tag : `#${tag.tag}`}
                    </div>
                  </div>
                  <div className="text-[11px] text-muted font-medium bg-surface-glass px-2 py-0.5 rounded-full border border-line-soft">
                    {tag.template_count}
                  </div>
                </div>
              );
            })}
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
                onClick={() => navigate(`/template/${tpl.id}`)}
                className="group cursor-pointer flex gap-3 items-center"
              >
                <div className="w-12 h-12 shrink-0 rounded-lg bg-surface-glass border border-line-soft overflow-hidden relative">
                    <div className="w-full h-full flex items-center justify-center text-muted font-bold text-xs">{tpl.title.charAt(0)}</div>
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                </div>
                <div className="overflow-hidden">
                  <div className="text-[13px] font-bold text-ink-soft group-hover:text-highlight transition-colors truncate">{tpl.title}</div>
                  <div className="text-[11px] text-muted truncate">{tpl.category || 'general'} &bull; {tpl.use_count || 0} {t('common.uses').toLowerCase()}</div>
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
        <span>{t('sidebar.privacy')}</span>
        <span>&bull;</span>
        <span>{t('sidebar.terms')}</span>
      </div>
    </div>
  );
}

