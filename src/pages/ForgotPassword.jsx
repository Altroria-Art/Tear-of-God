import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { forgotPassword } from '../lib/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg('อีเมลไม่ถูกต้อง');
      return;
    }
    
    setErrorMsg('');
    setLoading(true);
    
    const res = await forgotPassword(email.trim().toLowerCase());
    setLoading(false);
    
    if (res.success) {
      setSuccess(true);
    } else {
      setErrorMsg(res.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-10 px-4">
      <div className="w-full max-w-md bg-surface border border-line-soft rounded-[2rem] p-8 shadow-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-ink mb-2">ลืมรหัสผ่าน?</h1>
          <p className="text-sm text-muted">
            กรอกอีเมลที่คุณใช้สมัครบัญชี เราจะส่งลิงก์สำหรับรีเซ็ตรหัสผ่านไปให้คุณ
          </p>
        </div>

        {success ? (
          <div className="text-center py-4">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <p className="text-ink font-bold mb-6">
              หากอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่แล้ว กรุณาตรวจสอบกล่องจดหมายของคุณ (อาจอยู่ในโฟลเดอร์ Junk/Spam)
            </p>
            <Link
              to="/login"
              className="inline-block w-full bg-brand hover:bg-brand-hover text-white rounded-xl px-4 py-3 font-bold transition-colors"
            >
              กลับไปหน้าเข้าสู่ระบบ
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-black/5 dark:bg-white/5 border border-line-soft text-ink rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand placeholder-muted transition-all"
                  required
                />
              </div>
            </div>

            {errorMsg && (
              <p className="text-sm font-bold text-status-error bg-status-error/10 px-3 py-2 rounded-lg">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-hover text-white rounded-xl px-4 py-3 font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : 'ส่งลิงก์รีเซ็ตรหัสผ่าน'}
            </button>

            <div className="text-center mt-6">
              <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-bold text-brand hover:text-brand-hover hover:underline transition-colors">
                <ArrowLeft size={16} /> กลับไปหน้าเข้าสู่ระบบ
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
