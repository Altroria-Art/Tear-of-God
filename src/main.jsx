import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { prepareInitialLanguage } from './i18n.js'
import './index.css'

prepareInitialLanguage().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})


