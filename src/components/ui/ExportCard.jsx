import { useMemo, useState } from 'react';
import { formatHashtags } from '../../lib/hashtags';
import { normalizeImageUrl } from '../../lib/images';
import Avatar from './Avatar';
import TierLabel from '../tier/TierLabel';
import ShareQr from './ShareQr';

// Every number here is a hard pixel value chosen for the export size, NOT a
// Tailwind breakpoint. The card is rendered at its real pixel size (captured
// as-is offscreen) and simply `scale()`d down for the on-screen preview, so
// `sm:`/`md:` viewport utilities would be evaluated against the PHONE viewport
// and corrupt the export. Layout must be deterministic per `shareFormat`.
const FORMAT_LAYOUT = {
  landscape: {
    width: 1200, height: 630, padding: 28,
    avatarSize: 42,
    headerGap: 14,
    titleSize: 32,
    nameSize: 15, subSize: 12, badgeSize: 12,
    itemsCountSize: 13,
    tierLabelWidth: 76, tierLabelSize: 18,
    itemSizeBase: 84, itemSizeMin: 36, itemGapBase: 10, itemGapMin: 4, step: 2,
    rowPadX: 10, rowPadY: 4,
    itemTextSize: 11,
    sharePadY: 8, qrSize: 48, shareGapTop: 8,
    footerSize: 12, footerGapTop: 10,
  },
  square: {
    width: 1080, height: 1080, padding: 40,
    avatarSize: 54,
    headerGap: 20,
    titleSize: 44,
    nameSize: 16, subSize: 13, badgeSize: 13,
    itemsCountSize: 14,
    tierLabelWidth: 108, tierLabelSize: 24,
    itemSizeBase: 96, itemSizeMin: 48, itemGapBase: 12, itemGapMin: 6, step: 2,
    rowPadX: 14, rowPadY: 10,
    itemTextSize: 13,
    sharePadY: 16, qrSize: 68, shareGapTop: 14,
    footerSize: 13, footerGapTop: 14,
  },
  story: {
    width: 1080, height: 1920, padding: 48,
    avatarSize: 60,
    headerGap: 24,
    titleSize: 52,
    nameSize: 18, subSize: 14, badgeSize: 14,
    itemsCountSize: 15,
    tierLabelWidth: 122, tierLabelSize: 26,
    itemSizeBase: 116, itemSizeMin: 58, itemGapBase: 15, itemGapMin: 8, step: 2,
    rowPadX: 16, rowPadY: 12,
    itemTextSize: 14,
    sharePadY: 18, qrSize: 88, shareGapTop: 16,
    footerSize: 14, footerGapTop: 16,
  },
};

function buildRows(l, itemSize, itemGap, tiers) {
  const usableWidth = l.width - 2 * l.padding - l.tierLabelWidth - 2 * l.rowPadX;
  return tiers.map(({ tier, color, index, items }) => {
    const list = items || [];
    if (list.length === 0) {
      return { index, tier, color, items: list, minHeight: itemSize + 2 * l.rowPadY };
    }
    const perRow = Math.max(1, Math.floor((usableWidth + itemGap) / (itemSize + itemGap)));
    const itemRows = Math.ceil(list.length / perRow);
    const itemsH = itemRows * itemSize + (itemRows - 1) * itemGap;
    return { index, tier, color, items: list, minHeight: Math.max(itemSize + 2 * l.rowPadY, itemsH + 2 * l.rowPadY) };
  });
}

// Fixed non-table budget within the card height (header / share block / footer).
function estimateTableBudget(l, isShareCard) {
  const headerH =
    l.avatarSize + l.headerGap + Math.round(l.titleSize * 1.25) + 6 + Math.round(l.itemsCountSize * 1.25) + 22;
  const shareH = isShareCard ? l.qrSize + 2 * l.sharePadY + 32 + l.shareGapTop : 0;
  const footerH = l.footerGapTop + Math.round(l.footerSize * 1.3) + 10;
  return l.height - 2 * l.padding - headerH - shareH - footerH;
}

function tableHeight(l, rows) {
  return rows.reduce((acc, r) => acc + r.minHeight, 0) + Math.max(0, rows.length - 1);
}

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
}) {
  const layout = FORMAT_LAYOUT[shareFormat] || FORMAT_LAYOUT.landscape;
  const isDark = theme === 'dark';
  const isShareCard = Boolean(shareLink);
  const totalItems = tiers.reduce((acc, row) => acc + (row.items?.length || 0), 0);
  const centerHeadings = shareFormat === 'story';

  const plan = useMemo(() => {
    const available = estimateTableBudget(layout, isShareCard);
    // Start at the smallest size and walk up: when nothing fits we STAY at min
    // (best-effort, never silently scale back up to base and overflow anyway).
    let size = layout.itemSizeMin;
    for (let s = layout.itemSizeBase; s >= layout.itemSizeMin; s -= layout.step) {
      const g = Math.max(layout.itemGapMin, Math.round(layout.itemGapBase * (s / layout.itemSizeBase)));
      if (tableHeight(layout, buildRows(layout, s, g, tiers)) <= available) {
        size = s;
        break;
      }
    }
    const itemGap = Math.max(layout.itemGapMin, Math.round(layout.itemGapBase * (size / layout.itemSizeBase)));
    return { itemSize: size, itemGap, rows: buildRows(layout, size, itemGap, tiers) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, tiers, isShareCard]);

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
            {hashtags && (
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
        <span>Tear of God Ranking</span>
        <span style={{ fontWeight: 600 }}>tearofgod.pages.dev</span>
      </footer>
    </div>
  );
}