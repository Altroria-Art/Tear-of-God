import Navbar from './components/layout/Navbar'
import HomeFeed from './pages/HomeFeed'

function App() {
  return (
    <div className="min-h-screen bg-canvas">
      <Navbar activeLink="Home" />
      <HomeFeed />
    </div>
  )
}

export default App
