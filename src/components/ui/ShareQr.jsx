import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function ShareQr({ value, size = 72, className = '' }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let active = true;
    if (!value) {
      setSrc(null);
      return () => { active = false; };
    }

    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#111827', light: '#ffffff' },
    })
      .then((dataUrl) => {
        if (active) setSrc(dataUrl);
      })
      .catch(() => {
        if (active) setSrc(null);
      });

    return () => { active = false; };
  }, [value, size]);

  if (!value || !src) return null;
  return <img src={src} alt="" aria-hidden="true" width={size} height={size} className={`rounded-md bg-white p-1 ${className}`} />;
}
