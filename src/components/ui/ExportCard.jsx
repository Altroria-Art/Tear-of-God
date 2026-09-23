import { useMemo, useState } from 'react';
import { formatHashtags } from '../../lib/hashtags';
import { normalizeImageUrl } from '../../lib/images';
import Avatar from './Avatar';
import TierLabel from '../tier/TierLabel';
import ShareQr from './ShareQr';

import {
  FORMAT_LAYOUT,
  computeExportLayoutPlan,
} from '../../lib/exportCardLayout';

function ExportCardItem({ item, clsItemBorder, itemSize, itemTextSize }) {
  const [imgError, setImgError] = useState(false);
  const itemName = typeof item === 'object' ? (item.name || item.title) : item;
  const itemImg = typeof item === 'object' ? normalizeImageUrl(item.image_url || item.image) : null;

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl border p-1.5 text-center overflow-hidden ${clsItemBorder}`}
      style={{ width: itemSize, height: itemSize, minWidth: itemSize, minHeight: itemSize }}
      title={itemName}
    >
      {itemImg && !imgError ? (
        <img
          src={itemImg}
          alt={itemName}
          className="h-full w-full rounded-lg object-cover pointer-events-none"
          onError={() => setImgError(true)}
        />
      ) : (
        <span
          className="w-full break-words font-semibold leading-tight select-none px-0.5"
          style={{ fontSize: itemTextSize, lineHeight: 1.15 }}
        >
          {itemName}
        </span>
      )}
    </div>
  );
}

export default function ExportCard({
  title,
  authorName,
  authorAvatar,
  postedAt,
  hashtags,
  tiers = [],
  theme = 'light',
  shareLink = null,
  shareFormat = 'landscape',
  shareCta = 'Rank it and compare your taste',
  shareQrHint = 'Scan to open this list',
  typeBadge = null,
  footerText = null,
}) {
  const layout = FORMAT_LAYOUT[shareFormat] || FORMAT_LAYOUT.landscape;
  const isDark = theme === 'dark';
  const isShareCard = Boolean(shareLink);
  const totalItems = tiers.reduce((acc, row) => acc + (row.items?.length || 0), 0);
  const centerHeadings = shareFormat === 'story';

  const plan = useMemo(
    () => computeExportLayoutPlan(layout, tiers, isShareCard),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layout, tiers, isShareCard]
  );

  const containerBg = isDark ? '#141517' : '#ffffff';
  const borderColor = isDark ? '#2a2b30' : '#e5e7eb';
  const rowBg = isDark ? '#1a1b1e' : '#f9fafb';
  const itemAreaBg = isDark ? '#222428' : '#ffffff';
  const textMain = isDark ? '#f3f4f6' : '#111827';
  const textMuted = isDark ? '#9ca3af' : '#6b7280';
  const clsItemBorder = isDark ? 'border-gray-700 bg-[#2a2c31] text-gray-200' : 'border-gray-200 bg-white text-gray-800';

  return (
    <div
      className="rounded-2xl border shadow-sm"
      style={{
        width: layout.width,
        height: layout.height,
        padding: layout.padding,
        display: 'flex',
        flexDirection: 'column',
        background: containerBg,
      }}
    >
      {/* Header: author row + title + item count */}
      <header
        className="shrink-0"
        style={{ paddingBottom: 18, borderBottom: `1px solid ${borderColor}`, marginBottom: layout.headerGap }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <Avatar
              name={authorName}
              src={authorAvatar}
              style={{ width: layout.avatarSize, height: layout.avatarSize, fontSize: Math.round(layout.avatarSize * 0.4) }}
            />
            <div style={{ minWidth: 0 }}>
              <p
                style={{
                  fontSize: layout.nameSize, fontWeight: 700, color: textMain, lineHeight: 1.2,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              >
                {authorName || 'Unknown User'}
              </p>
              {postedAt && (
                <p style={{ fontSize: layout.subSize, fontWeight: 500, color: textMuted, marginTop: 2 }}>{postedAt}</p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, background: '#4f46e5', color: '#ffffff',
                fontWeight: 900, fontSize: layout.badgeSize, padding: '4px 12px', borderRadius: 999,
                letterSpacing: 1, textTransform: 'uppercase', whiteSpace: 'nowrap',
              }}
            >
              ★ TEAR OF GOD
            </span>
            {typeBadge && (
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center',
                  background: isDark ? 'rgba(99,102,241,0.2)' : '#e0e7ff',
                  color: isDark ? '#a5b4fc' : '#4338ca',
                  border: `1px solid ${isDark ? 'rgba(99,102,241,0.4)' : '#c7d2fe'}`,
                  fontWeight: 700, fontSize: layout.badgeSize,
                  padding: '4px 12px', borderRadius: 999, whiteSpace: 'nowrap',
                }}
              >
                {typeBadge}
              </span>
            )}
            {Boolean(formatHashtags(hashtags)) && (
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center', background: 'rgba(245,158,11,0.15)', color: '#d97706',
                  border: `1px solid rgba(245,158,11,0.35)`, fontWeight: 700, fontSize: layout.badgeSize,
                  padding: '4px 12px', borderRadius: 999, whiteSpace: 'nowrap',
                }}
              >
                {formatHashtags(hashtags)}
              </span>
            )}
          </div>
        </div>

        {title && (
          <h2
            style={{
              fontSize: layout.titleSize, fontWeight: 900, lineHeight: 1.15, color: textMain,
              marginTop: layout.headerGap, wordBreak: 'break-word', textAlign: centerHeadings ? 'center' : 'left',
            }}
          >
            {title}
          </h2>
        )}
        <p
          style={{
            fontSize: layout.itemsCountSize, fontWeight: 500, color: textMuted, marginTop: 8,
            textAlign: centerHeadings ? 'center' : 'left',
          }}
        >
          {totalItems} items ranked
        </p>
      </header>

      {/* Tier table: rows stretch to fill leftover height, items top-aligned */}
      <div
        className="shadow-2xs"
        style={{
          display: 'flex', flex: 1, minHeight: 0, flexDirection: 'column',
          border: `1px solid ${borderColor}`, borderRadius: 12, overflow: 'hidden',
        }}
      >
        {plan.rows.map((row, i) => (
          <div
            key={`${i}-${row.tier}`}
            style={{
              display: 'flex', alignItems: 'stretch', flex: 1, minHeight: row.minHeight,
              background: rowBg, borderTop: i === 0 ? 'none' : `1px solid ${borderColor}`,
            }}
          >
            <TierLabel
              label={row.tier}
              color={row.color}
              index={row.index}
              className="shrink-0 font-black"
              fallbackClassName="bg-gray-200 text-gray-700"
              style={{ width: layout.tierLabelWidth, minWidth: layout.tierLabelWidth, fontSize: layout.tierLabelSize }}
            />
            <div
              style={{
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', alignContent: 'center',
                gap: plan.itemGap, padding: `${layout.rowPadY}px ${layout.rowPadX}px`,
                flex: 1, minWidth: 0, background: itemAreaBg,
              }}
            >
              {row.items.length === 0 ? (
                <span style={{ fontSize: layout.itemTextSize, fontStyle: 'italic', fontWeight: 500, color: textMuted, padding: '0 8px' }}>
                  ไม่มีรายการในระดับนี้
                </span>
              ) : (
                row.items.map((item, idx) => (
                  <ExportCardItem
                    key={idx}
                    item={item}
                    clsItemBorder={clsItemBorder}
                    itemSize={plan.itemSize}
                    itemTextSize={layout.itemTextSize}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {isShareCard && (
        <div
          className="shrink-0"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
            marginTop: layout.shareGapTop, padding: layout.sharePadY,
            border: `1px solid ${borderColor}`, borderRadius: 12, background: rowBg,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: textMain, lineHeight: 1.3 }}>{shareCta}</p>
            <p style={{ fontSize: 11, fontWeight: 600, color: textMuted, marginTop: 6 }}>{shareQrHint}</p>
          </div>
          <ShareQr value={shareLink} size={layout.qrSize} />
        </div>
      )}

      {/* Footer: watermark */}
      <footer
        className="shrink-0"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: layout.footerGapTop, paddingTop: 12, borderTop: `1px solid ${borderColor}`,
          fontSize: layout.footerSize, fontWeight: 500, color: textMuted,
        }}
      >
        <span>{footerText || 'Tear of God Ranking'}</span>
        <span style={{ fontWeight: 600 }}>tearofgod.pages.dev</span>
      </footer>
    </div>
  );
}