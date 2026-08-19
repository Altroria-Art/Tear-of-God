import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { registerUser, loginUser, syncGoogleUser } from '../lib/api'; 
import { signInWithGoogle } from '../lib/firebase';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useUser();
  
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      alert('กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน');
      return;
    }

    setIsLoading(true);

    if (isRegister) {
      const { data, error } = await registerUser({ email, password, username });
      setIsLoading(false);

      if (error) {
        alert('สมัครสมาชิกไม่สำเร็จ: ' + error);
      } else {
        alert('สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ');
        setIsRegister(false);
      }
    } else {
      const { data, error } = await loginUser({ email, password });
      setIsLoading(false);

      if (error) {
        alert('เข้าสู่ระบบไม่สำเร็จ: ' + error);
      } else {
        login(data);
        alert('เข้าสู่ระบบสำเร็จ!');
        navigate('/');
      }
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    // 1. ล็อกอินผ่าน Firebase
    const { data: firebaseUser, error } = await signInWithGoogle();

    if (error) {
      setIsLoading(false);
      alert('เข้าสู่ระบบด้วย Google ไม่สำเร็จ: ' + error);
    } else {
      // 2. ส่งข้อมูล Firebase ไปบันทึกลง Cloudflare D1
      const { data: dbUser, error: syncError } = await syncGoogleUser(firebaseUser);
      setIsLoading(false);

      if (syncError) {
        alert('เกิดข้อผิดพลาดในการซิงค์ฐานข้อมูล: ' + syncError);
      } else {
        // 3. บันทึกเข้าระบบหน้าเว็บ (Context)
        login(dbUser || firebaseUser);
        alert(`ยินดีต้อนรับคุณ ${dbUser?.username || firebaseUser.username} เข้าสู่ระบบ!`);
        navigate('/');
      }
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center px-4 py-8 font-sans text-gray-800">
      
      {/* Main Form Container */}
      <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-sm border border-[#eee8df] text-center">
        
        <h1 className="text-3xl font-extrabold text-[#2d241e] mb-2">
          {isRegister ? 'Create an Account' : 'Join the Council'}
        </h1>
        <p className="text-sm text-gray-500 mb-8 leading-relaxed">
          Rank everything. Defend your picks.<br />Argue in the comments.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {isRegister && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">Username</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your display name" 
                className="w-full bg-[#faf8f5] border border-[#e8dfd3] rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-[#8B6F4E]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com" 
              className="w-full bg-[#faf8f5] border border-[#e8dfd3] rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-[#8B6F4E]"
              required
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-600">Password</label>
              {!isRegister && (
                <a href="#" className="text-xs text-gray-400 hover:underline">Forgot password?</a>
              )}
            </div>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" 
              className="w-full bg-[#faf8f5] border border-[#e8dfd3] rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-[#8B6F4E]"
              required
            />
          </div>

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#facc15] hover:bg-[#eab308] text-gray-900 font-bold py-3 rounded-xl transition-colors shadow-sm mt-2 disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : (isRegister ? 'Sign Up' : 'Log In')}
          </button>
        </form>

        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-gray-200"></div>
          <span className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-widest">or</span>
          <div className="flex-1 border-t border-gray-200"></div>
        </div>

        {/* Google Sign In Button */}
        <button 
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-3 transition-colors shadow-sm disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          Continue with Google
        </button>

        <p className="mt-6 text-sm text-gray-500">
          {isRegister ? 'Already have an account?' : 'New to Tear of God?'}{' '}
          <button 
            type="button"
            onClick={() => setIsRegister(!isRegister)} 
            className="font-bold text-[#8B6F4E] hover:underline ml-1"
          >
            {isRegister ? 'Log in' : 'Create an account'}
          </button>
        </p>

      </div>
    </div>
  );
}