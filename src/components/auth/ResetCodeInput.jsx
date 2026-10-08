import { useRef } from 'react';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const POSITIONS = [[0, -72], [62, -36], [62, 36], [0, 72], [-62, 36], [-62, -36]];

export default function ResetCodeInput({ value, onChange, onComplete, status = 'idle' }) {
  const { t } = useTranslation();
  const input = useRef(null);
  const busy = status === 'checking' || status === 'verified';
  const activeIndex = Math.min(value.length, 5);

  return <div className={`reset-code-stage reset-code-stage--${status}`}>
    <label className="sr-only" htmlFor="reset-code">{t('auth.resetCodeLabel')}</label>
    <div className="reset-code-orbit" aria-hidden="true"><span /><span /></div>
    <div className="reset-code-slots" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <span key={index}
      className={`reset-code-slot ${activeIndex === index ? 'is-active' : ''} ${value[index] ? 'is-filled' : ''}`}
      style={{ '--slot-index': index, '--orbit-x': `${POSITIONS[index][0]}px`, '--orbit-y': `${POSITIONS[index][1]}px` }}>{value[index] || ''}</span>)}</div>
    <input ref={input} id="reset-code" type="text" inputMode="numeric" autoComplete="one-time-code"
      className="reset-code-native" value={value} maxLength={6} pattern="[0-9]{6}" disabled={busy}
      aria-invalid={status === 'error'} aria-describedby="reset-code-help" required
      onChange={event => {
        const next = event.target.value.replace(/\D/g, '').slice(0, 6);
        onChange(next);
        if (next.length === 6 && next !== value) onComplete(next);
      }} />
    {status === 'verified' && <div className="reset-code-confirm" aria-hidden="true"><Check size={30} /></div>}
    <p className="reset-code-status" role="status">{t(status === 'checking' ? 'auth.checkingCode' : status === 'verified' ? 'auth.codeVerified' : 'auth.codeInputHint')}</p>
  </div>;
}
