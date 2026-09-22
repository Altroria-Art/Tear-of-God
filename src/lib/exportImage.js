import { toPng } from 'html-to-image';

// Real target sizes for exported PNGs. The modal preview may scale these down
// for the screen, but a downloaded file must ALWAYS match these dimensions —
// never the viewport or the modal width.
export const IMAGE_FORMATS = {
  landscape: { width: 1200, height: 630 }, // ~1.9 : 1
  square: { width: 1080, height: 1080 },   // 1 : 1
  story: { width: 1080, height: 1920 },    // 9 : 16
};

export async function downloadTablePng(node, filename, options = {}) {
  if (!node) return false;
  const { backgroundColor = '#ffffff', format = 'landscape' } = options;
  const { width, height } = IMAGE_FORMATS[format] || IMAGE_FORMATS.landscape;
  try {
    // html-to-image@1.11.13 (node_modules/html-to-image/lib/index.js:88-92):
    //   ratio         = options.pixelRatio || getPixelRatio()  (window.devicePixelRatio)
    //   canvasWidth   = options.canvasWidth  || width          (options.width || node.clientWidth)
    //   canvas.height = canvasWidth * ratio
    // Without pixelRatio:1 a 2x phone would silently double the file size
    // (e.g. 2400x1260), breaking the exact target dimension. Pinning the
    // canvas size + pixelRatio guarantees the final PNG matches the format.
    const dataUrl = await toPng(node, {
      width,
      height,
      canvasWidth: width,
      canvasHeight: height,
      pixelRatio: 1,
      backgroundColor,
      cacheBust: true,
    });
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