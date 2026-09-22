import React, { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import { copyToClipboard } from '../../lib/share';
import { downloadTablePng, IMAGE_FORMATS } from '../../lib/exportImage';
import { useToast } from './Toast';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { Moon, Sun } from 'lucide-react';
import { trackShare } from '../../lib/analytics';

const FORMAT_OPTIONS = [
  { id: 'landscape', labelKey: 'shareExport.formatLandscape', hint: '1200 × 630' },
  { id: 'square', labelKey: 'shareExport.formatSquare', hint: '1080 × 1080' },
  { id: 'story', labelKey: 'shareExport.formatStory', hint: '1080 × 1920' },
];

// On-screen preview: the card is always rendered at its REAL pixel size and
// simply scaled down to fit the modal (the export capture never touches this
// node). The wrapper keeps the format's exact aspect ratio so landscape (1.9:1),
// square (1:1) and story (9:16) are all visibly correct on any screen.
function ScaledPreview({ width, height, children }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div
      ref={ref}
      className="relative mx-auto w-full overflow-hidden rounded-2xl shadow-md"
      style={{ aspectRatio: `${width} / ${height}`, minHeight: 80 }}
    >
      <div
        className="pointer-events-none absolute left-0 top-0"
        style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        {children}
      </div>
    </div>
  );
}

