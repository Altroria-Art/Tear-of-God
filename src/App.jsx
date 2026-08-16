import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import FeedProvider from './context/FeedProvider';
import HomeFeed from './pages/HomeFeed';
import Discover from './pages/Discover';
import CategoryPage from './pages/CategoryPage';
import TemplateDetailPage from './pages/TemplateDetailPage';
import PostDetail from './pages/PostDetail';
import Create from './pages/Create';
import RankTierList from './pages/RankTierList';
import Profile from './pages/Profile'; 

function App() {
  return (
    <Router>
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
        </Routes>
      </FeedProvider>
    </Router>
  );
}

export default App;