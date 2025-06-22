import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  HomeIcon,
  MapIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  BellIcon,
  UserCircleIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'
import { getCurrentUser, signOut } from 'aws-amplify/auth'
import toast from 'react-hot-toast'

// Admin Components
import AdminOverview from '../components/admin/AdminOverview'
import BinManagement from '../components/admin/BinManagement'
import Analytics from '../components/admin/Analytics'
import Settings from '../components/admin/Settings'

const AdminDashboard = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  useEffect(() => {
    checkAuthAndLoadUser()
  }, [])

  const checkAuthAndLoadUser = async () => {
    try {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
    } catch (error) {
      // Check for demo auth
      const demoAuth = localStorage.getItem('demo-auth')
      if (demoAuth) {
        setUser({
          username: 'demo-admin',
          attributes: {
            email: 'demo@ecoscan.com',
            name: 'Demo Administrator'
          }
        })
      } else {
        toast.error('Please log in to access the admin dashboard')
        navigate('/login')
        return
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      if (localStorage.getItem('demo-auth')) {
        localStorage.removeItem('demo-auth')
      } else {
        await signOut()
      }
      toast.success('Logged out successfully')
      navigate('/')
    } catch (error) {
      console.error('Logout error:', error)
      toast.error('Error logging out')
    }
  }

  const sidebarItems = [
    { path: '/admin', icon: HomeIcon, label: 'Overview', exact: true },
    { path: '/admin/bins', icon: MapIcon, label: 'Bin Management' },
    { path: '/admin/analytics', icon: ChartBarIcon, label: 'Analytics' },
    { path: '/admin/settings', icon: Cog6ToothIcon, label: 'Settings' }
  ]

  const isActivePath = (path: string, exact = false) => {
    if (exact) {
      return location.pathname === path
    }
    return location.pathname.startsWith(path)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <motion.div 
        className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-white shadow-xl border-r border-green-100 transition-all duration-300 flex flex-col`}
        initial={{ x: -100 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Sidebar Header */}
        <div className="p-6 border-b border-green-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
              <SparklesIcon className="w-6 h-6 text-white" />
            </div>
            {isSidebarOpen && (
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  EcoScan
                </h1>
                <p className="text-sm text-gray-500">Admin Dashboard</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {sidebarItems.map((item) => {
            const isActive = isActivePath(item.path, item.exact)
            return (
              <motion.button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg' 
                    : 'text-gray-600 hover:bg-green-50 hover:text-green-600'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {isSidebarOpen && (
                  <span className="font-medium">{item.label}</span>
                )}
              </motion.button>
            )
          })}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-green-100">
          <div className={`flex items-center ${isSidebarOpen ? 'space-x-3' : 'justify-center'} mb-4`}>
            <UserCircleIcon className="w-8 h-8 text-gray-400" />
            {isSidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.attributes?.name || user?.username || 'Admin User'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user?.attributes?.email || 'admin@ecoscan.com'}
                </p>
              </div>
            )}
          </div>
          
          <motion.button
            onClick={handleLogout}
            className={`w-full flex items-center ${isSidebarOpen ? 'space-x-3' : 'justify-center'} px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors duration-200`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            {isSidebarOpen && <span className="font-medium">Logout</span>}
          </motion.button>
        </div>

        {/* Sidebar Toggle */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-20 w-6 h-6 bg-white border border-green-200 rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-shadow"
        >
          <svg 
            className={`w-3 h-3 text-green-600 transition-transform duration-200 ${isSidebarOpen ? 'rotate-180' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white shadow-sm border-b border-green-100 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {location.pathname === '/admin' && 'Dashboard Overview'}
                {location.pathname.includes('/bins') && 'Bin Management'}
                {location.pathname.includes('/analytics') && 'Analytics'}
                {location.pathname.includes('/settings') && 'Settings'}
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>

            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative">
                <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-200"
                />
              </div>

              {/* Notifications */}
              <motion.button
                className="relative p-2 text-gray-400 hover:text-green-600 transition-colors duration-200"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <BellIcon className="w-6 h-6" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
              </motion.button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto">
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<AdminOverview />} />
              <Route path="/bins/*" element={<BinManagement />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

export default AdminDashboard
