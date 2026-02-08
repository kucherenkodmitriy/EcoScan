import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Report from './pages/Report'
import BinDetail from './pages/BinDetail'
import BinForm from './pages/BinForm'
import QRPrint from './pages/QRPrint'
import PrivacyPolicy from './pages/PrivacyPolicy'
import Terms from './pages/Terms'
import Landing from './pages/landing/Landing'
import WebhookDetail from './pages/WebhookDetail'
import WebhookForm from './pages/WebhookForm'
import ApiKeyCreate from './pages/ApiKeyCreate'
import ApiKeyDetail from './pages/ApiKeyDetail'
import Settings from './pages/Settings'
import CookieConsent from './components/CookieConsent'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return null
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />
}

function App() {
  return (
    <>
      <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/report" element={<Report />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<Terms />} />
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/bins/new"
        element={
          <PrivateRoute>
            <BinForm />
          </PrivateRoute>
        }
      />
      <Route
        path="/bins/:id"
        element={
          <PrivateRoute>
            <BinDetail />
          </PrivateRoute>
        }
      />
      <Route
        path="/bins/:id/edit"
        element={
          <PrivateRoute>
            <BinForm />
          </PrivateRoute>
        }
      />
      <Route
        path="/settings"
        element={<Navigate to="/settings/api-keys" />}
      />
      <Route
        path="/settings/api-keys"
        element={
          <PrivateRoute>
            <Settings />
          </PrivateRoute>
        }
      />
      <Route
        path="/settings/webhooks"
        element={
          <PrivateRoute>
            <Settings />
          </PrivateRoute>
        }
      />
      <Route
        path="/settings/export"
        element={
          <PrivateRoute>
            <Settings />
          </PrivateRoute>
        }
      />
      <Route
        path="/webhooks/new"
        element={
          <PrivateRoute>
            <WebhookForm />
          </PrivateRoute>
        }
      />
      <Route
        path="/webhooks/:id"
        element={
          <PrivateRoute>
            <WebhookDetail />
          </PrivateRoute>
        }
      />
      <Route
        path="/webhooks/:id/edit"
        element={
          <PrivateRoute>
            <WebhookForm />
          </PrivateRoute>
        }
      />
      <Route
        path="/api-keys/new"
        element={
          <PrivateRoute>
            <ApiKeyCreate />
          </PrivateRoute>
        }
      />
      <Route
        path="/api-keys/:id"
        element={
          <PrivateRoute>
            <ApiKeyDetail />
          </PrivateRoute>
        }
      />
      <Route
        path="/print"
        element={
          <PrivateRoute>
            <QRPrint />
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
    <CookieConsent />
    </>
  )
}

export default App
