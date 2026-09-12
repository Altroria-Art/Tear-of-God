import { returnPath } from '../lib/navigation';
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { registerUser, loginUser, syncGoogleUser, fetchTemplates, fetchRankings } from '../lib/api';
import { signInWithGoogle } from '../lib/firebase';
import { useToast } from '../components/ui/Toast';
import { useTranslation } from 'react-i18next';
import TierLabel from '../components/tier/TierLabel';
import { formatCount } from '../lib/format';

// ข้อมูลจริงจากฐานข้อมูล D1 (ใช้เป็นค่าเริ่มต้นและ fallback)
const REAL_DEFAULT_TEMPLATES = [
  {
    id: 'tmpl_053',
    title: 'เมนูอาหารไทยประจำภาค',
    category: 'food',
    hashtags: '#Food,#Thai',
    use_count: 4700,
    tiers: [
      { label: 'S', color: 'bg-[#ff7f7f]' },
      { label: 'A', color: 'bg-[#ffbf7f]' },
      { label: 'B', color: 'bg-[#ffff7f]' }
    ],
    template_items: [
      { tier: 'S', item_id: 'ต้มยำกุ้ง', item: { name: 'ต้มยำกุ้ง' } },
      { tier: 'S', item_id: 'แกงเขียวหวาน', item: { name: 'แกงเขียวหวาน' } },
      { tier: 'A', item_id: 'แกงมัสมั่น', item: { name: 'แกงมัสมั่น' } },
      { tier: 'A', item_id: 'ลาบหมู', item: { name: 'ลาบหมู' } },
      { tier: 'B', item_id: 'หมูกระทะ', item: { name: 'หมูกระทะ' } }
    ]
  },
  {
    id: 'tmpl_001',
    title: 'Top Shonen Anime',
    category: 'anime',
    hashtags: '#Anime',
    use_count: 12000,
    tiers: [
      { label: 'S', color: 'bg-[#ff7f7f]' },
      { label: 'A', color: 'bg-[#ffbf7f]' },
      { label: 'B', color: 'bg-[#ffff7f]' }
    ],
    template_items: [
      { tier: 'S', item_id: 'One Piece', item: { name: 'One Piece' } },
      { tier: 'S', item_id: 'Naruto', item: { name: 'Naruto' } },
      { tier: 'A', item_id: 'Attack on Titan', item: { name: 'Attack on Titan' } },
      { tier: 'A', item_id: 'Demon Slayer', item: { name: 'Demon Slayer' } }
    ]
  },
  {
    id: 'tmpl_057',
    title: 'นักบาสเกตบอล NBA ที่เก่งที่สุด',
    category: 'sports',
    hashtags: '#Sports',
    use_count: 13500,
    tiers: [
      { label: 'S', color: 'bg-[#ff7f7f]' },
      { label: 'A', color: 'bg-[#ffbf7f]' }
    ],
    template_items: [
      { tier: 'S', item_id: 'Michael Jordan', item: { name: 'Michael Jordan' } },
      { tier: 'S', item_id: 'LeBron James', item: { name: 'LeBron James' } }
    ]
  }
];

const REAL_DEFAULT_RANKINGS = [
  { id: 'rank_001', title: 'จัดอันดับอนิเมะในดวงใจ ปี 2026', category: 'anime', hashtags: '#Anime,#2026' },
  { id: 'rank_002', title: 'Tier List สุดยอดเกม RPG ในตำนาน', category: 'gaming', hashtags: '#Gaming,#OpenWorld' },
  { id: 'rank_003', title: 'จัดอันดับภาษายอดฮิตสาย Tech', category: 'tech', hashtags: '#Tech,#Programming' },
  { id: 'rank_004', title: 'หนังไซไฟในดวงใจตลอดกาล', category: 'movie', hashtags: '#Movie,#MindBender' },
  { id: 'tmpl_054', title: 'เพลงป๊อปเกาหลี K-Pop มาแรง', category: 'music', hashtags: '#Music,#Pop' },
  { id: 'tmpl_058', title: 'นักเตะตำนานพรีเมียร์ลีก', category: 'sports', hashtags: '#Sports,#PremierLeague' }
];

