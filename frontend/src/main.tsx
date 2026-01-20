import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { GoogleMapsProvider } from './components/map/GoogleMapsProvider'
import './i18n'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <GoogleMapsProvider>
          <App />
        </GoogleMapsProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
