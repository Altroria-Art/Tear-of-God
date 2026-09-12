import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { resetPassword } from '../lib/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setErrorMsg('ลิงก์ไม่ถูกต้อง หรืออาจหมดอายุแล้ว');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setErrorMsg('ลิงก์ไม่ถูกต้อง หรืออาจหมดอายุแล้ว');
      return;
    }
    if (password.length < 8 || password.length > 256) {
      setErrorMsg('รหัสผ่านต้องมี 8–256 ตัวอักษร');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('รหัสผ่านไม่ตรงกัน');
      return;
    }
    
    setErrorMsg('');
    setLoading(true);
    
    const res = await resetPassword({ token, password });
    setLoading(false);
    
    if (res.success) {
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } else {
      setErrorMsg(res.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-10 px-4">
      <div className="w-full max-w-md bg-surface border border-line-soft rounded-[2rem] p-8 shadow-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-ink mb-2">ตั้งรหัสผ่านใหม่</h1>
          <p className="text-sm text-muted">
            {success ? 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว' : 'กรุณากรอกรหัสผ่านใหม่ที่คุณต้องการใช้งาน'}
          </p>
        </div>

        {success ? (
          <div className="text-center py-4">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <p className="text-ink font-bold mb-6">
              ระบบเปลี่ยนรหัสผ่านให้คุณเรียบร้อยแล้ว กำลังพาไปยังหน้าเข้าสู่ระบบ...
            </p>
            <Link
              to="/login"
              className="inline-block w-full bg-brand hover:bg-brand-hover text-white rounded-xl px-4 py-3 font-bold transition-colors"
            >
              ไปหน้าเข้าสู่ระบบทันที
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="รหัสผ่านใหม่ (8 ตัวอักษรขึ้นไป)"
                  className="w-full bg-black/5 dark:bg-white/5 border border-line-soft text-ink rounded-xl pl-10 pr-12 py-3 text-sm outline-none focus:ring-2 focus:ring-brand placeholder-muted transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="ยืนยันรหัสผ่านใหม่"
                  className="w-full bg-black/5 dark:bg-white/5 border border-line-soft text-ink rounded-xl pl-10 pr-12 py-3 text-sm outline-none focus:ring-2 focus:ring-brand placeholder-muted transition-all"
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
              disabled={loading || !token}
              className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-hover text-white rounded-xl px-4 py-3 font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : 'ยืนยันรหัสผ่านใหม่'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
