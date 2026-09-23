import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { STATS_FORMAT_LAYOUT } from '../../lib/statsChartLayout';

/**
 * Community Average Popularity Statistics Chart
 * Supports both responsive in-page display and exact multi-format PNG exports
 * (Landscape 1200x630, Square 1080x1080, Story 1080x1920).
 */
export default function CommunityAvgStatsChart({
  title,
  subtitle,
  items = [],
  maxScore,
  topN = 10,
  theme = null,
  shareFormat = null,
}) {
  const { t } = useTranslation();
  const themeContext = useTheme();
  const activeTheme = theme || (themeContext?.isLightMode ? 'light' : 'dark');
  const isDark = activeTheme === 'dark';

  const isExport = Boolean(shareFormat);
  const layout = STATS_FORMAT_LAYOUT[shareFormat] || STATS_FORMAT_LAYOUT.landscape;

  const sorted = [...items]
    .filter((it) => it.avg != null)
    .sort((a, b) => b.avg - a.avg || (b.votes || 0) - (a.votes || 0))
    .slice(0, topN);

  const best = sorted[0];
  const divisor = Math.max(1, maxScore || 1);

  const containerBg = isDark ? '#141517' : '#ffffff';
  const borderColor = isDark ? '#2a2b30' : '#e5e7eb';
  const textMain = isDark ? '#f3f4f6' : '#111827';
  const textMuted = isDark ? '#9ca3af' : '#6b7280';
  const barBg = isDark ? '#24262b' : '#f3f4f6';
  const bannerBg = isDark ? 'rgba(245, 158, 11, 0.12)' : '#fffbeb';
  const bannerBorder = isDark ? 'rgba(245, 158, 11, 0.3)' : '#fde68a';
  const bannerText = isDark ? '#fbbf24' : '#92400e';
  const rowCardBg = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)';
  const rowCardBorder = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';

  if (isExport) {
    const isStory = shareFormat === 'story';
    return (
      <div
        className="rounded-2xl border shadow-sm"
        style={{
          width: layout.width,
          height: layout.height,
          padding: layout.padding,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: containerBg,
          borderColor: borderColor,
          color: textMain,
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <header style={{ flexShrink: 0, paddingBottom: layout.colHeaderPadBottom, borderBottom: `1px solid ${borderColor}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, background: '#4f46e5', color: '#ffffff',
                fontWeight: 900, fontSize: layout.badgeSize, padding: '4px 12px', borderRadius: 999,
                letterSpacing: 1, textTransform: 'uppercase', whiteSpace: 'nowrap',
              }}
            >
              ★ TEAR OF GOD
            </span>
            <span
              style={{
                display: 'inline-flex', alignItems: 'center',
                background: isDark ? 'rgba(245, 158, 11, 0.18)' : '#fef3c7',
                color: isDark ? '#fbbf24' : '#b45309',
                border: `1px solid ${isDark ? 'rgba(245, 158, 11, 0.35)' : '#fde68a'}`,
                fontWeight: 700, fontSize: layout.badgeSize,
                padding: '4px 12px', borderRadius: 999, whiteSpace: 'nowrap',
              }}
            >
              {t('stats.title')}
            </span>
          </div>

          {title && (
            <h2
              style={{
                fontSize: layout.titleSize,
                fontWeight: 900,
                lineHeight: 1.2,
                color: textMain,
                marginTop: layout.headerGap,
                wordBreak: 'break-word',
              }}
            >
              {title}
            </h2>
          )}
          {subtitle && (
            <p style={{ fontSize: layout.subtitleSize, fontWeight: 500, color: textMuted, marginTop: 4 }}>
              {subtitle}
            </p>
          )}

          {best && (
            <div
              style={{
                marginTop: layout.bestMarginTop,
                padding: `${layout.bestPadY}px ${layout.bestPadX}px`,
                borderRadius: layout.bestRadius,
                background: bannerBg,
                border: `1px solid ${bannerBorder}`,
                color: bannerText,
                fontSize: layout.bestSize,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{ fontSize: Math.round(layout.bestSize * 1.2) }}>🏆</span>
              <span>{t('stats.best', { name: best.name, avg: best.avg, votes: best.votes ?? 0 })}</span>
            </div>
          )}
        </header>

        {/* Column Headers: VOTES column removed, bar and AVG claim remaining space */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: layout.colGap,
            paddingTop: layout.tableMarginTop,
            paddingBottom: layout.colHeaderPadBottom,
            fontSize: layout.colHeaderSize,
            fontWeight: 800,
            color: textMuted,
            textTransform: 'uppercase',
            letterSpacing: 1,
            flexShrink: 0,
          }}
        >
          <span style={{ width: layout.rankWidth, textAlign: 'right', flexShrink: 0 }}>#</span>
          <span style={{ width: layout.nameWidth, flexShrink: 0 }}>{t('stats.item')}</span>
          <span style={{ flex: 1 }} />
          <span style={{ width: layout.scoreWidth, textAlign: 'right', flexShrink: 0 }}>{t('stats.avg')}</span>
        </div>

        {/* Rows: VOTES count removed */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: sorted.length >= 8 ? 'space-between' : 'flex-start',
            gap: layout.rowGap,
            minHeight: 0,
          }}
        >
          {sorted.length === 0 ? (
            <div style={{ textAlign: 'center', color: textMuted, padding: '40px 0', fontSize: layout.nameSize }}>
              {t('participants.noResults') || 'No statistics data yet'}
            </div>
          ) : (
            sorted.map((it, idx) => {
              const isTop3 = idx < 3;
              const rankColor = isTop3 ? (idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : '#d97706') : textMuted;
              return (
                <div
                  key={it.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: layout.colGap,
                    padding: isStory ? '14px 20px' : `${layout.rowPadY}px 0`,
                    minHeight: layout.rowMinHeight,
                    background: isStory ? rowCardBg : 'transparent',
                    border: isStory ? `1px solid ${rowCardBorder}` : 'none',
                    borderRadius: isStory ? 16 : 0,
                    flex: sorted.length >= 8 ? 1 : 0,
                    maxHeight: isStory ? 100 : 'none',
                  }}
                >
                  <span
                    style={{
                      width: layout.rankWidth,
                      textAlign: 'right',
                      flexShrink: 0,
                      fontSize: layout.rankSize,
                      fontWeight: 800,
                      color: rankColor,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span
                    style={{
                      width: layout.nameWidth,
                      flexShrink: 0,
                      fontSize: layout.nameSize,
                      fontWeight: 700,
                      color: textMain,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={it.name}
                  >
                    {it.name}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: layout.barHeight,
                      background: barBg,
                      borderRadius: 999,
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        borderRadius: 999,
                        background: isTop3
                          ? 'linear-gradient(90deg, #f59e0b 0%, #ea580c 100%)'
                          : 'linear-gradient(90deg, #6366f1 0%, #4f46e5 100%)',
                        width: `${Math.min(100, Math.max(4, (it.avg / divisor) * 100))}%`,
                      }}
                    />
                  </div>
                  <span
                    style={{
                      width: layout.scoreWidth,
                      textAlign: 'right',
                      flexShrink: 0,
                      fontSize: layout.scoreSize,
                      fontWeight: 800,
                      color: isTop3 ? '#f59e0b' : (isDark ? '#e0e7ff' : '#4338ca'),
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ★ {it.avg}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <footer
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: layout.footerGap,
            paddingTop: layout.footerPadTop,
            borderTop: `1px solid ${borderColor}`,
            fontSize: layout.footerSize,
            fontWeight: 500,
            color: textMuted,
            flexShrink: 0,
          }}
        >
          <span>Tear of God Statistics</span>
          <span style={{ fontWeight: 600 }}>tearofgod.pages.dev</span>
        </footer>
      </div>
    );
  }

  // In-page responsive mode
  return (
    <div
      className="rounded-2xl border p-4 sm:p-5 shadow-sm"
      style={{
        background: containerBg,
        borderColor: borderColor,
        color: textMain,
        minWidth: 320,
      }}
    >
      {title && <p className="text-sm font-bold" style={{ color: textMain }}>{title}</p>}
      {subtitle && <p className="mt-0.5 text-xs font-medium" style={{ color: textMuted }}>{subtitle}</p>}

      {best && (
        <div
          className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"
          style={{ background: bannerBg, border: `1px solid ${bannerBorder}`, color: bannerText }}
        >
          <span>🏆</span>
          <span>{t('stats.best', { name: best.name, avg: best.avg, votes: best.votes ?? 0 })}</span>
        </div>
      )}

      <div className="mt-4 space-y-2.5">
        {/* Column Headers (NO VOTES) */}
        <div
          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide border-b pb-2 mb-2"
          style={{ borderColor: borderColor, color: textMuted }}
        >
          <span className="w-6 shrink-0 text-right">#</span>
          <span className="w-36 sm:w-44 shrink-0">{t('stats.item')}</span>
          <span className="flex-1" />
          <span className="w-16 shrink-0 text-right">{t('stats.avg')}</span>
        </div>

        {sorted.length === 0 ? (
          <p className="py-6 text-center text-xs" style={{ color: textMuted }}>
            {t('participants.noResults') || 'No statistics data yet'}
          </p>
        ) : (
          sorted.map((it, idx) => {
            const isTop3 = idx < 3;
            const rankColor = isTop3 ? (idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : '#d97706') : textMuted;
            return (
              <div key={it.name} className="flex items-center gap-2 sm:gap-3 py-0.5">
                <span className="w-6 shrink-0 text-right text-[11px] font-bold" style={{ color: rankColor }}>
                  {idx + 1}
                </span>
                <span className="w-36 sm:w-44 shrink-0 truncate text-[12px] font-semibold" style={{ color: textMain }} title={it.name}>
                  {it.name}
                </span>
                <div className="h-4 flex-1 overflow-hidden rounded-full" style={{ background: barBg }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      background: isTop3
                        ? 'linear-gradient(90deg, #f59e0b 0%, #ea580c 100%)'
                        : 'linear-gradient(90deg, #6366f1 0%, #4f46e5 100%)',
                      width: `${Math.min(100, Math.max(4, (it.avg / divisor) * 100))}%`,
                    }}
                  />
                </div>
                <span
                  className="w-16 shrink-0 text-right text-[11px] font-bold"
                  style={{ color: isTop3 ? '#f59e0b' : (isDark ? '#e0e7ff' : '#4338ca') }}
                >
                  ★ {it.avg}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}