import { toPng } from 'html-to-image';

export async function downloadTablePng(node, filename) {
  if (!node) return false;
  try {
    const dataUrl = await toPng(node, { pixelRatio: 2, backgroundColor: '#fff', cacheBust: true });
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
    return true;
  } catch (error) {
    console.error('export image error:', error);
    return false;
  }
}
