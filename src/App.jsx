import { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { lazy } from 'react';
import { useTranslation } from 'react-i18next';
import Navbar from './components/layout/Navbar';
import ToastProvider from './components/ui/Toast';
import { UserProvider } from './context/UserContext';
import { ThemeProvider } from './context/ThemeContext';

// 📍 Lazy-load ตามหน้า (code-splitting) — แยก bundle ใหญ่ (หน้าแรกที่ใช้บ่อยโหลดก่อน,
// หน้าที่ไม่ใช่หน้าแรกค่อยโหลดเมื่อเข้า) ลดขนาด initial JS (ดู bundle warning จาก build)
const HomeFeed = lazy(() => import('./pages/HomeFeed'));
const Discover = lazy(() => import('./pages/Discover'));
const PopularTemplates = lazy(() => import('./pages/PopularTemplates'));
const PopularHashtags = lazy(() => import('./pages/PopularHashtags'));
const HashtagDetail = lazy(() => import('./pages/HashtagDetail'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const TemplateDetailPage = lazy(() => import('./pages/TemplateDetailPage'));
const CommunityAveragePage = lazy(() => import('./pages/CommunityAveragePage'));
const PostDetail = lazy(() => import('./pages/PostDetail'));
const Create = lazy(() => import('./pages/Create'));
const RankTierList = lazy(() => import('./pages/RankTierList'));
const Profile = lazy(() => import('./pages/Profile'));
const Login = lazy(() => import('./pages/Login'));

// admin ทั้งโฟลเดอร์ lazy เป็นชุดเดียว — แยก admin chunk ออกจาก user chunk หลัก
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminUsers = lazy(() => import('./pages/admin/Users'));
const AdminRankings = lazy(() => import('./pages/admin/Rankings'));
const AdminTemplates = lazy(() => import('./pages/admin/Templates'));
const AdminReports = lazy(() => import('./pages/admin/Reports'));

function PageLoader() {
  const { t } = useTranslation();
  return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="text-sm font-medium text-muted animate-pulse">{t('common.loading')}</p>
    </main>
  );
}

function App() {
  return (
    <Router>
      <ToastProvider>
        <ThemeProvider>
          <UserProvider>
            <Navbar />

            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<HomeFeed />} />
                <Route path="/create" element={<Create />} />
                <Route path="/discover" element={<Discover />} />
                <Route path="/discover/templates" element={<PopularTemplates />} />
                <Route path="/discover/hashtags" element={<PopularHashtags />} />
                <Route path="/discover/hashtag/:tag" element={<HashtagDetail />} />
                <Route path="/rank" element={<RankTierList />} />
                <Route path="/category/:categoryId" element={<CategoryPage />} />
                <Route path="/template/:templateId" element={<TemplateDetailPage />} />
                <Route path="/template/:templateId/community" element={<CommunityAveragePage />} />
                <Route path="/post/:postId" element={<PostDetail />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/profile/:userId" element={<Profile />} />
                <Route path="/login" element={<Login />} />
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="rankings" element={<AdminRankings />} />
                  <Route path="templates" element={<AdminTemplates />} />
                  <Route path="reports" element={<AdminReports />} />
                </Route>
              </Routes>
            </Suspense>
          </UserProvider>
        </ThemeProvider>
      </ToastProvider>
    </Router>
  );
}

export default App;
