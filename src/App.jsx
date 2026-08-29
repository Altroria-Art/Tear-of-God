import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import ToastProvider from './components/ui/Toast';
import FeedProvider from './context/FeedProvider';
import { UserProvider } from './context/UserContext';
import { ThemeProvider } from './context/ThemeContext'; // Import ThemeProvider
import HomeFeed from './pages/HomeFeed';
import Discover from './pages/Discover';
import PopularTemplates from './pages/PopularTemplates';
import PopularHashtags from './pages/PopularHashtags';
import HashtagDetail from './pages/HashtagDetail';
import CategoryPage from './pages/CategoryPage';
import TemplateDetailPage from './pages/TemplateDetailPage';
import PostDetail from './pages/PostDetail';
import Create from './pages/Create';
import RankTierList from './pages/RankTierList';
import Profile from './pages/Profile'; 
import Login from './pages/Login';

function App() {
  return (
    <Router>
      <ToastProvider>
        <ThemeProvider> {/* Wrap with ThemeProvider */}
          <UserProvider>
          <FeedProvider>
            <Navbar />

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
              <Route path="/post/:postId" element={<PostDetail />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/:userId" element={<Profile />} /> {/* 📍 ดูโปรไฟล์ของคนอื่น */}
              <Route path="/login" element={<Login />} /> {/* 4. เพิ่มเส้นทางไปหน้า Login */}
            </Routes>
          </FeedProvider>
          </UserProvider>
        </ThemeProvider>
      </ToastProvider>
    </Router>
  );
}

export default App;


