import React, { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import { copyToClipboard } from '../../lib/share';
import { downloadTablePng } from '../../lib/exportImage';
import { useToast } from './Toast';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { Moon, Sun } from 'lucide-react';

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
  const previewRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportTheme, setExportTheme] = useState(isLightMode ? 'light' : 'dark');
  const closeTimerRef = useRef(null);

  useEffect(() => {
    if (open) {
      setExportTheme(isLightMode ? 'light' : 'dark');
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

  const handleCopy = async () => {
    const ok = await copyToClipboard(link);
    if (ok) {
      setCopied(true);
      toast.success(t('shareExport.copySuccess'));
      closeTimerRef.current = setTimeout(onClose, 400);
    } else {
      toast.error(t('shareExport.copyFailed'));
    }
  };

  const handleDownload = async () => {
    setExporting(true);
    toast.info(t('shareExport.creatingImage'));
    const bgColor = exportTheme === 'dark' ? '#141517' : '#ffffff';
    const ok = await downloadTablePng(previewRef.current, filename, bgColor);
    setExporting(false);
    if (ok) {
      toast.success(t('shareExport.downloadTableSuccess'));
      onClose();
    } else {
      toast.error(t('shareExport.exportImageFailed'));
    }
  };

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
      <Modal open={open} onClose={onClose} title={t('shareExport.shareLinkTitle')}>
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
            onClick={handleCopy}
            className="shrink-0 rounded-lg bg-brand-accent px-4 py-2 text-sm font-bold text-canvas transition-all hover:brightness-110 active:scale-95"
          >
            {copied ? t('shareExport.copied') : t('shareExport.copyLink')}
          </button>
        </div>
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
        <div className="rounded-2xl border border-line-soft bg-black/5 dark:bg-white/5 p-3 sm:p-5 flex justify-center items-start shadow-inner">
          <div ref={previewRef} className="w-full max-w-[640px] shadow-md rounded-2xl overflow-hidden">
            {React.isValidElement(preview) ? React.cloneElement(preview, { theme: exportTheme }) : preview}
          </div>
        </div>
      </Modal>
    );
  }

  return null;
}