// คำศัพท์สลับเปลี่ยนไปเรื่อยๆ สำหรับไฮไลต์หัวเรื่อง
const ROTATING_WORDS = {
  th: ['จัดเทียร์', 'จัดอันดับ', 'โหวต', 'ดีเบต', 'ตัดสิน', 'ยกมง'],
  en: ['Rank', 'Rate', 'Judge', 'Crown', 'Debate', 'Tier']
};

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const next = returnPath(location.search);
  const { login } = useUser();
  const { isLightMode } = useTheme();
  const toast = useToast();
  const { t, i18n } = useTranslation();

  const lang = i18n.language?.startsWith('th') ? 'th' : 'en';
  const localizedWords = t('auth.heroRotatingWords', { returnObjects: true });
  const words = Array.isArray(localizedWords) && localizedWords.length > 0
    ? localizedWords
    : (ROTATING_WORDS[lang] || ROTATING_WORDS.en);

  const [wordIndex, setWordIndex] = useState(0);
  const [animClass, setAnimClass] = useState('translate-y-0 opacity-100 scale-100');

  // สลับคำศัพท์ทุกๆ 2.6 วินาที ด้วยอนิเมชันเลื่อนขึ้นแบบ Slot Ticker
  useEffect(() => {
    let step2Timer;
    let step3Timer;

    const timer = setInterval(() => {
      // 1. เลื่อนขึ้นและจางหาย (Exit)
      setAnimClass('-translate-y-4 opacity-0 scale-95 transition-all duration-200 ease-in');

      // 2. สลับคำและย้ายไปรอข้างล่าง (Instant reset below)
      step2Timer = setTimeout(() => {
        setWordIndex((prev) => (prev + 1) % words.length);
        setAnimClass('translate-y-4 opacity-0 scale-95 transition-none');

        // 3. เลื่อนขึ้นมาจากด้านล่างสู่ตำแหน่งปกติ (Enter smoothly)
        step3Timer = setTimeout(() => {
          setAnimClass('translate-y-0 opacity-100 scale-100 transition-all duration-300 ease-out');
        }, 35);
      }, 200);
    }, 2600);

    return () => {
      clearInterval(timer);
      clearTimeout(step2Timer);
      clearTimeout(step3Timer);
    };
  }, [words.length]);

  // เมื่อเปลี่ยนภาษา รีเซ็ตกลับไปคำแรก
  useEffect(() => {
    setWordIndex(0);
    setAnimClass('translate-y-0 opacity-100 scale-100');
  }, [lang]);

  const [realTemplates, setRealTemplates] = useState(REAL_DEFAULT_TEMPLATES);
  const [realRankings, setRealRankings] = useState(REAL_DEFAULT_RANKINGS);

  // ดึงข้อมูลจริงจากเซิร์ฟเวอร์แบบ Real-time
  useEffect(() => {
    let mounted = true;
    Promise.allSettled([
      fetchTemplates({ limit: 6, sort: 'popular' }),
      fetchRankings({ limit: 6, sort: 'top' })
    ]).then(([tplRes, rankRes]) => {
      if (!mounted) return;
      if (tplRes.status === 'fulfilled' && tplRes.value?.data?.length > 0) {
        setRealTemplates(tplRes.value.data);
      }
      if (rankRes.status === 'fulfilled' && rankRes.value?.data?.length > 0) {
        setRealRankings(rankRes.value.data);
      }
    });
    return () => { mounted = false; };
  }, []);

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Refs และ State คำนวณความสูงของ Panel สำหรับอนิเมชันเลื่อนแบบ Carousel
  const loginRef = useRef(null);
  const registerRef = useRef(null);
  const [formHeight, setFormHeight] = useState('auto');

  useEffect(() => {
    const updateHeight = () => {
      const activeEl = isRegister ? registerRef.current : loginRef.current;
      if (activeEl) {
        setFormHeight(`${activeEl.scrollHeight}px`);
      }
    };
    updateHeight();
    const timer = setTimeout(updateHeight, 40);
    window.addEventListener('resize', updateHeight);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateHeight);
    };
  }, [isRegister]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.warning(t('auth.warnFillAll'));
      return;
    }
    if (isRegister && password !== confirmPassword) {
      toast.warning(t('auth.warnPasswordMismatch'));
      return;
    }
    if (isRegister && !username.trim()) {
      toast.warning(t('auth.warnFillAll'));
      return;
    }

    setIsLoading(true);

    if (isRegister) {
      const { error } = await registerUser({ email, password, username });
      setIsLoading(false);

      if (error) {
        toast.error(t('auth.errRegisterFailed', { msg: error }));
      } else {
        toast.success(t('auth.successRegister'));
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setUsername('');
        setIsRegister(false);
      }
    } else {
      const { data, error } = await loginUser({ email, password });
      setIsLoading(false);

      if (error) {
        toast.error(t('auth.errLoginFailed', { msg: error }));
      } else {
        login(data);
        toast.success(t('auth.successLogin'));
        navigate(next, { replace: true });
      }
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const { data: firebaseUser, error } = await signInWithGoogle();
      if (error) {
        toast.error(t('auth.errGoogleFailed', { msg: error }));
        return;
      }
      const { data: dbUser, error: syncError } = await syncGoogleUser(firebaseUser);
      if (syncError) {
        toast.error(t('auth.errSyncFailed', { msg: syncError }));
        return;
      }
      login(dbUser);
      toast.success(t('auth.successWelcome', { name: dbUser?.username || firebaseUser.username }));
      navigate(next, { replace: true });
    } catch (err) {
      toast.error(t('auth.errGoogleFailed', { msg: err.message }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-68px)] w-full relative overflow-hidden flex items-center justify-center px-4 sm:px-6 lg:px-12 py-8 lg:py-16">
      {/* ========================================================
          Atmospheric Glow Layers (ตามรูปต้นฉบับ Light & Dark)
         ======================================================== */}
      {/* Top-Left Warm Blush Glow (Dual GPU Cross-Fade Layer: Butter-smooth 0ms lag) */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -top-28 -left-28 w-[420px] h-[420px] sm:w-[600px] sm:h-[600px] rounded-full blur-[90px] transition-opacity duration-300 ease-out will-change-[opacity] ${
          isLightMode ? 'opacity-80' : 'opacity-0'
        }`}
        style={{
          background: 'radial-gradient(circle, rgba(255, 145, 115, 0.48) 0%, rgba(255, 180, 150, 0.15) 70%, transparent 100%)',
        }}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -top-28 -left-28 w-[420px] h-[420px] sm:w-[600px] sm:h-[600px] rounded-full blur-[90px] transition-opacity duration-300 ease-out will-change-[opacity] ${
          isLightMode ? 'opacity-0' : 'opacity-35'
        }`}
        style={{
          background: 'radial-gradient(circle, rgba(220, 60, 25, 0.42) 0%, rgba(180, 40, 15, 0.12) 70%, transparent 100%)',
        }}
      />

      {/* Bottom-Right Warm Apricot Glow (Dual GPU Cross-Fade Layer: Butter-smooth 0ms lag) */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -bottom-32 -right-32 w-[420px] h-[420px] sm:w-[580px] sm:h-[580px] rounded-full blur-[90px] transition-opacity duration-300 ease-out will-change-[opacity] ${
          isLightMode ? 'opacity-75' : 'opacity-0'
        }`}
        style={{
          background: 'radial-gradient(circle, rgba(255, 195, 135, 0.45) 0%, rgba(255, 220, 180, 0.15) 70%, transparent 100%)',
        }}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -bottom-32 -right-32 w-[420px] h-[420px] sm:w-[580px] sm:h-[580px] rounded-full blur-[90px] transition-opacity duration-300 ease-out will-change-[opacity] ${
          isLightMode ? 'opacity-0' : 'opacity-30'
        }`}
        style={{
          background: 'radial-gradient(circle, rgba(190, 100, 30, 0.35) 0%, rgba(140, 65, 15, 0.1) 70%, transparent 100%)',
        }}
      />

      {/* ========================================================
          Main Content: 2-Column Split Grid
         ======================================================== */}
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center relative z-10">
        
        {/* ========================================================
            Left Column: Brand & Hero Catchphrase + Real Tier List Boxes
           ======================================================== */}
        <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 flex-col justify-center text-left">
          {/* Brand Pill */}
          <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[#ff553e]/10 border border-[#ff553e]/20 text-[#ff553e] dark:bg-[#ff553e]/20 dark:border-[#ff553e]/30 w-fit mb-6 shadow-xs">
            <span className="w-6 h-6 rounded-lg bg-[#ff553e] text-white flex items-center justify-center text-xs font-black shadow-xs">
              T
            </span>
            <span className="text-sm font-extrabold tracking-wide">Tear of God</span>
          </div>

          {/* Headline with Highlighted Pill */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-4">
            <span className="text-3xl sm:text-4xl lg:text-[44px] font-black text-ink tracking-tight">
              {t('auth.heroTitle1')}
            </span>
            <span className="relative inline-flex items-center justify-center text-3xl sm:text-4xl lg:text-[44px] font-black px-4 py-1.5 rounded-2xl bg-[#ffece2] text-[#ff553e] dark:bg-[#331c13] dark:text-[#ff7663] border border-[#ff553e]/25 shadow-xs overflow-hidden select-none transition-all duration-300 min-h-[1.25em]">
              <span className={`inline-block transform will-change-transform ${animClass}`}>
                {words[wordIndex % words.length]}
              </span>
            </span>
            <span className="text-3xl sm:text-4xl lg:text-[44px] font-black text-ink tracking-tight">
              {t('auth.heroTitle2')}
            </span>
          </div>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-ink-soft max-w-lg mb-6 leading-relaxed font-normal">
            {t('auth.heroSubtitle')}
          </p>

          {/* ========================================================
              Real Dynamic Floating Tier List Boxes & Community Badges
             ======================================================== */}
          {(() => {
            const primaryTemplate = realTemplates[0] || REAL_DEFAULT_TEMPLATES[0];
            const secondaryTemplate = realTemplates[1] || REAL_DEFAULT_TEMPLATES[1];
            const thirdTemplate = realTemplates[2] || REAL_DEFAULT_TEMPLATES[2];

            const parseTiersList = (t) => {
              if (Array.isArray(t?.tiers)) return t.tiers;
              if (typeof t?.tiers === 'string') {
                try { return JSON.parse(t.tiers); } catch { return []; }
              }
              return [];
            };

            const primaryTiers = parseTiersList(primaryTemplate).slice(0, 3);

            const primaryTiersMap = {};
            primaryTemplate.template_items?.forEach((ti) => {
              if (!ti.tier) return;
              if (!primaryTiersMap[ti.tier]) primaryTiersMap[ti.tier] = [];
              primaryTiersMap[ti.tier].push(ti.item?.name || ti.item_id);
            });

            const secondarySTierItems = [];
            secondaryTemplate.template_items?.forEach((ti) => {
              if (ti.tier === 'S') secondarySTierItems.push(ti.item?.name || ti.item_id);
            });
            const topSNames = secondarySTierItems.length > 0 ? secondarySTierItems.slice(0, 2).join(' & ') : (secondaryTemplate.template_items?.[0]?.item_id || 'Top Item');

            return (
              <div className="space-y-3.5 max-w-xl">
                {/* Row of Floating Badges (Batch 1: Real Rankings from DB) */}
                <div className="flex flex-wrap gap-2.5 items-center">
                  {realRankings[0] && (
                    <div className="animate-float-1 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-surface/85 hover:bg-surface backdrop-blur-md border border-line-soft shadow-xs hover:scale-105 transition-transform cursor-default select-none">
                      <span className="text-sm">🔥</span>
                      <span className="text-xs font-bold text-ink truncate max-w-[220px]">
                        {realRankings[0].title}
                      </span>
                    </div>
                  )}

                  {realRankings[1] && (
                    <div className="animate-float-2 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-surface/85 hover:bg-surface backdrop-blur-md border border-line-soft shadow-xs hover:scale-105 transition-transform cursor-default select-none">
                      <span className="text-sm">🎮</span>
                      <span className="text-xs font-bold text-[#ff553e] truncate max-w-[220px]">
                        {realRankings[1].title}
                      </span>
                    </div>
                  )}

                  {realRankings[2] && (
                    <div className="animate-float-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-surface/85 hover:bg-surface backdrop-blur-md border border-line-soft shadow-xs hover:scale-105 transition-transform cursor-default select-none">
                      <span className="text-sm">💻</span>
                      <span className="text-xs font-bold text-ink truncate max-w-[220px]">
                        {realRankings[2].title}
                      </span>
                    </div>
                  )}
                </div>

                {/* Real Tier List Preview Boxes (From DB Templates & Items) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  {/* Floating Box 1: Real Template (e.g. เมนูอาหารไทยประจำภาค) */}
                  <div className="animate-float-slow rounded-3xl bg-surface/85 hover:bg-surface dark:bg-[#151622]/90 backdrop-blur-xl border border-line-soft/80 p-3.5 shadow-lg shadow-black/5 dark:shadow-black/40 select-none hover:scale-[1.02] transition-all duration-300">
                    <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-line-soft/60">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm">🏆</span>
                        <span className="text-[11px] font-black text-ink truncate">
                          {primaryTemplate.title}
                        </span>
                      </div>
                      <span className="text-[9px] font-extrabold text-[#ff553e] bg-[#ff553e]/10 dark:bg-[#ff553e]/20 px-2 py-0.5 rounded-full shrink-0">
                        {primaryTemplate.hashtags?.split(',')[0] || `#${primaryTemplate.category || 'Template'}`}
                      </span>
                    </div>

                    {/* Real Tier Rows with Real Item Names */}
                    <div className="space-y-1.5 text-[11px]">
                      {primaryTiers.map((tier, idx) => {
                        const items = primaryTiersMap[tier.label] || [];
                        return (
                          <div key={tier.id ?? tier.label ?? idx} className="flex items-center gap-2 bg-black/[0.02] dark:bg-white/[0.02] rounded-xl p-1 border border-line-soft/30">
                            <TierLabel
                              label={tier.label}
                              color={tier.color}
                              className="w-6 h-5 rounded font-black text-[10px] shadow-xs"
                            />
                            <div className="flex items-center gap-1.5 overflow-hidden flex-1">
                              {items.length > 0 ? (
                                items.slice(0, 2).map((itemName, iIdx) => (
                                  <span
                                    key={iIdx}
                                    className="px-2 py-0.5 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] text-ink font-bold text-[10px] border border-line-soft/60 truncate max-w-[85px]"
                                  >
                                    {itemName}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[9px] text-muted italic">ไม่มีไอเทม</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Footer Stats from Database */}
                    <div className="mt-2.5 pt-1.5 border-t border-line-soft/60 flex items-center justify-between text-[10px] text-muted">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                        <span>{formatCount(primaryTemplate.use_count)} คนจัดแล้ว</span>
                      </span>
                      <span className="text-[#ff553e] font-extrabold">Template จริง</span>
                    </div>
                  </div>

                  {/* Floating Box 2: Real Shonen / Sports Template Highlight & Live Activity */}
                  <div className="flex flex-col gap-2.5 justify-between">
                    {/* Real Template 2 Highlight */}
                    <div className="animate-float-4 rounded-3xl bg-surface/85 hover:bg-surface dark:bg-[#151622]/90 backdrop-blur-xl border border-line-soft/80 p-3.5 shadow-lg shadow-black/5 dark:shadow-black/40 select-none hover:scale-[1.02] transition-all duration-300">
                      <div className="flex items-center justify-between gap-1.5 mb-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm">⭐</span>
                          <span className="text-[11px] font-black text-ink truncate">
                            {secondaryTemplate.title}
                          </span>
                        </div>
                        <span className="text-[9px] font-extrabold text-purple-500 bg-purple-500/10 px-1.5 py-0.5 rounded-md shrink-0">
                          {formatCount(secondaryTemplate.use_count)} ใช้
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 bg-black/[0.02] dark:bg-white/[0.02] rounded-2xl p-2 border border-line-soft/30">
                        <TierLabel
                          label="S"
                          color="bg-[#ff7f7f]"
                          className="w-8 h-8 rounded-xl font-black text-xs shadow-xs shrink-0"
                        />
                        <div className="text-left overflow-hidden">
                          <div className="text-xs font-black text-ink truncate">{topSNames}</div>
                          <div className="text-[10px] text-muted truncate">Top S-Tier ในคอมมูนิตี้</div>
                        </div>
                      </div>
                    </div>

                    {/* Live Community Activity Box */}
                    <div className="animate-float-2 rounded-2xl bg-surface/85 hover:bg-surface backdrop-blur-md border border-line-soft/80 p-2.5 shadow-xs flex items-center gap-2.5 select-none hover:scale-105 transition-transform">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0 ml-1" />
                      <div className="text-left overflow-hidden">
                        <div className="text-[11px] font-bold text-ink truncate">{realRankings[0]?.title || 'จัดอันดับอนิเมะในดวงใจ ปี 2026'}</div>
                        <div className="text-[9px] text-muted">อันดับล่าสุดที่เพิ่งสร้างในระบบ</div>
                      </div>
                      <span className="ml-auto text-xs shrink-0">✨</span>
                    </div>
                  </div>
                </div>

                {/* Row of Floating Badges (Batch 2: More Real Rankings & Templates) */}
                <div className="flex flex-wrap gap-2.5 items-center pt-1">
                  {realRankings[3] && (
                    <div className="animate-float-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-surface/85 hover:bg-surface backdrop-blur-md border border-line-soft shadow-xs hover:scale-105 transition-transform cursor-default select-none">
                      <span className="text-sm">🎬</span>
                      <span className="text-xs font-bold text-ink truncate max-w-[220px]">
                        {realRankings[3].title}
                      </span>
                    </div>
                  )}

                  {thirdTemplate && (
                    <div className="animate-float-1 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-surface/85 hover:bg-surface backdrop-blur-md border border-line-soft shadow-xs hover:scale-105 transition-transform cursor-default select-none">
                      <span className="text-sm">🏀</span>
                      <span className="text-xs font-bold text-ink truncate max-w-[220px]">
                        {thirdTemplate.title}
                      </span>
                    </div>
                  )}

                  {realRankings[4] && (
                    <div className="animate-float-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-surface/85 hover:bg-surface backdrop-blur-md border border-line-soft shadow-xs hover:scale-105 transition-transform cursor-default select-none">
                      <span className="text-sm">🎵</span>
                      <span className="text-xs font-bold text-ink truncate max-w-[220px]">
                        {realRankings[4].title}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* ========================================================
            Right Column: Floating Auth Card
           ======================================================== */}
        <div className="lg:col-span-6 xl:col-span-5 w-full max-w-[440px] mx-auto lg:ml-auto">
          <div className="relative">
            {/* Top Floating Badge Tag */}
            <div className="absolute -top-3.5 left-7 sm:left-8 z-20">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-extrabold text-white bg-gradient-to-r from-[#ff553e] to-[#ff7a58] shadow-md shadow-orange-500/25 border border-white/30 tracking-wider uppercase transition-all duration-300 select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                {isRegister ? t('auth.badgeJoin') : t('auth.badgeWelcome')}
              </span>
            </div>

            {/* The Main Rounded Card */}
            <div className="bg-surface/90 dark:bg-[#14151c]/95 backdrop-blur-2xl border border-white/80 dark:border-white/10 rounded-[32px] p-7 sm:p-9 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.06)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] text-left transition-all duration-300">
              
              {/* Segmented Pill Switcher Tab */}
              <div className="relative p-1 mb-5 rounded-2xl bg-black/[0.035] dark:bg-white/[0.05] border border-black/[0.04] dark:border-white/[0.06] flex items-center">
                {/* Sliding Active Pill Indicator */}
                <div
                  className="absolute top-1 bottom-1 left-1 rounded-xl bg-surface dark:bg-[#22242f] shadow-[0_2px_10px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.5)] border border-black/[0.04] dark:border-white/[0.08] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none will-change-transform"
                  style={{
                    width: 'calc(50% - 4px)',
                    transform: isRegister ? 'translateX(calc(100% + 0px))' : 'translateX(0)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setIsRegister(false)}
                  className={`relative z-10 flex-1 py-2.5 text-center text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer active:scale-95 select-none ${
                    !isRegister ? 'text-ink font-black' : 'text-muted hover:text-ink'
                  }`}
                >
                  {t('auth.logIn')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsRegister(true)}
                  className={`relative z-10 flex-1 py-2.5 text-center text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer active:scale-95 select-none ${
                    isRegister ? 'text-ink font-black' : 'text-muted hover:text-ink'
                  }`}
                >
                  {t('auth.switchToSignup')}
                </button>
              </div>

              {/* Card Subtitle */}
              <div className="mb-5 -mt-1 text-left">
                <p className="text-xs sm:text-[13px] text-muted leading-relaxed font-normal transition-all duration-200">
                  {isRegister ? t('auth.quickTimeSubtitle') : t('auth.loginSubtitle')}
                </p>
              </div>

              {/* Sliding Forms Viewport with Smooth Height Transition */}
              <div
                className="relative overflow-hidden transition-[height] duration-350 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{ height: formHeight }}
              >
                <div
                  className="flex w-[200%] transition-transform duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] items-start"
                  style={{
                    transform: isRegister ? 'translateX(-50%)' : 'translateX(0%)',
                  }}
                >
                  {/* Panel 1: Log In (50% Width) */}
                  <div
                    ref={loginRef}
                    inert={isRegister}
                    className={`w-1/2 pr-3 transition-opacity duration-300 ease-out ${
                      !isRegister ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                    }`}
                  >
                    <form onSubmit={handleSubmit} noValidate className="space-y-4">
                      {/* Email */}
                      <div>
                        <label htmlFor="login-email" className="block text-[11px] font-bold text-ink-soft uppercase tracking-wider mb-1.5">
                          {t('auth.email')}
                        </label>
                        <div className="relative group">
                          <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-login-accent transition-colors pointer-events-none" />
                          <input
                            id="login-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={t('auth.emailPlaceholder')}
                            tabIndex={!isRegister ? 0 : -1}
                            className="w-full bg-black/[0.025] hover:bg-black/[0.04] dark:bg-white/[0.035] dark:hover:bg-white/[0.05] border border-line-soft hover:border-line-soft/80 text-ink rounded-2xl py-3 pl-10.5 pr-4 text-sm outline-none focus:bg-surface dark:focus:bg-login-surface focus:border-login-accent/80 focus:ring-4 focus:ring-login-accent/12 transition-all placeholder:text-muted/60"
                          />
                        </div>
                      </div>

                      {/* Password */}
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label htmlFor="login-password" className="block text-[11px] font-bold text-ink-soft uppercase tracking-wider">
                            {t('auth.password')}
                          </label>
                          <Link to="/forgot-password" className="text-[11px] font-bold text-login-accent hover:text-login-accent/80 hover:underline transition-colors" tabIndex={!isRegister ? 0 : -1}>
                            ลืมรหัสผ่าน?
                          </Link>
                        </div>
                        <div className="relative group">
                          <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-login-accent transition-colors pointer-events-none" />
                          <input
                            id="login-password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            tabIndex={!isRegister ? 0 : -1}
                            className="w-full bg-black/[0.025] hover:bg-black/[0.04] dark:bg-white/[0.035] dark:hover:bg-white/[0.05] border border-line-soft hover:border-line-soft/80 text-ink rounded-2xl py-3 pl-10.5 pr-11 text-sm outline-none focus:bg-surface dark:focus:bg-login-surface focus:border-login-accent/80 focus:ring-4 focus:ring-login-accent/12 transition-all placeholder:text-muted/60"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-muted hover:text-ink transition-colors cursor-pointer"
                            tabIndex={!isRegister ? 0 : -1}
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* Submit Action Button for Login */}
                      <button
                        type="submit"
                        disabled={isLoading}
                        tabIndex={!isRegister ? 0 : -1}
                        className="w-full py-3.5 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-login-accent via-login-accent-soft to-[#ff7845] hover:from-[#f0452e] hover:via-[#f05335] hover:to-[#f06935] shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/35 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200 cursor-pointer disabled:opacity-50 mt-2 border-t border-white/20 relative overflow-hidden group"
                      >
                        <span className="relative z-10 flex items-center justify-center gap-2">
                          {isLoading ? (
                            <>
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              <span>{t('auth.processing')}</span>
                            </>
                          ) : (
                            <span>{t('auth.logIn')}</span>
                          )}
                        </span>
                      </button>
                    </form>
                  </div>

                  {/* Panel 2: Create an account / Register (50% Width) */}
                  <div
                    ref={registerRef}
                    inert={!isRegister}
                    className={`w-1/2 pl-3 transition-opacity duration-300 ease-out ${
                      isRegister ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                    }`}
                  >
                    <form onSubmit={handleSubmit} noValidate className="space-y-4">
                      {/* Username */}
                      <div>
                        <label htmlFor="register-username" className="block text-[11px] font-bold text-ink-soft uppercase tracking-wider mb-1.5">
                          {t('auth.username')}
                        </label>
                        <div className="relative group">
                          <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-login-accent transition-colors pointer-events-none" />
                          <input
                            id="register-username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder={t('auth.usernamePlaceholder')}
                            tabIndex={isRegister ? 0 : -1}
                            className="w-full bg-black/[0.025] hover:bg-black/[0.04] dark:bg-white/[0.035] dark:hover:bg-white/[0.05] border border-line-soft hover:border-line-soft/80 text-ink rounded-2xl py-3 pl-10.5 pr-4 text-sm outline-none focus:bg-surface dark:focus:bg-login-surface focus:border-login-accent/80 focus:ring-4 focus:ring-login-accent/12 transition-all placeholder:text-muted/60"
                          />
                        </div>
                      </div>

                      {/* Email */}
                      <div>
                        <label htmlFor="register-email" className="block text-[11px] font-bold text-ink-soft uppercase tracking-wider mb-1.5">
                          {t('auth.email')}
                        </label>
                        <div className="relative group">
                          <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-login-accent transition-colors pointer-events-none" />
                          <input
                            id="register-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={t('auth.emailPlaceholder')}
                            tabIndex={isRegister ? 0 : -1}
                            className="w-full bg-black/[0.025] hover:bg-black/[0.04] dark:bg-white/[0.035] dark:hover:bg-white/[0.05] border border-line-soft hover:border-line-soft/80 text-ink rounded-2xl py-3 pl-10.5 pr-4 text-sm outline-none focus:bg-surface dark:focus:bg-login-surface focus:border-login-accent/80 focus:ring-4 focus:ring-login-accent/12 transition-all placeholder:text-muted/60"
                          />
                        </div>
                      </div>

                      {/* Password */}
                      <div>
                        <label htmlFor="register-password" className="block text-[11px] font-bold text-ink-soft uppercase tracking-wider mb-1.5">
                          {t('auth.password')}
                        </label>
                        <div className="relative group">
                          <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-login-accent transition-colors pointer-events-none" />
                          <input
                            id="register-password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            tabIndex={isRegister ? 0 : -1}
                            className="w-full bg-black/[0.025] hover:bg-black/[0.04] dark:bg-white/[0.035] dark:hover:bg-white/[0.05] border border-line-soft hover:border-line-soft/80 text-ink rounded-2xl py-3 pl-10.5 pr-11 text-sm outline-none focus:bg-surface dark:focus:bg-login-surface focus:border-login-accent/80 focus:ring-4 focus:ring-login-accent/12 transition-all placeholder:text-muted/60"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-muted hover:text-ink transition-colors cursor-pointer"
                            tabIndex={isRegister ? 0 : -1}
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* Confirm Password */}
                      <div>
                        <label htmlFor="register-confirm-password" className="block text-[11px] font-bold text-ink-soft uppercase tracking-wider mb-1.5">
                          {t('auth.confirmPassword')}
                        </label>
                        <div className="relative group">
                          <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-login-accent transition-colors pointer-events-none" />
                          <input
                            id="register-confirm-password"
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            tabIndex={isRegister ? 0 : -1}
                            className="w-full bg-black/[0.025] hover:bg-black/[0.04] dark:bg-white/[0.035] dark:hover:bg-white/[0.05] border border-line-soft hover:border-line-soft/80 text-ink rounded-2xl py-3 pl-10.5 pr-11 text-sm outline-none focus:bg-surface dark:focus:bg-login-surface focus:border-login-accent/80 focus:ring-4 focus:ring-login-accent/12 transition-all placeholder:text-muted/60"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-muted hover:text-ink transition-colors cursor-pointer"
                            tabIndex={isRegister ? 0 : -1}
                          >
                            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* Submit Action Button for Register */}
                      <button
                        type="submit"
                        disabled={isLoading}
                        tabIndex={isRegister ? 0 : -1}
                        className="w-full py-3.5 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-login-accent via-login-accent-soft to-[#ff7845] hover:from-[#f0452e] hover:via-[#f05335] hover:to-[#f06935] shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/35 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200 cursor-pointer disabled:opacity-50 mt-2 border-t border-white/20 relative overflow-hidden group"
                      >
                        <span className="relative z-10 flex items-center justify-center gap-2">
                          {isLoading ? (
                            <>
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              <span>{t('auth.processing')}</span>
                            </>
                          ) : (
                            <span>{t('auth.signUp')}</span>
                          )}
                        </span>
                      </button>
                    </form>
                  </div>
                </div>
              </div>

              {/* Or Divider */}
              <div className="flex items-center my-4.5">
                <div className="flex-1 border-t border-line-soft"></div>
                <span className="px-3 text-[11px] font-bold text-muted/60 uppercase tracking-widest">{t('auth.or')}</span>
                <div className="flex-1 border-t border-line-soft"></div>
              </div>

              {/* Google Sign In Button */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full py-3 rounded-2xl font-bold text-xs sm:text-sm bg-surface-glass hover:bg-surface border border-line-soft hover:border-line text-ink flex items-center justify-center gap-3 transition-all duration-200 shadow-xs hover:shadow-sm active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>{t('auth.continueGoogle')}</span>
              </button>

              {/* Bottom Toggle Link */}
              <div className="mt-5 text-center text-xs text-muted">
                <span>{isRegister ? t('auth.haveAccount') : t('auth.newHere')}</span>{' '}
                <button
                  type="button"
                  onClick={() => setIsRegister(!isRegister)}
                  className="font-bold text-[#ff553e] hover:text-[#ff7236] hover:underline ml-1 cursor-pointer transition-all active:scale-95 inline-flex items-center gap-0.5"
                >
                  <span>{isRegister ? t('auth.switchToLogin') : t('auth.switchToSignup')}</span>
                  <span className="text-[10px]">→</span>
                </button>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}









