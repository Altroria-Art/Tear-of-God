import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import HomeFeed from './pages/HomeFeed';
import Discover from './pages/Discover';
import Create from './pages/Create'; 
import RankTierList from './pages/RankTierList';
function App() {
  return (
    <Router>
      <Navbar /> 

      <Routes>
        <Route path="/" element={<HomeFeed />} />
        <Route path="/create" element={<Create />} />
        <Route path="/discover" element={<Discover />} />
        
        {/* 2. เพิ่ม Route หน้านี้เข้าไป */}
        <Route path="/rank" element={<RankTierList />} />
      </Routes>
    </Router>
  );
}

export default App;