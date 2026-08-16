import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import HomeFeed from './pages/HomeFeed';
import Discover from './pages/Discover';
import CategoryPage from './pages/CategoryPage';
import TemplateDetailPage from './pages/TemplateDetailPage';
import Create from './pages/Create'; 
import RankTierList from './pages/RankTierList';
import Profile from './pages/Profile'; 

function App() {
  return (
    <Router>
      <Navbar /> 

      <Routes>
        <Route path="/" element={<HomeFeed />} />
        <Route path="/create" element={<Create />} />
        <Route path="/discover" element={<Discover />} />

        <Route path="/rank" element={<RankTierList />} />
        
        <Route path="/category/:categoryId" element={<CategoryPage />} />
        <Route path="/template/:templateId" element={<TemplateDetailPage />} />
        
        {/* 2. เพิ่ม Route สำหรับหน้า Profile */}
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </Router>
  );
}

export default App;