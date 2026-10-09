const MAX_AVATAR_SIDE = 512;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

async function isAnimatedPng(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer);
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (type === 'acTL') return true;
    if (type === 'IDAT' || type === 'IEND') return false;
    offset += length + 12;
  }
  return false;
}

// Avatar-only: keep animated/unsupported files and fall back to the original
// when browser decoding/encoding fails. Server size/signature checks still run.
export async function prepareAvatarUpload(file) {
  if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > MAX_UPLOAD_BYTES ||
      typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;
  let bitmap;
  try {
    if (file.type === 'image/png' && await isAnimatedPng(file)) return file;
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_AVATAR_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.82));
    if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, '') || 'avatar';
    return new File([blob], `${name}.webp`, { type: blob.type, lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}
