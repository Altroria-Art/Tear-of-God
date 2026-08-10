import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/layout/Navbar'
import HomeFeed from './pages/HomeFeed'
import Discover from './pages/Discover'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-canvas">
        <Navbar />
        <Routes>
          <Route path="/" element={<HomeFeed />} />
          <Route path="/discover" element={<Discover />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
