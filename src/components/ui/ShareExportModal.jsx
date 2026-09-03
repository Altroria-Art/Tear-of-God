import { useRef, useState } from 'react';
import Modal from './Modal';
import { copyToClipboard } from '../../lib/share';
import { downloadTablePng } from '../../lib/exportImage';
import { useToast } from './Toast';

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
  const previewRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(link);
    if (ok) {
      setCopied(true);
      toast.success('คัดลอกลิงก์เรียบร้อยแล้ว!');
      setTimeout(onClose, 400);
    } else {
      toast.error('คัดลอกลิงก์ไม่สำเร็จ');
    }
  };

  const handleDownload = async () => {
    setExporting(true);
    toast.info('กำลังสร้างรูปตาราง...');
    const ok = await downloadTablePng(previewRef.current, filename);
    setExporting(false);
    if (ok) {
      toast.success('ดาวน์โหลดรูปตารางเรียบร้อย!');
      onClose();
    } else {
      toast.error('ส่งออกรูปไม่สำเร็จ');
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
    if (!Array.isArray(stats) || stats.length === 0) { toast.error('ไม่มีข้อมูลสถิติให้ส่งออก'); return; }
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = 'item,avg,tier,votes';
    const rows = stats.map((s) => [esc(s.item), s.avg, esc(s.tier), s.votes].join(','));
    downloadTextFile([header, ...rows].join('\n'), 'text/csv;charset=utf-8', `${statsFilename || 'stats'}.csv`);
    toast.success('ดาวน์โหลดสถิติ CSV เรียบร้อย!');
    onClose();
  };

  const handleExportJson = () => {
    if (!Array.isArray(stats) || stats.length === 0) { toast.error('ไม่มีข้อมูลสถิติให้ส่งออก'); return; }
    downloadTextFile(JSON.stringify(stats, null, 2), 'application/json', `${statsFilename || 'stats'}.json`);
    toast.success('ดาวน์โหลดสถิติ JSON เรียบร้อย!');
    onClose();
  };

  if (mode === 'share') {
    return (
      <Modal open={open} onClose={onClose} title="แชร์ลิงก์">
        <p className="mb-3 text-sm text-muted">คัดลอกลิงก์เพื่อส่งต่อให้ผู้อื่น</p>
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
            {copied ? 'คัดลอกแล้ว ✓' : 'Copy Link'}
          </button>
        </div>
      </Modal>
    );
  }

  if (mode === 'export') {
    return (
      <Modal open={open} onClose={onClose} title="ส่งออกรูปตาราง" maxWidth="max-w-lg">
        <p className="mb-3 text-sm text-muted">
          ตรวจสอบตัวอย่างแล้วกดดาวน์โหลด
          {filename ? <span className="text-ink-soft"> · {filename}</span> : null}
        </p>
        <div className="max-h-[55vh] overflow-auto rounded-lg border border-line-soft bg-white p-2">
          <div ref={previewRef} className="inline-block min-w-full">
            {preview}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
          {Array.isArray(stats) && stats.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleExportCsv}
                className="rounded-lg border border-line-soft px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-tag"
              >
                ดาวน์โหลด CSV
              </button>
              <button
                type="button"
                onClick={handleExportJson}
                className="rounded-lg border border-line-soft px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-tag"
              >
                ดาวน์โหลด JSON
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line-soft px-4 py-2 text-sm font-bold text-muted transition-colors hover:bg-tag hover:text-ink"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={exporting}
            className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-bold text-canvas transition-all hover:brightness-110 active:scale-95 disabled:opacity-60"
          >
            {exporting ? 'กำลังสร้าง...' : 'ดาวน์โหลด'}
          </button>
        </div>
      </Modal>
    );
  }

  return null;
}