function FormatPicker({ value, onChange }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={t('shareExport.imageFormat')}>
      <span className="mr-1 text-xs font-bold text-muted">{t('shareExport.imageFormat')}</span>
      {FORMAT_OPTIONS.map((format) => (
        <button
          key={format.id}
          type="button"
          onClick={() => onChange(format.id)}
          className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors ${
            value === format.id
              ? 'border-brand bg-brand/10 text-brand'
              : 'border-line-soft text-muted hover:bg-tag hover:text-ink'
          }`}
        >
          {t(format.labelKey)} <span className="ml-1 text-[10px] font-medium opacity-70">{format.hint}</span>
        </button>
      ))}
    </div>
  );
}

export default function ShareExportModal({
  open,
  onClose,
  mode, // 'share' | 'export'
  link, // สำหรับ share
  preview, // สำหรับ export: React element ของการ์ดที่จะ capture
  filename, // สำหรับ export
  stats, // สำหรับ export: [{ item, avg, tier, votes }] — ข้อมูลสถิติความนิยม
  statsFilename, // ชื่อไฟล์ข้อมูลสถิติ (ไม่มี ext)
}) {
  const toast = useToast();
  const { t } = useTranslation();
  const { isLightMode } = useTheme();
  const captureRef = useRef(null);
  const [copied, setCopied] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportTheme, setExportTheme] = useState(isLightMode ? 'light' : 'dark');
  const [imageFormat, setImageFormat] = useState('landscape');
  const [shareCardOpen, setShareCardOpen] = useState(false);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    if (open) {
      setExportTheme(isLightMode ? 'light' : 'dark');
      setCopied(null);
      setImageFormat('landscape');
      setShareCardOpen(false);
    }
  }, [open, isLightMode]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, []);

  const handleCopy = async (target, kind) => {
    const ok = await copyToClipboard(target);
    if (ok) {
      trackShare(target, kind);
      setCopied(kind);
      toast.success(t('shareExport.copySuccess'));
      if (kind === 'share') closeTimerRef.current = setTimeout(onClose, 400);
    } else {
      toast.error(t('shareExport.copyFailed'));
    }
  };

  const captureFilename = () => {
    const suffix = imageFormat === 'landscape' ? '' : `-${imageFormat}`;
    return `${String(filename || 'tear-of-god-share').replace(/\.png$/i, '')}${suffix}.png`;
  };

  const handleDownload = async () => {
    setExporting(true);
    toast.info(t('shareExport.creatingImage'));
    const bgColor = exportTheme === 'dark' ? '#141517' : '#ffffff';
    const ok = await downloadTablePng(captureRef.current, captureFilename(), { backgroundColor: bgColor, format: imageFormat });
    setExporting(false);
    if (ok) {
      toast.success(t('shareExport.downloadTableSuccess'));
      onClose();
    } else {
      toast.error(t('shareExport.exportImageFailed'));
    }
  };

  const handleDownloadShareCard = async () => {
    if (!captureRef.current) return;
    setExporting(true);
    toast.info(t('shareExport.creatingImage'));
    const ok = await downloadTablePng(captureRef.current, captureFilename(), {
      backgroundColor: exportTheme === 'dark' ? '#141517' : '#ffffff',
      format: imageFormat,
    });
    setExporting(false);
    if (ok) toast.success(t('shareExport.downloadTableSuccess'));
    else toast.error(t('shareExport.exportImageFailed'));
  };

  const renderPreview = (format = imageFormat) => {
    if (!React.isValidElement(preview)) return preview;
    return React.cloneElement(preview, {
      theme: exportTheme,
      shareLink: link,
      shareFormat: format,
      shareCta: t('shareExport.shareCardCta'),
      shareQrHint: t('shareExport.qrHint'),
    });
  };

  // Offscreen capture target rendered at the format's REAL pixel size.
  // Kept mounted (never display:none) so html-to-image can capture it. The
  // outer host keeps the positioning tricks; the node itself stays clean of
  // position/fixed/transform because those computed styles get copied into the
  // cloned SVG root and would shift the whole export off-canvas.
  const formatDims = IMAGE_FORMATS[imageFormat] || IMAGE_FORMATS.landscape;

  const renderCaptureHost = () =>
    open && React.isValidElement(preview) ? (
      <div aria-hidden="true" className="pointer-events-none fixed -left-[9999px] top-0" style={{ zIndex: -1 }}>
        <div
          ref={captureRef}
          style={{ width: formatDims.width, height: formatDims.height, overflow: 'hidden' }}
        >
          {renderPreview(imageFormat)}
        </div>
      </div>
    ) : null;

  const renderShareCardPanel = () => (
    <>
      <FormatPicker value={imageFormat} onChange={setImageFormat} />
      <div className="mt-3 rounded-2xl border border-line-soft bg-black/5 p-3 shadow-inner dark:bg-white/5">
        <ScaledPreview width={formatDims.width} height={formatDims.height}>
          {renderPreview(imageFormat)}
        </ScaledPreview>
      </div>
      <button
        type="button"
        onClick={handleDownloadShareCard}
        disabled={exporting}
        className="mt-3 w-full rounded-xl bg-brand-accent px-4 py-2.5 text-sm font-bold text-canvas transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
      >
        {exporting ? t('shareExport.generating') : t('shareExport.downloadShareCard')}
      </button>
    </>
  );

  const downloadTextFile = (content, mime, name) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    if (!Array.isArray(stats) || stats.length === 0) { toast.error(t('shareExport.noStats')); return; }
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = 'item,avg,tier,votes';
    const rows = stats.map((s) => [esc(s.item), s.avg, esc(s.tier), s.votes].join(','));
    downloadTextFile([header, ...rows].join('\n'), 'text/csv;charset=utf-8', `${statsFilename || 'stats'}.csv`);
    toast.success(t('shareExport.downloadCsvSuccess'));
    onClose();
  };

  const handleExportJson = () => {
    if (!Array.isArray(stats) || stats.length === 0) { toast.error(t('shareExport.noStats')); return; }
    downloadTextFile(JSON.stringify(stats, null, 2), 'application/json', `${statsFilename || 'stats'}.json`);
    toast.success(t('shareExport.downloadJsonSuccess'));
    onClose();
  };

  if (mode === 'share') {
    return (
      <>
        <Modal open={open} onClose={onClose} title={t('shareExport.shareLinkTitle')} maxWidth={shareCardOpen ? 'max-w-2xl' : 'max-w-md'}>
          <p className="mb-3 text-sm text-muted">{t('shareExport.shareHint')}</p>
          <div className="flex items-center gap-2 rounded-lg border border-line-soft bg-tag p-2">
            <input
              type="text"
              readOnly
              value={link}
              onFocus={(e) => e.target.select()}
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
            />
            <button
              type="button"
              onClick={() => handleCopy(link, 'share')}
              className="shrink-0 rounded-lg bg-brand-accent px-4 py-2 text-sm font-bold text-canvas transition-all hover:brightness-110 active:scale-95"
            >
              {copied === 'share' ? t('shareExport.copied') : t('shareExport.copyLink')}
            </button>
          </div>
          {React.isValidElement(preview) && !shareCardOpen && (
            <button
              type="button"
              onClick={() => setShareCardOpen(true)}
              className="mt-3 w-full rounded-xl border border-brand/30 bg-brand/5 px-4 py-2.5 text-sm font-bold text-brand transition-colors hover:bg-brand/10"
            >
              {t('shareExport.previewShareCard')}
            </button>
          )}
          {React.isValidElement(preview) && shareCardOpen && (
            <div className="mt-5 border-t border-line-soft pt-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-black text-ink">{t('shareExport.shareCardTitle')}</p>
                <button type="button" onClick={() => setShareCardOpen(false)} className="text-xs font-bold text-muted hover:text-ink">
                  {t('common.back')}
                </button>
              </div>
              {renderShareCardPanel()}
            </div>
          )}
        </Modal>
        {renderCaptureHost()}
      </>
    );
  }

  if (mode === 'export') {
    return (
      <>
        <Modal
          open={open}
          onClose={onClose}
          title={t('shareExport.exportTableTitle')}
          maxWidth="max-w-3xl"
          footer={
            <>
              {Array.isArray(stats) && stats.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="rounded-lg border border-line-soft px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-tag"
                  >
                    {t('shareExport.downloadCsv')}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="rounded-lg border border-line-soft px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-tag"
                  >
                    {t('shareExport.downloadJson')}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-line-soft px-4 py-2 text-sm font-bold text-muted transition-colors hover:bg-tag hover:text-ink"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={exporting}
                className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-bold text-canvas transition-all hover:brightness-110 active:scale-95 disabled:opacity-60"
              >
                {exporting ? t('shareExport.generating') : t('shareExport.download')}
              </button>
            </>
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <p className="text-sm text-muted">
              {t('shareExport.exportHint')}
              {filename ? <span className="text-ink-soft"> · {filename}</span> : null}
            </p>
            <div className="flex bg-surface-glass border border-line-soft rounded-lg p-0.5 shadow-xs">
              <button
                type="button"
                onClick={() => setExportTheme('light')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  exportTheme === 'light' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-muted hover:text-ink'
                }`}
              >
                <Sun size={14} /> Light
              </button>
              <button
                type="button"
                onClick={() => setExportTheme('dark')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  exportTheme === 'dark' ? 'bg-gray-800 text-white shadow-sm border border-gray-700' : 'text-muted hover:text-ink'
                }`}
              >
                <Moon size={14} /> Dark
              </button>
            </div>
          </div>
          <div className="mb-3">
            <FormatPicker value={imageFormat} onChange={setImageFormat} />
          </div>
          <div className="rounded-2xl border border-line-soft bg-black/5 dark:bg-white/5 p-3 sm:p-5 flex justify-center items-start shadow-inner">
            <ScaledPreview width={formatDims.width} height={formatDims.height}>
              {renderPreview(imageFormat)}
            </ScaledPreview>
          </div>
        </Modal>
        {renderCaptureHost()}
      </>
    );
  }

  return null;
}