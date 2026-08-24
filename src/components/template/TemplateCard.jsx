import { Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import Avatar from '../ui/Avatar';
import { formatCount } from '../../lib/format';

export default function TemplateCard({ template, onUse }) {
  const tiersMap = {};
  template.template_items?.forEach((ti) => {
    if (!ti.tier) return;
    if (!tiersMap[ti.tier]) tiersMap[ti.tier] = [];
    tiersMap[ti.tier].push(ti.item?.name || ti.item_id);
  });

  const previewTiers = (template.tiers || []).slice(0, 2);
  const detailHref = `/template/${template.id}`;

  return (
    <div className="bg-white border border-[#cec6b4] rounded-xl overflow-hidden hover:shadow-md transition-shadow flex flex-col">
      <Link to={detailHref} className="bg-[#f8f3ec] p-4 h-40 flex flex-col gap-2 relative">
        <div className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm px-2 py-1 rounded text-xs text-[#4b4639] flex items-center gap-1 z-10 shadow-xs">
          <Users size={14} /> {formatCount(template.use_count)}
        </div>

        {previewTiers.map((tier) => {
          const items = tiersMap[tier.label];
          if (!items) return null;
          return (
            <div key={tier.label} className="flex gap-2 h-1/2">
              <div
                className={`${tier.color} w-12 shrink-0 flex items-center justify-center rounded-l text-white font-bold px-1 text-center leading-tight ${tier.label.length > 2 ? 'text-[9px]' : 'text-sm'}`}
              >
                {tier.label}
              </div>
              <div className="bg-[#e6e2db] flex-grow rounded-r opacity-50 flex items-center gap-2 px-2 overflow-hidden">
                {items.slice(0, 2).map((item, idx) => (
                  <span key={idx} className="bg-white border border-[#cec6b4] rounded px-2 py-1 text-[10px] text-[#4b4639] whitespace-nowrap">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </Link>
      <div className="p-4 flex-grow flex flex-col justify-between bg-white">
        <div>
          <Link to={detailHref}>
            <h3 className="text-lg font-bold text-[#1d1c18] mb-2 line-clamp-1 hover:underline">{template.title}</h3>
          </Link>
          <div className="flex items-center gap-2 mb-4">
            <Avatar name={template.profile?.username} src={template.profile?.avatar_url} size="sm" />
            <span className="text-sm text-[#4b4639]">@{template.profile?.username || 'User'}</span>
          </div>
        </div>
        <button
          onClick={() => onUse?.(template)}
          className="w-full py-2.5 bg-zinc-100 border border-zinc-200 hover:bg-zinc-200 text-zinc-700 font-bold rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.97]"
        >
          Use Template
        </button>
      </div>
    </div>
  );
}

