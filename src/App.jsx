import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import FeedProvider from './context/FeedProvider';
import { UserProvider } from './context/UserContext'; // 1. นำเข้า UserProvider
import HomeFeed from './pages/HomeFeed';
import Discover from './pages/Discover';
import CategoryPage from './pages/CategoryPage';
import TemplateDetailPage from './pages/TemplateDetailPage';
import PostDetail from './pages/PostDetail';
import Create from './pages/Create';
import RankTierList from './pages/RankTierList';
import Profile from './pages/Profile'; 
import Login from './pages/Login'; // 2. นำเข้าหน้า Login

function App() {
  return (
    <Router>
      <UserProvider> {/* 3. ครอบด้วย UserProvider เพื่อให้ทุกหน้าเรียกใช้สถานะล็อกอินได้ */}
        <FeedProvider>
          <Navbar />

          <Routes>
            <Route path="/" element={<HomeFeed />} />
            <Route path="/create" element={<Create />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/rank" element={<RankTierList />} />
            <Route path="/category/:categoryId" element={<CategoryPage />} />
            <Route path="/template/:templateId" element={<TemplateDetailPage />} />
            <Route path="/post/:postId" element={<PostDetail />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/login" element={<Login />} /> {/* 4. เพิ่มเส้นทางไปหน้า Login */}
          </Routes>
        </FeedProvider>
      </UserProvider>
    </Router>
  );
}

export default App;