import React from 'react'

// นำเข้า Component จากไฟล์ที่คุณเพิ่งสร้างไว้
// ถ้าอยากดูหน้า Home ให้ใช้บรรทัดนี้
import HomeFeed from './pages/Home'

// ถ้าอยากดูหน้า Login ให้เอาคอมเมนต์บรรทัดล่างออก แล้วคอมเมนต์บรรทัดบนแทน
// import Login from './pages/Login'

function App() {
  return (
    // เรียกใช้งานคอมโพเนนต์หลักที่ต้องการแสดงผล
    <HomeFeed />
  )
}

export default App