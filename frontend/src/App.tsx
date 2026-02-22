import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { BreadcrumbProvider } from './context/BreadcrumbContext'
import AdminLayout from './components/AdminLayout'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
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
import UserDetail from './pages/UserDetail'
import UserForm from './pages/UserForm'
import CookieConsent from './components/CookieConsent'

function PrivateRoute() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />
  }

  return (
    <BreadcrumbProvider>
      <AdminLayout />
    </BreadcrumbProvider>
  )
}

function App() {
  return (
    <>
      <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/report" element={<Report />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<Terms />} />
      <Route element={<PrivateRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/bins/new" element={<BinForm />} />
        <Route path="/bins/:id" element={<BinDetail />} />
        <Route path="/bins/:id/edit" element={<BinForm />} />
        <Route path="/settings" element={<Navigate to="/settings/api-keys" />} />
        <Route path="/settings/api-keys" element={<Settings />} />
        <Route path="/settings/webhooks" element={<Settings />} />
        <Route path="/settings/export" element={<Settings />} />
        <Route path="/settings/users" element={<Settings />} />
        <Route path="/webhooks/new" element={<WebhookForm />} />
        <Route path="/webhooks/:id" element={<WebhookDetail />} />
        <Route path="/webhooks/:id/edit" element={<WebhookForm />} />
        <Route path="/api-keys/new" element={<ApiKeyCreate />} />
        <Route path="/api-keys/:id" element={<ApiKeyDetail />} />
        <Route path="/users/new" element={<UserForm />} />
        <Route path="/users/:email" element={<UserDetail />} />
        <Route path="/users/:email/edit" element={<UserForm />} />
        <Route path="/print" element={<QRPrint />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
    <CookieConsent />
    </>
  )
}

export default App
