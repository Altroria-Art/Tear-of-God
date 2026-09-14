import React, { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import { copyToClipboard } from '../../lib/share';
import { downloadTablePng } from '../../lib/exportImage';
import { useToast } from './Toast';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { Moon, Sun, Swords } from 'lucide-react';
import { trackShare } from '../../lib/analytics';

const IMAGE_FORMATS = [
  { id: 'landscape', labelKey: 'shareExport.formatLandscape', hint: '1200 × 630' },
  { id: 'square', labelKey: 'shareExport.formatSquare', hint: '1080 × 1080' },
  { id: 'story', labelKey: 'shareExport.formatStory', hint: '1080 × 1920' },
];

const FORMAT_WIDTHS = {
  landscape: 'max-w-[640px]',
  square: 'max-w-[540px]',
  story: 'max-w-[360px]',
};

function FormatPicker({ value, onChange }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={t('shareExport.imageFormat')}>
      <span className="mr-1 text-xs font-bold text-muted">{t('shareExport.imageFormat')}</span>
      {IMAGE_FORMATS.map((format) => (
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
  challengeLink, // optional: ลิงก์จัดอันดับจากโพสต์นี้แล้วเทียบผล
  preview, // สำหรับ export: React element ของการ์ดที่จะ capture
  filename, // สำหรับ export
  stats, // สำหรับ export: [{ item, avg, tier, votes }] — ข้อมูลสถิติความนิยม
  statsFilename, // ชื่อไฟล์ข้อมูลสถิติ (ไม่มี ext)
}) {
  const toast = useToast();
  const { t } = useTranslation();
  const { isLightMode } = useTheme();
  const previewRef = useRef(null);
  const [copied, setCopied] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportTheme, setExportTheme] = useState(isLightMode ? 'light' : 'dark');
  const [imageFormat, setImageFormat] = useState('landscape');
  const [shareCardOpen, setShareCardOpen] = useState(false);
  const closeTimerRef = useRef(null);
  const shareCardRef = useRef(null);

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
      toast.success(t(kind === 'challenge' ? 'challenge.copySuccess' : 'shareExport.copySuccess'));
      if (kind === 'share') closeTimerRef.current = setTimeout(onClose, 400);
    } else {
      toast.error(t('shareExport.copyFailed'));
    }
  };

  const handleDownload = async () => {
    setExporting(true);
    toast.info(t('shareExport.creatingImage'));
    const bgColor = exportTheme === 'dark' ? '#141517' : '#ffffff';
    const suffix = imageFormat === 'landscape' ? '' : `-${imageFormat}`;
    const imageFilename = `${String(filename || 'tear-of-god-share').replace(/\.png$/i, '')}${suffix}.png`;
    const ok = await downloadTablePng(previewRef.current, imageFilename, bgColor);
    setExporting(false);
    if (ok) {
      toast.success(t('shareExport.downloadTableSuccess'));
      onClose();
    } else {
      toast.error(t('shareExport.exportImageFailed'));
    }
  };

  const handleDownloadShareCard = async () => {
    if (!shareCardRef.current) return;
    setExporting(true);
    toast.info(t('shareExport.creatingImage'));
    const suffix = imageFormat === 'landscape' ? '' : `-${imageFormat}`;
    const imageFilename = `${String(filename || 'tear-of-god-share').replace(/\.png$/i, '')}${suffix}.png`;
    const ok = await downloadTablePng(shareCardRef.current, imageFilename, exportTheme === 'dark' ? '#141517' : '#ffffff');
    setExporting(false);
    if (ok) toast.success(t('shareExport.downloadTableSuccess'));
    else toast.error(t('shareExport.exportImageFailed'));
  };

  const renderPreview = (format = imageFormat) => {
    if (!React.isValidElement(preview)) return preview;
    return React.cloneElement(preview, {
      theme: exportTheme,
      shareLink: challengeLink || link,
      shareFormat: format,
      shareCta: t('shareExport.shareCardCta'),
      shareQrHint: challengeLink ? t('shareExport.qrChallengeHint') : t('shareExport.qrHint'),
    });
  };

  const renderShareCardPanel = (ref) => (
    <>
      <FormatPicker value={imageFormat} onChange={setImageFormat} />
      <div className="mt-3 rounded-2xl border border-line-soft bg-black/5 p-3 shadow-inner dark:bg-white/5">
        <div ref={ref} className={`mx-auto w-full ${FORMAT_WIDTHS[imageFormat]}`}>
          {renderPreview(imageFormat)}
        </div>
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
      <Modal open={open} onClose={onClose} title={t('shareExport.shareLinkTitle')} maxWidth={shareCardOpen ? 'max-w-4xl' : 'max-w-md'}>
        {challengeLink && (
          <div className="mb-4 rounded-xl border border-highlight/40 bg-highlight/10 p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-highlight text-canvas">
                <Swords size={20} strokeWidth={2.5} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-ink">{t('challenge.shareTitle')}</p>
                <p className="mt-1 text-sm text-muted">{t('challenge.shareHint')}</p>
                <button
                  type="button"
                  onClick={() => handleCopy(challengeLink, 'challenge')}
                  className="mt-3 w-full rounded-lg bg-highlight px-4 py-2.5 text-sm font-black text-canvas transition-all hover:brightness-110 active:scale-[0.98]"
                >
                  {copied === 'challenge' ? t('challenge.copied') : t('challenge.copyLink')}
                </button>
              </div>
            </div>
          </div>
        )}
        <p className="mb-3 text-sm text-muted">{challengeLink ? t('shareExport.sharePostHint') : t('shareExport.shareHint')}</p>
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
            {renderShareCardPanel(shareCardRef)}
          </div>
        )}
      </Modal>
    );
  }

  if (mode === 'export') {
    return (
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
          <div ref={previewRef} className={`w-full ${FORMAT_WIDTHS[imageFormat]} shadow-md rounded-2xl overflow-hidden`}>
            {renderPreview(imageFormat)}
          </div>
        </div>
      </Modal>
    );
  }

  return null;
}
